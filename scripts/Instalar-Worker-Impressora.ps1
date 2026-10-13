[CmdletBinding()]
param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot '.env')
)

$ErrorActionPreference = 'Stop'
$taskName = 'POPForge Printer Worker'
$installDir = Join-Path $env:LOCALAPPDATA 'POPForge\PrinterWorker'
$sourceWorker = Join-Path $PSScriptRoot 'popforge-printer-worker.mjs'

if (-not (Test-Path -LiteralPath $sourceWorker)) { throw "Não foi encontrado $sourceWorker" }
if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "Não encontrei o ficheiro .env. Coloque-o na mesma pasta deste instalador ou execute com -ConfigPath 'C:\caminho\.env'."
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Copy-Item -LiteralPath $sourceWorker -Destination (Join-Path $installDir 'popforge-printer-worker.mjs') -Force
Copy-Item -LiteralPath $ConfigPath -Destination (Join-Path $installDir '.env') -Force

$runner = @"
`$ErrorActionPreference = 'Continue'
`$node = '$($node.Replace("'", "''"))'
`$worker = Join-Path `$PSScriptRoot 'popforge-printer-worker.mjs'
`$log = Join-Path `$PSScriptRoot 'worker.log'
& `$node `$worker *>> `$log
"@
Set-Content -LiteralPath (Join-Path $installDir 'run-worker.ps1') -Value $runner -Encoding UTF8

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$installDir\run-worker.ps1`""
$start = (Get-Date).AddMinutes(1).ToString('s')
$taskXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"><Triggers><CalendarTrigger><StartBoundary>$start</StartBoundary><Enabled>true</Enabled><Repetition><Interval>PT1M</Interval><Duration>P1D</Duration><StopAtDurationEnd>false</StopAtDurationEnd></Repetition><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger></Triggers><Principals><Principal id="Author"><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><StartWhenAvailable>true</StartWhenAvailable><ExecutionTimeLimit>PT30S</ExecutionTimeLimit></Settings><Actions Context="Author"><Exec><Command>powershell.exe</Command><Arguments>-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File &quot;$installDir\run-worker.ps1&quot;</Arguments></Exec></Actions></Task>
"@
Register-ScheduledTask -TaskName $taskName -Xml $taskXml -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host "Instalação concluída." -ForegroundColor Green
Write-Host "Worker: $installDir"
Write-Host "Log:    $(Join-Path $installDir 'worker.log')"
Write-Host 'Abra POPForge > Impressoras dentro de 1 minuto. O estado deverá deixar de estar offline.'
