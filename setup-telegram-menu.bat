@echo off
setlocal

cd /d "%~dp0"

set "CONFIG_FILE=%~dp0telegram-menu.config.local.bat"

echo.
echo Telegram Mini App menu setup
echo ============================
echo.
echo Settings are saved only in telegram-menu.config.local.bat on this computer.
echo.

if exist "%CONFIG_FILE%" (
  set "USE_SAVED=Y"
  set /p USE_SAVED=Use saved settings? [Y/n]:
  if /i not "%USE_SAVED%"=="N" (
    call "%CONFIG_FILE%"
    set "SAVED_SETTINGS_LOADED=1"
  )
)

if "%BOT_TOKEN%"=="" (
  for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "$s = Read-Host 'Paste Telegram bot token' -AsSecureString; $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "BOT_TOKEN=%%A"
)

if "%BOT_TOKEN%"=="" (
  echo.
  echo Bot token is empty.
  pause
  exit /b 1
)

echo.
if "%WEB_APP_URL%"=="" (
  set /p WEB_APP_URL=Paste GitHub Pages HTTPS URL:
)

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
if "%TRUSTED_TELEGRAM_USER_IDS%"=="" if not "%SAVED_SETTINGS_LOADED%"=="1" (
  set /p TRUSTED_TELEGRAM_USER_IDS=Trusted user IDs:
)

call :save_config

echo.
echo Opening web app in fullscreen browser window...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-webapp-fullscreen.ps1" -Url "%WEB_APP_URL%"

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
set "SAVED_SETTINGS_LOADED="
pause
exit /b %RESULT%

:save_config
(
  echo @echo off
  echo set "BOT_TOKEN=%BOT_TOKEN%"
  echo set "WEB_APP_URL=%WEB_APP_URL%"
  echo set "TRUSTED_TELEGRAM_USER_IDS=%TRUSTED_TELEGRAM_USER_IDS%"
) > "%CONFIG_FILE%"
echo.
echo Settings saved to telegram-menu.config.local.bat
exit /b 0
