@echo off
setlocal

cd /d "%~dp0"

echo.
echo Telegram Mini App menu setup
echo ============================
echo.
echo This script does not save your bot token to any project file.
echo.

for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "$s = Read-Host 'Paste Telegram bot token' -AsSecureString; $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "BOT_TOKEN=%%A"

if "%BOT_TOKEN%"=="" (
  echo.
  echo Bot token is empty.
  pause
  exit /b 1
)

echo.
set /p WEB_APP_URL=Paste GitHub Pages HTTPS URL:

if "%WEB_APP_URL%"=="" (
  echo.
  echo Web App URL is empty.
  pause
  exit /b 1
)

echo %WEB_APP_URL% | findstr /b /c:"https://" >nul
if errorlevel 1 (
  echo.
  echo Web App URL must start with https://
  pause
  exit /b 1
)

echo.
echo Paste trusted Telegram user IDs separated by comma.
echo Leave empty only for testing.
set /p TRUSTED_TELEGRAM_USER_IDS=Trusted user IDs:

if not exist "node_modules" (
  echo.
  echo Installing npm dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo.
call npm.cmd run telegram:menu
set "RESULT=%ERRORLEVEL%"

echo.
if "%RESULT%"=="0" (
  echo Done. Telegram bot menu button was updated.
) else (
  echo Failed. Check the error above.
  set "BOT_TOKEN="
  set "WEB_APP_URL="
  set "TRUSTED_TELEGRAM_USER_IDS="
  pause
  exit /b %RESULT%
)

echo.
echo Starting local Telegram bot.
echo Keep this window open. Press Ctrl+C to stop the bot.
echo.
call npm.cmd run telegram:bot
set "RESULT=%ERRORLEVEL%"

set "BOT_TOKEN="
set "WEB_APP_URL="
set "TRUSTED_TELEGRAM_USER_IDS="
pause
exit /b %RESULT%
