@echo off
REM Double-click this file, or in CMD:  cd /d D:\lifeguard-ai  & install-backend.bat
REM Do NOT paste this file into PowerShell — use install-backend.ps1 instead.
cd /d "%~dp0backend"
echo Installing backend packages (no venv, --user)...

where py >nul 2>&1 && (
  py -3.11 -m pip install -r requirements.txt --user
  if not errorlevel 1 goto :ok
  py -3 -m pip install -r requirements.txt --user
  if not errorlevel 1 goto :ok
)
python -m pip install -r requirements.txt --user
if not errorlevel 1 goto :ok

echo.
echo pip failed. Free disk space on C: and retry.
pause
exit /b 1

:ok
echo.
echo Done. Double-click run-backend.bat or run: .\run-backend.ps1
echo Then open: http://127.0.0.1:5000/demo/
pause
