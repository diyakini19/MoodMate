@echo off
cd /d "%~dp0"
start "MoodMate Server" cmd /k "cd server && npm start"
start "MoodMate Client" cmd /k "cd client && npm run dev"
timeout /t 5 /nobreak >nul
start "" http://localhost:5173
