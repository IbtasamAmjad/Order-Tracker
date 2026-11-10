# Restarts the app (for example after changing .env.local). Run as Administrator:
#   powershell -ExecutionPolicy Bypass -File deploy\windows\restart-server.ps1
#Requires -RunAsAdministrator
Stop-ScheduledTask -TaskName "OrderManager Server" -ErrorAction SilentlyContinue
# the app itself: whatever is listening on port 3000 (only that, never every node program on the PC)
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName "OrderManager Server"
Write-Host "The app is starting again. It is ready in about 10 seconds: http://localhost:3000"
