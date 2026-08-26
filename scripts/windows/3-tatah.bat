@echo off
REM ===================================================================
REM  3-tatah.bat — ЖИНХЭНЭ таталт. Task Scheduler ч энэ файлыг дуудна.
REM
REM  ⚠️ `pause` ЭНД БАЙХГҮЙ. Хуваарьт даалгавар «товч дар» гэж хүлээвэл
REM  цонх мөнхөд нээлттэй үлдэж, дараагийн ажиллалт «өмнөх нь дуусаагүй»
REM  гээд алгасна — таталт чимээгүй зогсоно.
REM
REM  Task Scheduler → Actions → Start a program:
REM      Program/script : C:\konica\3-tatah.bat
REM      Add arguments  : (хоосон)
REM      Start in       : C:\konica
REM ===================================================================

chcp 65001 >nul
set PYTHONIOENCODING=utf-8

cd /d "%~dp0"

python nas-sync.py --config "%~dp0nas-sync.env"

REM Гарах кодыг Task Scheduler-т дамжуулна: 0 = амжилттай, 1 = алдаа,
REM 2 = тохиргоо буруу. `Last Run Result` баганад ингэж харагдана.
exit /b %ERRORLEVEL%
