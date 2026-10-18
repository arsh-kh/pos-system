@echo off
chcp 65001 >nul
title دەستپێکردنی سیستەمی مارکێت - Market POS
color 0b
echo ========================================================
echo   سیستەمی بەڕێوەبردنی پێشکەوتووی مارکێت (POS SYSTEM)
echo   دەستپێکردنی سێرڤەر و ڕووکاری کارکردن...
echo ========================================================
cd /d "%~dp0"

:: 1. Launch Backend Server in background if not already active
netstat -ano | findstr :3001 >nul
if %errorlevel% neq 0 (
    start "POS Backend Server" /min cmd /c "cd backend && node server.js"
)

:: 2. Launch Desktop Application (Prefers compiled executable, fallbacks to npx electron)
if exist "release\win-unpacked\MarketPOS.exe" (
    start "" "release\win-unpacked\MarketPOS.exe"
) else (
    set NODE_ENV=production
    start "POS Desktop" cmd /c "npx electron ."
)

exit
