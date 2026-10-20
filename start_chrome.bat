@echo off
chcp 65001 >nul
title دەستپێکردنی سیستەمی مارکێت لە وێب - Market POS Web
color 0b
echo ========================================================
echo   سیستەمی بەڕێوەبردنی پێشکەوتووی مارکێت (POS SYSTEM)
echo   دەستپێکردنی سێرڤەر و کردنەوەی سیستم لە Chrome...
echo ========================================================
cd /d "%~dp0"

:: 1. Launch Backend Server in background if not already active
netstat -ano | findstr :3001 >nul
if %errorlevel% neq 0 (
    echo [1/3] سێرڤەری باکئەند دەستی پێکرد لەسەر پۆرتی 3001...
    start "POS Backend Server" /min cmd /c "cd backend && node server.js"
    timeout /t 2 /nobreak >nul
) else (
    echo [1/3] سێرڤەری باکئەند ئامادەیە (پۆرتی 3001).
)

:: 2. Launch Vite Web Dev Server if not already active
netstat -ano | findstr :5173 >nul
if %errorlevel% neq 0 (
    echo [2/3] ڕووکاری وێب (Vite) دەستی پێکرد لەسەر پۆرتی 5173...
    start "POS Web Server" /min cmd /c "npm run dev"
    timeout /t 3 /nobreak >nul
) else (
    echo [2/3] ڕووکاری وێب ئامادەیە (پۆرتی 5173).
)

:: 3. Launch Google Chrome
echo [3/3] کردنەوە لە ناو گووگڵ کرۆم...
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:5173"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" "http://localhost:5173"
) else (
    start "" "http://localhost:5173"
)

echo سەرکەوتووانە لە گووگڵ کرۆم کرایەوە!
exit
