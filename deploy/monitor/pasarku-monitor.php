<?php

/*
 * Monitoring log keamanan PasarKu berbasis aturan (checklist OWASP G5).
 * Dipasang oleh deploy/server-setup.sh ke /usr/local/lib/pasarku/ dan dijalankan cron tiap 15 menit:
 *   php /usr/local/lib/pasarku/pasarku-monitor.php
 * Membaca storage/logs/security.log 60 menit terakhir lalu menulis ringkasan ke
 * /var/log/pasarku-monitor.log. Bila ada pola serangan, peringatan juga dikirim ke syslog
 * (tag pasarku-monitor, prioritas auth.warning). Pemblokiran IP dilakukan Fail2Ban.
 *
 * Batas bisa diubah di /etc/default/pasarku-monitor:
 *   MONITOR_WINDOW_MINUTES=60  MONITOR_IP_FAILED=10  MONITOR_TOTAL_FAILED=30
 */

declare(strict_types=1);

require __DIR__.'/security-log.php';

$cfg = pasarku_config();
$window = max(5, (int) ($cfg['MONITOR_WINDOW_MINUTES'] ?? 60));
$ipLimit = max(1, (int) ($cfg['MONITOR_IP_FAILED'] ?? 10));
$totalLimit = max(1, (int) ($cfg['MONITOR_TOTAL_FAILED'] ?? 30));

$entries = pasarku_read_security_log($cfg, $window);
$stats = pasarku_summarize($entries);

$alerts = [];
foreach ($stats['failed_by_ip'] as $ip => $count) {
    if ($count >= $ipLimit) {
        $alerts[] = "Brute force dari IP {$ip}: {$count} login gagal dalam {$window} menit";
    }
}
if ($stats['failed'] >= $totalLimit) {
    $alerts[] = "Lonjakan login gagal: {$stats['failed']} dalam {$window} menit";
}
foreach ($stats['admin_actions'] as $line) {
    if (str_contains($line, 'disable_account') || str_contains($line, 'change_role')) {
        $alerts[] = 'Perubahan akun oleh admin: '.$line;
    }
}

$banned = trim((string) @shell_exec('fail2ban-client status pasarku-login 2>/dev/null | grep "Banned IP list" | cut -d: -f2'));

$summary = sprintf(
    'window=%dm login_ok=%d login_gagal=%d ip_unik_gagal=%d aksi_admin=%d banned=[%s] status=%s',
    $window,
    $stats['logins'],
    $stats['failed'],
    count($stats['failed_by_ip']),
    count($stats['admin_actions']),
    $banned,
    $alerts ? 'PERINGATAN' : 'OK',
);

pasarku_write_log('/var/log/pasarku-monitor.log', $summary);
foreach ($alerts as $alert) {
    pasarku_write_log('/var/log/pasarku-monitor.log', 'PERINGATAN '.$alert);
    pasarku_syslog('pasarku-monitor', $alert);
}

echo $summary.PHP_EOL;
foreach ($alerts as $alert) {
    echo 'PERINGATAN '.$alert.PHP_EOL;
}
