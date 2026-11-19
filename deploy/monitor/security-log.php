<?php

/*
 * Fungsi bersama untuk pasarku-monitor.php dan pasarku-ai-monitor.php.
 * Format baris log Laravel: [2026-11-19 14:05:01] production.WARNING: Login gagal phone=0812*****890 ip=1.2.3.4 {...}
 */

declare(strict_types=1);

/** @return array<string, string> */
function pasarku_config(): array
{
    $cfg = [];
    $file = '/etc/default/pasarku-monitor';
    if (is_readable($file)) {
        foreach (file($file, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
            if (preg_match('/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/', $line, $m)) {
                $cfg[$m[1]] = trim($m[2], "\"'");
            }
        }
    }
    $cfg['APP'] = $cfg['APP'] ?? '/var/www/html/pasarku';
    $cfg['LOG'] = $cfg['LOG'] ?? $cfg['APP'].'/storage/logs/security.log';

    // Zona waktu log mengikuti APP_TIMEZONE aplikasi (default config/app.php: Asia/Makassar).
    $tz = 'Asia/Makassar';
    $env = $cfg['APP'].'/.env';
    if (is_readable($env) && preg_match('/^APP_TIMEZONE=(.+)$/m', (string) file_get_contents($env), $m)) {
        $tz = trim($m[1], "\"' \r");
    }
    $cfg['TZ'] = $tz;

    return $cfg;
}

/**
 * Baris log security.log dalam rentang waktu terakhir (maks. 4 MB terakhir dibaca).
 *
 * @param  array<string, string>  $cfg
 * @return list<array{time: DateTimeImmutable, level: string, message: string}>
 */
function pasarku_read_security_log(array $cfg, int $minutes): array
{
    $file = $cfg['LOG'];
    if (! is_readable($file)) {
        return [];
    }

    $tz = new DateTimeZone($cfg['TZ']);
    $since = new DateTimeImmutable("-{$minutes} minutes", $tz);

    $size = filesize($file) ?: 0;
    $fh = fopen($file, 'rb');
    if ($fh === false) {
        return [];
    }
    if ($size > 4 * 1024 * 1024) {
        fseek($fh, -4 * 1024 * 1024, SEEK_END);
        fgets($fh); // buang baris terpotong
    }

    $entries = [];
    while (($line = fgets($fh)) !== false) {
        if (! preg_match('/^\[(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})[^\]]*\] \S+\.(\w+): (.*)$/', rtrim($line), $m)) {
            continue;
        }
        $time = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', str_replace('T', ' ', $m[1]), $tz);
        if ($time === false || $time < $since) {
            continue;
        }
        $entries[] = ['time' => $time, 'level' => $m[2], 'message' => mb_substr($m[3], 0, 400)];
    }
    fclose($fh);

    return $entries;
}

/**
 * @param  list<array{time: DateTimeImmutable, level: string, message: string}>  $entries
 * @return array{logins: int, failed: int, failed_by_ip: array<string, int>, admin_actions: list<string>}
 */
function pasarku_summarize(array $entries): array
{
    $stats = ['logins' => 0, 'failed' => 0, 'failed_by_ip' => [], 'admin_actions' => []];
    foreach ($entries as $e) {
        if (str_starts_with($e['message'], 'Login berhasil')) {
            $stats['logins']++;
        } elseif (preg_match('/^Login gagal .*ip=(\S+)/', $e['message'], $m)) {
            $stats['failed']++;
            $stats['failed_by_ip'][$m[1]] = ($stats['failed_by_ip'][$m[1]] ?? 0) + 1;
        } elseif (str_starts_with($e['message'], 'Aktivitas admin')) {
            $stats['admin_actions'][] = $e['time']->format('H:i').' '.mb_substr($e['message'], 0, 200);
        }
    }
    arsort($stats['failed_by_ip']);

    return $stats;
}

function pasarku_write_log(string $file, string $line): void
{
    @file_put_contents($file, '['.date('Y-m-d H:i:s').'] '.$line.PHP_EOL, FILE_APPEND | LOCK_EX);
}

function pasarku_syslog(string $tag, string $message): void
{
    if (function_exists('openlog')) {
        openlog($tag, LOG_PID, LOG_AUTH);
        syslog(LOG_WARNING, $message);
        closelog();
    }
}
