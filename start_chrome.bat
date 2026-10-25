@echo off
cd /d "%~dp0"

netstat -ano | findstr :3001 >nul
if errorlevel 1 (
    start "POS Backend Server" /min cmd /c "cd /d ""%~dp0backend"" && node server.js"
    ping 127.0.0.1 -n 3 >nul
)

netstat -ano | findstr :5173 >nul
if errorlevel 1 (
    start "POS Web Server" /min cmd /c "cd /d ""%~dp0"" && npm run dev"
    ping 127.0.0.1 -n 4 >nul
)

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:5173"
    exit /b 0
)

if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" "http://localhost:5173"
    exit /b 0
)

start "" "http://localhost:5173"
exit /b 0
