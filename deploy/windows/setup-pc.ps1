# Makes this PC ready to be the server: it never goes to sleep, and its clock shows the users' time zone.
# Run it ONCE, as Administrator, in the project folder:
#   powershell -ExecutionPolicy Bypass -File deploy\windows\setup-pc.ps1
#
# The app shows every date and time in the PC's own time zone, so if the PC is in the USA and the users are in Pakistan,
# the PC must be set to Pakistan time (the default below). Use -TimeZone to choose another one, for example:
#   -TimeZone "Eastern Standard Time"      (see all names with: Get-TimeZone -ListAvailable)
# Use -OpenOfficeWifi only if phones in the SAME building should also open the app by the PC's local address.
#Requires -RunAsAdministrator
param(
  [string]$TimeZone = "Pakistan Standard Time",
  [switch]$OpenOfficeWifi
)
$ErrorActionPreference = "Stop"

Write-Host "1. Power: never sleep or hibernate while plugged in..."
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change disk-timeout-ac 0
powercfg /hibernate off
# (the screen may still turn off; that is fine)

Write-Host "2. Time zone: $TimeZone (so dates and times on the screens match the users)..."
Set-TimeZone -Id $TimeZone
Write-Host ("   The PC clock now reads: " + (Get-Date).ToString("dd MMM yyyy HH:mm") + "  (" + (Get-TimeZone).StandardName + ")")

if ($OpenOfficeWifi) {
  Write-Host "3. Firewall: let phones on the same office network open port 3000..."
  Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -ne "Disconnected" } | Set-NetConnectionProfile -NetworkCategory Private
  if (-not (Get-NetFirewallRule -DisplayName "Order Manager (port 3000)" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "Order Manager (port 3000)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private, Domain | Out-Null
  }
  Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } | ForEach-Object { Write-Host ("   http://{0}:3000   ({1})" -f $_.IPAddress, $_.InterfaceAlias) }
}

Write-Host ""
Write-Host "Done. Next: run install-tasks.ps1, then connect the domain (see the guide)."
