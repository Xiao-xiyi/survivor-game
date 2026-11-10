@echo off
cd /d "%~dp0"
echo ========================================
echo   Deploy: build\web-desktop  ->  docs/
echo ========================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
echo.
echo ----------------------------------------
echo   Finished. Press any key to close.
echo ----------------------------------------
pause
