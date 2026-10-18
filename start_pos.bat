@echo off
chcp 65001 >nul
title دەستپێکردنی سیستەمی مارکێت - Market POS
color 0b
echo ========================================================
echo   سیستەمی بەڕێوەبردنی پێشکەوتووی مارکێت (POS SYSTEM)
echo   چاوەڕوان بە... دەستپێکردنی سێرڤەر و ڕووکاری کارکردن
echo ========================================================
cd /d "%~dp0"

:: 1. Launch Backend Server in background
start "POS Backend Server" /min cmd /c "cd backend && node server.js"

:: 2. Launch Electron Desktop Window
set NODE_ENV=production
start "POS Desktop" cmd /c "npx electron ."

exit
