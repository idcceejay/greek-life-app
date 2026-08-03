@echo off
title Rally
cd /d "%~dp0"
echo ============================================
echo  Rally - first-time setup + start
echo ============================================
echo Checking dependencies ^(first run takes a few minutes^)...
call npm install --legacy-peer-deps --no-audit --no-fund
echo.
echo Starting Expo... scan the QR code with the Expo Go app on your phone.
echo Press Ctrl+C twice to stop.
echo.
call npx expo start -c
pause
 
 