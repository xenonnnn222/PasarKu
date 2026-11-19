<?php

/*
 * Monitoring log keamanan PasarKu menggunakan AI (checklist OWASP G6).
 * Dipasang oleh deploy/server-setup.sh ke /usr/local/lib/pasarku/. Dua cara menjalankan analisis:
 *
 * 1) Dari laptop pemilik lewat AI lokal (9router), deploy/ai-monitor-local.ps1 tiap 6 jam:
 *      php pasarku-ai-monitor.php --export   cetak ringkasan log + instruksi + skema (JSON) untuk laptop
 *      php pasarku-ai-monitor.php --record   baca hasil analisis (JSON) dari stdin, validasi, simpan
 *    Server tidak menyimpan kredensial AI apa pun dan port 9router tidak dibuka ke internet.
 *
 * 2) Langsung dari server ke Claude API (cron tiap 6 jam):
 *      php pasarku-ai-monitor.php            kirim ke Claude, simpan hasil
 *      php pasarku-ai-monitor.php --dry-run  tampilkan data yang akan dikirim saja
 *
 * Mode 2 AKTIF HANYA BILA API KEY DIISI di /etc/default/pasarku-monitor (milik root, mode 600):
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
$export = in_array('--export', $argv, true);
$record = in_array('--record', $argv, true);
$lastFile = '/var/lib/pasarku/ai-monitor-last.json';
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

/** Pastikan hasil analisis sesuai skema; teks dipotong agar log tetap rapi. */
function pasarku_ai_clean(mixed $r): ?array
{
    $levels = ['rendah', 'sedang', 'tinggi'];
    if (! is_array($r) || ! in_array($r['risk'] ?? null, $levels, true) || ! is_string($r['summary'] ?? null)
        || ! is_array($r['findings'] ?? null) || ! is_array($r['actions'] ?? null)) {
        return null;
    }
    $cut = fn (mixed $v, int $n): string => mb_substr(trim(preg_replace('/\s+/u', ' ', (string) $v)), 0, $n);
    $findings = [];
    foreach (array_slice($r['findings'], 0, 20) as $f) {
        if (! is_array($f) || ! in_array($f['severity'] ?? null, $levels, true)) {
            return null;
        }
        $findings[] = ['title' => $cut($f['title'] ?? '', 200), 'evidence' => $cut($f['evidence'] ?? '', 500), 'severity' => $f['severity']];
    }

    return [
        'risk' => $r['risk'],
        'summary' => $cut($r['summary'], 1000),
        'findings' => $findings,
        'actions' => array_map(fn ($a): string => $cut($a, 300), array_slice(array_filter($r['actions'], 'is_string'), 0, 10)),
    ];
}

function pasarku_ai_store(array $result, string $model, string $source, int $hours, array $stats, string $logFile, string $lastFile): void
{
    $result['model'] = mb_substr($model, 0, 80);
    $result['source'] = $source;
    $result['analyzed_at'] = date('c');
    $result['window_hours'] = $hours;
    $result['stats'] = ['login_ok' => $stats['logins'], 'login_gagal' => $stats['failed'], 'aksi_admin' => count($stats['admin_actions'])];

    @mkdir(dirname($lastFile), 0750, true);
    @file_put_contents($lastFile, json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

    $line = "risk={$result['risk']} temuan=".count($result['findings'])." sumber={$source} model={$result['model']} ringkasan={$result['summary']}";
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
}

if ($export) {
    echo json_encode(['system' => $system, 'report' => $report, 'schema' => $schema, 'window_hours' => $hours], JSON_THROW_ON_ERROR).PHP_EOL;
    exit(0);
}

if ($record) {
    $payload = json_decode((string) stream_get_contents(STDIN), true);
    $result = pasarku_ai_clean($payload['result'] ?? null);
    if ($result === null) {
        pasarku_write_log($logFile, 'GAGAL: hasil dari laptop tidak sesuai skema.');
        fwrite(STDERR, "Hasil tidak sesuai skema.\n");
        exit(1);
    }
    pasarku_ai_store($result, (string) ($payload['model'] ?? '?'), 'laptop-9router', $hours, $stats, $logFile, $lastFile);
    exit(0);
}

if ($dryRun) {
    echo "Model: {$model}\nAPI key: ".($apiKey !== '' ? 'terisi' : 'BELUM DIISI')."\n\n{$report}\n";
    exit(0);
}

if ($apiKey === '') {
    // Analisis dijalankan dari laptop (9router): jangan tulis "Nonaktif" selama hasilnya masih baru.
    $last = json_decode((string) @file_get_contents($lastFile), true);
    if (($last['source'] ?? '') === 'laptop-9router' && strtotime((string) ($last['analyzed_at'] ?? '')) > time() - 26 * 3600) {
        exit(0);
    }
    pasarku_write_log($logFile, 'Nonaktif: belum ada hasil dari laptop (ai-monitor-local.ps1) dan ANTHROPIC_API_KEY kosong.');
    echo "AI monitor nonaktif: jalankan deploy/ai-monitor-local.ps1 di laptop atau isi ANTHROPIC_API_KEY.\n";
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
$result = pasarku_ai_clean(json_decode($text, true));
if ($result === null) {
    pasarku_write_log($logFile, 'Jawaban tidak sesuai format (stop_reason='.($response['stop_reason'] ?? '?').').');
    exit(1);
}

pasarku_ai_store($result, (string) ($response['model'] ?? $model), 'server-anthropic', $hours, $stats, $logFile, $lastFile);
