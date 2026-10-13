@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Download the LTS version from https://nodejs.org, install it, then run this file again. & start https://nodejs.org & pause & exit /b)
if not exist .env copy .env.example .env >nul
if not exist node_modules (echo Installing, please wait... & call npm install || (pause & exit /b))
if not exist data\nyl.db call npm run seed
echo.
echo Patient app:     http://localhost:3000
echo Admin dashboard: http://localhost:3000/admin   (user: admin, password: see ADMIN_PASSWORD in .env)
echo OTP codes will appear in this window. Close this window to stop the app.
echo.
start "" http://localhost:3000
call npm start
pause
