@echo off
REM ===================================================================
REM  2-turshih.bat — юу татахыг ХАРУУЛНА, файл татахгүй (--dry-run).
REM
REM  1-shalgah.bat амжилттай болсны дараа үүнийг ажиллуул. Жагсаалт
REM  зөв харагдвал 3-tatah.bat руу шилжинэ.
REM ===================================================================

chcp 65001 >nul
set PYTHONIOENCODING=utf-8

cd /d "%~dp0"

python nas-sync.py --config "%~dp0nas-sync.env" --dry-run

echo.
pause
