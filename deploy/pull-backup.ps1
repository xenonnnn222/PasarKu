<#
Menarik backup database PasarKu dari VPS ke laptop Windows (checklist OWASP J3: backup disimpan terpisah).
Butuh OpenSSH Client bawaan Windows dan SSH key yang sudah terpasang di server (lihat deploy/README.md bagian 5).

Sekali jalan:
    powershell -ExecutionPolicy Bypass -File deploy\pull-backup.ps1
Pasang jadwal harian (03:30, setelah backup server 02:15):
    powershell -ExecutionPolicy Bypass -File deploy\pull-backup.ps1 -Install

Setiap file dicek: checksum SHA-256 sama dengan server dan header gzip valid. Setelah berhasil,
server ditandai (/var/backups/pasarku/.last-offsite-pull) agar terlihat di log Jenkins.
#>
param(
    [string]$Server = '103.139.193.51',
    [int]$Port = 2222,
    [string]$User = 'root',
    [string]$Dest = (Join-Path $env:USERPROFILE 'PasarKu-backup'),
    [int]$KeepDays = 30,
    [switch]$Install
)

$ErrorActionPreference = 'Stop'
$RemoteDir = '/var/backups/pasarku'

if ($Install) {
    $script = $MyInvocation.MyCommand.Path
    $arg = "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -Server $Server -Port $Port -User $User -Dest `"$Dest`" -KeepDays $KeepDays"
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
    $trigger = New-ScheduledTaskTrigger -Daily -At '03:30'
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable
    Register-ScheduledTask -TaskName 'PasarKu pull backup' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
    Write-Output "Jadwal 'PasarKu pull backup' dipasang: setiap hari 03:30 (atau saat laptop menyala bila terlewat)."
    exit 0
}

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$log = Join-Path $Dest 'pull.log'
function Write-Log([string]$msg) {
    $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Add-Content -Path $log -Value $line
    Write-Output $line
}

$sshOpts = @('-p', "$Port", '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'LogLevel=ERROR')
$target = "$User@$Server"

try {
    # Hanya backup yang punya checksum .sha256 (backup lama sebelum fitur ini dilewati).
    $listing = & ssh @sshOpts $target "for f in $RemoteDir/pasarku-*.sqlite.gz; do [ -f `"`$f.sha256`" ] && basename `"`$f`"; done; true"
    if ($LASTEXITCODE -ne 0) { throw "ssh gagal (kode $LASTEXITCODE). Pastikan SSH key terpasang dan port $Port terbuka." }
    $names = @($listing | Where-Object { $_ -match '^pasarku-\d{8}-\d{6}\.sqlite\.gz$' })
    if ($names.Count -eq 0) { throw 'Tidak ada file backup di server.' }

    $new = 0
    foreach ($name in $names) {
        $local = Join-Path $Dest $name
        if (Test-Path $local) { continue }

        & scp -P "$Port" -o BatchMode=yes -o LogLevel=ERROR -q "${target}:$RemoteDir/$name" "${target}:$RemoteDir/$name.sha256" "$Dest"
        if ($LASTEXITCODE -ne 0) { throw "scp $name gagal (kode $LASTEXITCODE)." }

        $expected = ((Get-Content (Join-Path $Dest "$name.sha256") -Raw).Trim() -split '\s+')[0].ToLower()
        $actual = (Get-FileHash -Algorithm SHA256 $local).Hash.ToLower()
        $bytes = [System.IO.File]::ReadAllBytes($local)
        if ($expected -ne $actual -or $bytes.Length -lt 2 -or $bytes[0] -ne 0x1f -or $bytes[1] -ne 0x8b) {
            Remove-Item $local -Force
            throw "Verifikasi $name gagal (checksum atau format gzip tidak cocok); file dihapus."
        }
        Write-Log "OK $name ($([math]::Round($bytes.Length / 1KB, 1)) KB, sha256 cocok)"
        $new++
    }

    Get-ChildItem $Dest -Filter 'pasarku-*.sqlite.gz*' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } | Remove-Item -Force

    & ssh @sshOpts $target "date -Is > $RemoteDir/.last-offsite-pull && echo '$env:COMPUTERNAME' >> $RemoteDir/.last-offsite-pull" | Out-Null
    $total = (Get-ChildItem $Dest -Filter 'pasarku-*.sqlite.gz').Count
    Write-Log "Selesai: $new file baru, $total salinan tersimpan di $Dest"
}
catch {
    Write-Log "GAGAL: $($_.Exception.Message)"
    exit 1
}
