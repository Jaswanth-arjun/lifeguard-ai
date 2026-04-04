@echo off
title Lifeguard AI - start servers
echo.
echo  Starting BACKEND in a new window...
start "Lifeguard BACKEND (Flask)" cmd /k "%~dp0run-backend.bat"
timeout /t 2 /nobreak >nul
echo  Starting FRONTEND in a new window...
start "Lifeguard FRONTEND (Vite)" cmd /k "%~dp0run-frontend.bat"
echo.
echo  Easiest UI ^(no npm^): http://127.0.0.1:5000/demo/
echo  React UI: URL Vite shows ^(usually http://127.0.0.1:5173^)
echo  Backend API: http://127.0.0.1:5000
echo.
pause
