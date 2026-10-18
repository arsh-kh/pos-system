@echo off
chcp 65001 >nul
title ڕێکخستنی داتابەیسی سیستەمی مارکێت - Market POS Setup
color 0a

echo ========================================================================
echo   ڕێکخستن و دروستکردنی خۆکاری داتابەیسی سیستەمی مارکێت (POS Database Setup)
echo ========================================================================
echo.
echo [1/3] پشکنینی خزمەتگوزاری داتابەیس (Checking MySQL / MariaDB)...

cd /d "%~dp0"

:: Check if MySQL is listening on port 3306
netstat -ano | findstr :3306 >nul
if %errorlevel% equ 0 (
    echo ✓ خزمەتگوزاری MySQL لەسەر پۆرتی 3306 کارایە و دۆزرایەوە.
) else (
    echo ⚠️ ئاگاداری: MySQL لەسەر پۆرتی 3306 نەدۆزرایەوە!
    echo تکایە دڵنیابە لەوەی MySQL یان MariaDB یاخود XAMPP/Laragon داگیرساوە.
    echo.
)

echo.
echo [2/3] جێبەجێکردنی هەموو خشتەکان و مەیگرەیشنەکان (Running Schema Migrations)...
cd backend
node run_all_migrations.js
if %errorlevel% neq 0 (
    echo ❌ هەڵە لە دروستکردنی خشتەکان! تکایە پاسۆردی backend/.env بپشکنە.
    pause
    exit /b 1
)

echo.
echo ========================================================================
echo  🎉 پیرۆزە! داتابەیسی سیستەمی مارکێت بە تەواوی ئامادە کرا.
echo  ئێستا دەتوانیت ئەپەکە لەسەر شاشەی سەرەکی (Desktop) بکەیتەوە.
echo ========================================================================
echo.
pause
