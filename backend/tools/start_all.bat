@echo off
rem Starts MongoDB, the API, the scale bridge and the web app, each in its own window.
rem Double-click this file, or run it from any terminal. No PowerShell needed.
rem Close a window (or press Ctrl+C in it) to stop that part.
setlocal
set "BACKEND=%~dp0.."
set "FRONTEND=%~dp0..\..\frontend"
set "MONGOD=%USERPROFILE%\PostAssist\mongodb\bin\mongod.exe"
set "MONGODATA=%USERPROFILE%\PostAssist\mongo-data"

if not exist "%BACKEND%\.venv\Scripts\python.exe" (
  echo backend\.venv is missing - follow Documents\Setup_and_Run_Guide.md section 2 first.
  pause
  exit /b 1
)

rem 1. MongoDB (skipped when something already listens on port 27017)
netstat -ano | findstr /c:":27017 " | findstr LISTENING >nul
if errorlevel 1 (
  if not exist "%MONGOD%" (
    echo MongoDB not found at %MONGOD% - start your own MongoDB, then run this again.
    pause
    exit /b 1
  )
  if not exist "%MONGODATA%" mkdir "%MONGODATA%"
  start "PostAssist - MongoDB" "%MONGOD%" --dbpath "%MONGODATA%" --bind_ip 127.0.0.1 --port 27017
  timeout /t 4 /nobreak >nul
) else (
  echo MongoDB already running
)

rem 2. API
netstat -ano | findstr /c:":8000 " | findstr LISTENING >nul
if errorlevel 1 (
  start "PostAssist - API" /d "%BACKEND%" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
  timeout /t 4 /nobreak >nul
) else (
  echo API already running
)

rem 3. Bridge for the ESP32 scale (only when BRIDGE_DEVICE_URL is set in backend\.env)
findstr /r /c:"^BRIDGE_DEVICE_URL=http" "%BACKEND%\.env" >nul 2>&1
if not errorlevel 1 (
  start "PostAssist - scale bridge" /d "%BACKEND%" cmd /k ".venv\Scripts\python.exe tools\device_bridge.py"
)

rem 4. Web app
netstat -ano | findstr /c:":5173 " | findstr LISTENING >nul
if errorlevel 1 (
  start "PostAssist - web app" /d "%FRONTEND%" cmd /k "npm run dev"
) else (
  echo Web app already running
)

echo.
echo Open http://localhost:5173 in your browser.
timeout /t 6 >nul
