@echo off
setlocal EnableExtensions
title Rally - get ready for tomorrow
color 0B
cd /d "%~dp0"

REM ============================================================
REM  Rally / greek-life-app  -  first-run setup on the new PC
REM
REM  Installs the app's dependencies and checks everything is
REM  the right version. Does NOT start the app - use
REM  start-app.bat for that when your phone is ready.
REM
REM  Safe to run more than once.
REM  It never runs "npm update" or "npm audit fix" - those
REM  break this project.
REM ============================================================

set "LOG=%~dp0_setup-report.txt"
set "PROBLEM="

cls
echo.
echo  ============================================================
echo    Rally  -  getting your project ready
echo  ============================================================
echo.
echo    Folder: %CD%
echo.

echo ============================================================ > "%LOG%"
echo  RALLY SETUP REPORT >> "%LOG%"
echo  %DATE% %TIME% >> "%LOG%"
echo  Folder: %CD% >> "%LOG%"
echo ============================================================ >> "%LOG%"
echo. >> "%LOG%"

REM ---------- 1. right folder? ----------
if not exist "package.json" (
  echo  [X] This script is not in the Rally project folder.
  echo      It needs to sit next to package.json in D:\Dev\greek-life-app
  echo  RESULT: wrong folder - package.json not found >> "%LOG%"
  set "PROBLEM=1"
  goto :done
)
echo  [OK] Found the project.
echo  Project folder OK >> "%LOG%"

if exist ".env" (
  echo  [OK] Your .env settings file came across.
  echo  .env present OK >> "%LOG%"
) else (
  echo  [!] .env is missing - the app will run in demo mode with fake data.
  echo  .env MISSING >> "%LOG%"
  set "PROBLEM=1"
)
echo.

REM ---------- 2. is Node installed? ----------
echo  Checking for Node.js...
set "NODEV="
for /f "usebackq delims=" %%V in (`node -v 2^>nul`) do set "NODEV=%%V"
if not defined NODEV (
  echo.
  echo  [X] Node.js is NOT installed on this PC.
  echo.
  echo      Rally can't run without it. To fix:
  echo        1. Open your browser and go to    https://nodejs.org
  echo        2. Click the big green "LTS" download button
  echo        3. Run the installer, click Next / Next / Install
  echo           ^(leave every box at its default^)
  echo        4. Close this window, then double-click this file again
  echo.
  echo  RESULT: Node.js not installed >> "%LOG%"
  set "PROBLEM=1"
  goto :done
)
set "NPMV="
for /f "usebackq delims=" %%V in (`npm -v 2^>nul`) do set "NPMV=%%V"
echo  [OK] Node.js %NODEV%   npm %NPMV%
echo  Node %NODEV% / npm %NPMV% >> "%LOG%"
echo.

REM ---------- 3. install dependencies ----------
echo  ------------------------------------------------------------
echo   Installing the app's building blocks ^(node_modules^).
echo   First time takes 3-8 minutes. Lots of scrolling text is normal.
echo  ------------------------------------------------------------
echo.
call npm install --legacy-peer-deps --no-audit --no-fund
set "NPMRC=%ERRORLEVEL%"
echo.
if not "%NPMRC%"=="0" (
  echo  [X] npm install failed ^(code %NPMRC%^).
  echo  npm install FAILED code %NPMRC% >> "%LOG%"
  set "PROBLEM=1"
  goto :done
)
echo  [OK] Dependencies installed.
echo  npm install OK >> "%LOG%"
echo.

REM ---------- 4. version check ----------
echo  Checking the pinned versions...
echo. >> "%LOG%"
echo  VERSION CHECK ^(these three must not drift^) >> "%LOG%"

call :checkver expo 54.
call :checkver react 19.1.0
call :checkver react-native 0.81.5
echo.

REM ---------- 5. typecheck ----------
echo  Type-checking the code ^(proves it still compiles^)...
call npx --no-install tsc --noEmit
set "TSCRC=%ERRORLEVEL%"
if "%TSCRC%"=="0" (
  echo  [OK] Typecheck passed - no code errors.
  echo  Typecheck PASSED >> "%LOG%"
) else (
  echo  [!] Typecheck reported problems ^(code %TSCRC%^) - see the text above.
  echo      The app may still start; this is a heads-up, not a hard stop.
  echo  Typecheck issues, code %TSCRC% >> "%LOG%"
)
echo.

:done
echo. >> "%LOG%"
if defined PROBLEM (
  echo ============================================================
  echo   NOT READY - see the message above.
  echo ============================================================
  echo  OVERALL: NOT READY >> "%LOG%"
) else (
  echo ============================================================
  echo   READY FOR TOMORROW
  echo.
  echo   To start the app: double-click  start-app.bat
  echo   in this same folder, then scan the QR code with Expo Go.
  echo   Keep the phone on the same Wi-Fi as this PC.
  echo ============================================================
  echo  OVERALL: READY >> "%LOG%"
)
echo.
echo  A report was saved to _setup-report.txt in this folder.
echo.
pause
exit /b 0

REM ---------- helper: check an installed package version ----------
:checkver
set "PKG=%~1"
set "WANT=%~2"
set "GOT="
for /f "usebackq delims=" %%V in (`node -p "require('./node_modules/%PKG%/package.json').version" 2^>nul`) do set "GOT=%%V"
if not defined GOT (
  echo    [X] %PKG% is not installed
  echo    %PKG%: MISSING >> "%LOG%"
  set "PROBLEM=1"
  goto :eof
)
echo %GOT% | find "%WANT%" >nul
if errorlevel 1 (
  echo    [!] %PKG% is %GOT% - expected %WANT%
  echo    %PKG%: %GOT%  EXPECTED %WANT%  MISMATCH >> "%LOG%"
  set "PROBLEM=1"
) else (
  echo    [OK] %PKG% %GOT%
  echo    %PKG%: %GOT%  OK >> "%LOG%"
)
goto :eof
