@echo off
title Push to GitHub
cd /d "%~dp0"
echo ========================================================
echo   Nardni Gorankariyakani POS bo GitHub (Git Push)
echo ========================================================
echo.
echo Dastpekirdin...
git push origin main
echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo   [SARKAWTU BU] Hamu faylekan ba sarkawtuwi push bran!
    echo ========================================================
) else (
    echo ========================================================
    echo   [HALA RWYDAN] Tekchin rwyda la push kirdnda.
    echo ========================================================
)
echo.
pause
