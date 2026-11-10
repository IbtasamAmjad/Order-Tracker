# Makes the app start by itself when the PC starts, and backs up every night at 2 AM.
# Run it ONCE, as Administrator, AFTER the app has been built (npm run build):
#   powershell -ExecutionPolicy Bypass -File deploy\windows\install-tasks.ps1
# To remove the tasks later:  ... install-tasks.ps1 -Remove
#Requires -RunAsAdministrator
param([switch]$Remove)
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$root = (Resolve-Path (Join-Path $here "..\..")).Path
$serverTask = "OrderManager Server"
$backupTask = "OrderManager Backup"

if ($Remove) {
  foreach ($t in @($serverTask, $backupTask)) { Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction SilentlyContinue }
  Write-Host "Both tasks removed."
  return
}

$node = (Get-Command node -ErrorAction Stop).Source

# 1. the server: starts when the PC starts (no one needs to sign in), and is started again if it stops
$serverAction = New-ScheduledTaskAction -Execute (Join-Path $here "start-server.bat") -WorkingDirectory $root
$serverTrigger = New-ScheduledTaskTrigger -AtStartup
$serverSettings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $serverTask -Action $serverAction -Trigger $serverTrigger -Settings $serverSettings -User "SYSTEM" -RunLevel Highest -Force | Out-Null

# 2. the backup: every night at 2 AM (if the PC was off then, it runs when the PC is next on)
$backupAction = New-ScheduledTaskAction -Execute $node -Argument "`"$(Join-Path $here 'backup.cjs')`"" -WorkingDirectory $root
$backupTrigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$backupSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $backupTask -Action $backupAction -Trigger $backupTrigger -Settings $backupSettings -User "SYSTEM" -RunLevel Highest -Force | Out-Null

Write-Host "Done. Two tasks were made:"
Write-Host "  $serverTask  - starts the app when the PC starts"
Write-Host "  $backupTask  - backs up every night at 2 AM"
Write-Host "Start the app now without restarting:  Start-ScheduledTask -TaskName '$serverTask'"
