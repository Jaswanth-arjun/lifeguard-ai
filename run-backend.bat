@echo off
REM Double-click this file, or in CMD:  cd /d D:\lifeguard-ai  & run-backend.bat
REM Do NOT paste this file into PowerShell — use run-backend.ps1 instead.
setlocal
cd /d "%~dp0backend"

REM Pick a Python that already has flask + sklearn (3.11 is common on student PCs)
where py >nul 2>&1 && (
  py -3.11 -c "import flask, sklearn" >nul 2>&1 && (
    echo Using: py -3.11
    py -3.11 app.py
    goto :eof
  )
  py -3 -c "import flask, sklearn" >nul 2>&1 && (
    echo Using: py -3
    py -3 app.py
    goto :eof
  )
)
python -c "import flask, sklearn" >nul 2>&1 && (
  echo Using: python
  python app.py
  goto :eof
)

echo.
echo ERROR: No working Python with Flask + scikit-learn found.
echo Run install-backend.bat first, or from PowerShell: .\install-backend.ps1
echo.
pause
exit /b 1
