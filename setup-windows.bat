@echo off
echo [DrafterAPI] Starting Setup for Windows...
echo.

echo [DrafterAPI] Installing Server Dependencies...
cd server
call npm install
if errorlevel 1 (
    echo Failed to install server dependencies!
    pause
    exit /b 1
)
cd ..

echo [DrafterAPI] Installing Client Dependencies...
cd client
call npm install
if errorlevel 1 (
    echo Failed to install client dependencies!
    pause
    exit /b 1
)
cd ..

echo [DrafterAPI] Building Frontend...
cd client
call npm run build
if errorlevel 1 (
    echo Failed to build frontend!
    pause
    exit /b 1
)
cd ..

echo.
echo [DrafterAPI] Setup Complete!
echo.
echo 1. Generate your login key:
echo    .\DrafterApi.bat key
echo.
echo 2. Start the server:
echo    .\DrafterApi.bat
echo.
pause
