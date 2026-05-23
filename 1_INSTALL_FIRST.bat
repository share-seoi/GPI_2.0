@echo off
setlocal
cd /d "%~dp0"

echo.
echo ================================
echo GPI 2.0 first install
echo ================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo.
  echo Install Node.js LTS first:
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found.
  echo.
  echo Install Node.js LTS first:
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo Installing GPI dependencies...
echo This can take a few minutes the first time.
echo.
call npm install
if errorlevel 1 (
  echo.
  echo Install failed.
  echo Check the error message above.
  echo.
  pause
  exit /b 1
)

echo.
echo Install complete.
echo Next time, double-click 2_RUN_GPI.bat to start GPI.
echo.
pause
