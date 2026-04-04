@echo off
setlocal
cd /d "%~dp0frontend"

if not exist "node_modules\" (
  echo Installing npm packages ^(first run only^)...
  call npm install --legacy-peer-deps
  if errorlevel 1 (
    echo npm install failed. Free disk space and try again.
    pause
    exit /b 1
  )
)

echo Starting Vite dev server...
call npm run dev
pause
