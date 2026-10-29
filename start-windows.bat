@echo off
title Patient App
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Download the LTS version from https://nodejs.org, install it, then run this file again. & start https://nodejs.org & pause & exit /b)
node src\check-node.js || (start https://nodejs.org & pause & exit /b)
if not exist .env copy .env.example .env >nul
if not exist node_modules (echo Installing, please wait... & call npm install || (echo. & echo Install failed - see the messages above. & pause & exit /b))
if not exist data\app.db if not exist data\nyl.db call npm run seed
echo.
echo Starting... the browser will open when the app is ready.
echo Close this window to stop the app.
echo.
set OPEN_BROWSER=1
call npm start
echo.
echo The app stopped - see the messages above.
pause
