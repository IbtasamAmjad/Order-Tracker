@echo off
rem Starts Custom Order Manager and starts it again if it ever stops.
rem Run by the scheduled task "OrderManager Server" (see install-tasks.ps1), or double-click it to run by hand.
rem Everything it prints goes to deploy\windows\server.log
cd /d "%~dp0..\.."
set NODE_ENV=production
:run
echo [%date% %time%] Starting Custom Order Manager... >> "%~dp0server.log"
call npm run start -- -H 0.0.0.0 -p 3000 >> "%~dp0server.log" 2>&1
echo [%date% %time%] The server stopped. Starting again in 5 seconds... >> "%~dp0server.log"
timeout /t 5 /nobreak >nul
goto run
