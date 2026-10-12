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

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$installDir\run-worker.ps1`""
$trigger = New-ScheduledTaskTrigger -Daily -At (Get-Date).Date.AddMinutes(1)
$trigger.Repetition.Interval = 'PT1M'
$trigger.Repetition.Duration = 'P1D'
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Description 'Envia a telemetria da impressora local para a POPForge.' | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host "Instalação concluída." -ForegroundColor Green
Write-Host "Worker: $installDir"
Write-Host "Log:    $(Join-Path $installDir 'worker.log')"
Write-Host 'Abra POPForge > Impressoras dentro de 1 minuto. O estado deverá deixar de estar offline.'
