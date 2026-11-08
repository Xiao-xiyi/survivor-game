@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
echo.
echo 部署完成，上面就是全部输出。关掉这个窗口即可。
pause
