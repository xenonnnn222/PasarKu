<?php

/*
 * Monitoring log keamanan PasarKu menggunakan AI / Claude API (checklist OWASP G6).
 * Dipasang oleh deploy/server-setup.sh ke /usr/local/lib/pasarku/ dan dijalankan cron tiap 6 jam:
 *   php /usr/local/lib/pasarku/pasarku-ai-monitor.php            kirim ke Claude, simpan hasil
 *   php /usr/local/lib/pasarku/pasarku-ai-monitor.php --dry-run  tampilkan data yang akan dikirim saja
 *
 * AKTIF HANYA BILA API KEY DIISI di /etc/default/pasarku-monitor (milik root, mode 600):
 *   ANTHROPIC_API_KEY=sk-ant-...
 *   PASARKU_AI_MODEL=claude-opus-5-5        (opsional)
 *   AI_WINDOW_HOURS=6                       (opsional)
 *
 * Data yang dikirim ke Anthropic: ringkasan jumlah dan maks. 150 baris security.log terakhir dalam
 * rentang waktu tersebut. Nomor HP sudah disamarkan oleh aplikasi (0812*****890); alamat IP dan
 * user agent ikut terkirim. Hasil analisis ditulis ke /var/log/pasarku-ai-monitor.log dan
 * /var/lib/pasarku/ai-monitor-last.json; risiko "tinggi" juga dikirim ke syslog (auth.warning).
 */

declare(strict_types=1);

require __DIR__.'/security-log.php';

$dryRun = in_array('--dry-run', $argv, true);
$cfg = pasarku_config();
$hours = max(1, min(48, (int) ($cfg['AI_WINDOW_HOURS'] ?? 6)));
$model = $cfg['PASARKU_AI_MODEL'] ?? 'claude-opus-5-5';
$apiKey = $cfg['ANTHROPIC_API_KEY'] ?? '';
$logFile = '/var/log/pasarku-ai-monitor.log';

$entries = pasarku_read_security_log($cfg, $hours * 60);
$stats = pasarku_summarize($entries);

$lines = array_map(
    fn (array $e): string => $e['time']->format('Y-m-d H:i:s').' '.$e['level'].' '.$e['message'],
    array_slice($entries, -150),
);
$topIps = array_slice($stats['failed_by_ip'], 0, 20, true);

$report = "Rentang: {$hours} jam terakhir (zona {$cfg['TZ']}).\n"
    ."Login berhasil: {$stats['logins']}\nLogin gagal: {$stats['failed']}\n"
    .'IP dengan login gagal terbanyak: '.json_encode($topIps)."\n"
    .'Aktivitas admin: '.count($stats['admin_actions'])."\n\n"
    ."Baris log (terbaru di bawah):\n".implode("\n", $lines);

$system = 'Anda analis keamanan untuk aplikasi pembukuan web PasarKu (Laravel, login nomor HP + PIN 4 angka, '
    .'rate limit 5 percobaan/menit per nomor+IP, Fail2Ban memblokir IP setelah 10 login gagal dalam 10 menit). '
    .'Analisis log keamanan yang diberikan: cari brute force/credential stuffing, enumerasi nomor, login dari IP '
    .'atau user agent tidak wajar, aktivitas admin mencurigakan, dan pola lain yang perlu ditindaklanjuti. '
    .'Jangan mengarang kejadian yang tidak ada di log. Jawab dalam bahasa Indonesia, ringkas.';

$schema = [
    'type' => 'object',
    'properties' => [
        'risk' => ['type' => 'string', 'enum' => ['rendah', 'sedang', 'tinggi']],
        'summary' => ['type' => 'string'],
        'findings' => [
            'type' => 'array',
            'items' => [
                'type' => 'object',
                'properties' => [
                    'title' => ['type' => 'string'],
                    'evidence' => ['type' => 'string'],
                    'severity' => ['type' => 'string', 'enum' => ['rendah', 'sedang', 'tinggi']],
                ],
                'required' => ['title', 'evidence', 'severity'],
                'additionalProperties' => false,
            ],
        ],
        'actions' => ['type' => 'array', 'items' => ['type' => 'string']],
    ],
    'required' => ['risk', 'summary', 'findings', 'actions'],
    'additionalProperties' => false,
];

$body = [
    'model' => $model,
    'max_tokens' => 8000,
    'system' => $system,
    'messages' => [['role' => 'user', 'content' => $report]],
    'output_config' => [
        'effort' => 'low',
        'format' => ['type' => 'json_schema', 'schema' => $schema],
    ],
    // Bila model utama menolak (refusal), API mengulang di model cadangan yang dipilih otomatis.
    'fallbacks' => 'default',
];

if ($dryRun) {
    echo "Model: {$model}\nAPI key: ".($apiKey !== '' ? 'terisi' : 'BELUM DIISI')."\n\n{$report}\n";
    exit(0);
}

if ($apiKey === '') {
    pasarku_write_log($logFile, 'Nonaktif: ANTHROPIC_API_KEY belum diisi di /etc/default/pasarku-monitor.');
    echo "AI monitor nonaktif: isi ANTHROPIC_API_KEY di /etc/default/pasarku-monitor.\n";
    exit(0);
}

$context = stream_context_create(['http' => [
    'method' => 'POST',
    'header' => implode("\r\n", [
        'content-type: application/json',
        'x-api-key: '.$apiKey,
        'anthropic-version: 2026-10-21',
        'anthropic-beta: server-side-fallback-2026-07-01',
    ]),
    'content' => json_encode($body, JSON_THROW_ON_ERROR),
    'timeout' => 300,
    'ignore_errors' => true,
]]);

$raw = @file_get_contents('https://api.anthropic.com/v1/messages', false, $context);
$status = 0;
foreach ($http_response_header ?? [] as $header) {
    if (preg_match('#^HTTP/\S+ (\d{3})#', $header, $m)) {
        $status = (int) $m[1];
    }
}

if ($raw === false || $status !== 200) {
    $error = $raw !== false ? (json_decode($raw, true)['error']['message'] ?? mb_substr($raw, 0, 300)) : 'koneksi gagal';
    pasarku_write_log($logFile, "GAGAL HTTP {$status}: {$error}");
    fwrite(STDERR, "Claude API gagal (HTTP {$status}): {$error}\n");
    exit(1);
}

$response = json_decode($raw, true);
if (($response['stop_reason'] ?? '') === 'refusal') {
    pasarku_write_log($logFile, 'Ditolak model: '.json_encode($response['stop_details'] ?? null));
    exit(1);
}

$text = '';
foreach ($response['content'] ?? [] as $block) {
    if (($block['type'] ?? '') === 'text') {
        $text .= $block['text'];
    }
}
$result = json_decode($text, true);
if (! is_array($result) || ! isset($result['risk'])) {
    pasarku_write_log($logFile, 'Jawaban tidak sesuai format (stop_reason='.($response['stop_reason'] ?? '?').').');
    exit(1);
}

$result['model'] = $response['model'] ?? $model;
$result['analyzed_at'] = date('c');
$result['window_hours'] = $hours;
$result['stats'] = ['login_ok' => $stats['logins'], 'login_gagal' => $stats['failed'], 'aksi_admin' => count($stats['admin_actions'])];

@mkdir('/var/lib/pasarku', 0750, true);
@file_put_contents('/var/lib/pasarku/ai-monitor-last.json', json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

$line = "risk={$result['risk']} temuan=".count($result['findings'])." model={$result['model']} ringkasan=".str_replace("\n", ' ', $result['summary']);
pasarku_write_log($logFile, $line);
if ($result['risk'] === 'tinggi') {
    pasarku_syslog('pasarku-ai-monitor', 'Risiko TINGGI: '.$result['summary']);
}

echo $line.PHP_EOL;
foreach ($result['findings'] as $finding) {
    echo "- [{$finding['severity']}] {$finding['title']}: {$finding['evidence']}".PHP_EOL;
}
foreach ($result['actions'] as $action) {
    echo "  tindakan: {$action}".PHP_EOL;
}
