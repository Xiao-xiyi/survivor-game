@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
echo.
echo ================================
echo  部署结束，按任意键关闭窗口
echo ================================
pause