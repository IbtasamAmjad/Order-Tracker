# Updates the app on the office PC: backup, get the new version, rebuild, start again. Takes a few minutes.
# Run as Administrator:  powershell -ExecutionPolicy Bypass -File deploy\windows\update.ps1
#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $root

Write-Host "1. Stopping the app..."
Stop-ScheduledTask -TaskName "OrderManager Server" -ErrorAction SilentlyContinue
# the app itself: whatever is listening on port 3000 (only that, never every node program on the PC)
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

Write-Host "2. Backing up first..."
node (Join-Path $PSScriptRoot "backup.cjs")

Write-Host "3. Getting the new version..."
git pull
npm install

Write-Host "4. Updating the database (safe to run when there is nothing new)..."
npm run db:migrate

Write-Host "5. Building..."
npm run build

Write-Host "6. Starting the app..."
Start-ScheduledTask -TaskName "OrderManager Server"
Start-Sleep -Seconds 8
try {
  $r = Invoke-WebRequest -Uri "http://localhost:3000/admin/login" -UseBasicParsing -TimeoutSec 20
  Write-Host "Done. The app answers (status $($r.StatusCode))."
} catch {
  Write-Host "The app did not answer yet. Wait a minute and try http://localhost:3000, or read deploy\windows\server.log"
}
