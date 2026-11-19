<#
Monitoring log keamanan PasarKu dengan AI dari laptop pemilik (checklist OWASP G6).

Alur (tiap 6 jam lewat Task Scheduler):
  1. Ambil ringkasan security.log dari server lewat SSH key   (pasarku-ai-monitor.php --export)
  2. Kirim ke AI lokal: 9router di http://localhost:20128/v1  (format OpenAI-compatible)
  3. Kirim hasil (JSON) kembali ke server untuk divalidasi dan dicatat
     di /var/log/pasarku-ai-monitor.log                       (pasarku-ai-monitor.php --record)

Server tidak menyimpan kredensial AI dan port 9router tidak pernah dibuka ke internet.

Persiapan sekali:
  - 9router berjalan di laptop, buat API key di dashboard 9router.
  - Simpan key itu di file (hanya isi key, satu baris):  %USERPROFILE%\.pasarku\9router.key
  - SSH key ke server sudah terpasang (sama dengan pull-backup.ps1).

Sekali jalan:
    powershell -ExecutionPolicy Bypass -File deploy\ai-monitor-local.ps1
Pasang jadwal tiap 6 jam:
    powershell -ExecutionPolicy Bypass -File deploy\ai-monitor-local.ps1 -Install
#>
param(
    [string]$Server = '103.139.193.51',
    [int]$Port = 2222,
    [string]$User = 'root',
    [string]$BaseUrl = 'http://localhost:20128/v1',
    [string]$Model = 'cc/claude-haiku-4-5-20251001',
    [string]$KeyFile = (Join-Path $env:USERPROFILE '.pasarku\9router.key'),
    [string]$LogDir = (Join-Path $env:USERPROFILE 'PasarKu-ai'),
    [switch]$Install
)

$ErrorActionPreference = 'Stop'
$Remote = 'php /usr/local/lib/pasarku/pasarku-ai-monitor.php'

if ($Install) {
    $script = $MyInvocation.MyCommand.Path
    $arg = "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -Server $Server -Port $Port -User $User -BaseUrl $BaseUrl -Model $Model -KeyFile `"$KeyFile`" -LogDir `"$LogDir`""
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
    $trigger = New-ScheduledTaskTrigger -Once -At '00:10' -RepetitionInterval (New-TimeSpan -Hours 6) -RepetitionDuration (New-TimeSpan -Days 3650)
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
    Register-ScheduledTask -TaskName 'PasarKu AI monitor' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
    Write-Output "Jadwal 'PasarKu AI monitor' dipasang: tiap 6 jam (00:10, 06:10, 12:10, 18:10), menyusul bila terlewat."
    exit 0
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$log = Join-Path $LogDir 'ai-monitor.log'
function Write-Log([string]$msg) {
    $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Add-Content -Path $log -Value $line -Encoding UTF8
    Write-Output $line
}

# JSON hanya-ASCII agar aman melewati pipe PowerShell 5.1 ke ssh.
function ConvertTo-AsciiJson($obj) {
    $json = $obj | ConvertTo-Json -Depth 20 -Compress
    [regex]::Replace($json, '[^\x00-\x7F]', { param($m) '\u{0:x4}' -f [int][char]$m.Value })
}

$sshOpts = @('-p', "$Port", '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'LogLevel=ERROR')
$target = "$User@$Server"

try {
    if (-not (Test-Path $KeyFile)) { throw "File API key 9router tidak ditemukan: $KeyFile" }
    $apiKey = (Get-Content $KeyFile -Raw).Trim()
    if ($apiKey -eq '') { throw "File $KeyFile kosong." }

    # 1. Ringkasan log dari server
    $exportRaw = (& ssh @sshOpts $target "$Remote --export") -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "ssh --export gagal (kode $LASTEXITCODE)." }
    $export = $exportRaw | ConvertFrom-Json

    # 2. Analisis oleh AI lokal (9router)
    $schemaJson = $export.schema | ConvertTo-Json -Depth 20 -Compress
    $body = @{
        model = $Model
        max_tokens = 4000
        temperature = 0
        messages = @(
            @{ role = 'system'; content = $export.system + ' Jawab HANYA dengan satu objek JSON valid (tanpa markdown) yang sesuai JSON Schema berikut: ' + $schemaJson }
            @{ role = 'user'; content = $export.report }
        )
    }
    $bytes = [Text.Encoding]::UTF8.GetBytes((ConvertTo-AsciiJson $body))
    $resp = Invoke-WebRequest -Uri "$BaseUrl/chat/completions" -Method Post -UseBasicParsing -TimeoutSec 240 `
        -Headers @{ Authorization = "Bearer $apiKey" } -ContentType 'application/json; charset=utf-8' -Body $bytes
    $reader = New-Object IO.StreamReader($resp.RawContentStream, [Text.Encoding]::UTF8)
    $chat = $reader.ReadToEnd() | ConvertFrom-Json
    $text = [string]$chat.choices[0].message.content

    # Ambil objek JSON dari jawaban (abaikan pagar ```json bila ada).
    $start = $text.IndexOf('{'); $end = $text.LastIndexOf('}')
    if ($start -lt 0 -or $end -le $start) { throw 'Jawaban AI tidak berisi JSON.' }
    $result = $text.Substring($start, $end - $start + 1) | ConvertFrom-Json
    if (@('rendah', 'sedang', 'tinggi') -notcontains $result.risk) { throw "Nilai risk tidak valid: $($result.risk)" }

    # 3. Catat di server (server memvalidasi ulang terhadap skema)
    $usedModel = if ($chat.model) { [string]$chat.model } else { $Model }
    $payload = ConvertTo-AsciiJson @{ model = $usedModel; result = $result }
    $stored = ($payload | & ssh @sshOpts $target "$Remote --record") -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "ssh --record gagal (kode $LASTEXITCODE)." }

    Write-Log ("OK " + ($stored -split "`n")[0])
}
catch {
    Write-Log "GAGAL: $($_.Exception.Message)"
    exit 1
}
