@echo off
REM Test script to verify reset functionality without actually resetting

echo.
echo ====================================
echo Testing Reset Script Setup
echo ====================================
echo.

REM Check Node.js version
echo Checking Node.js version:
node --version
echo.

REM Check if backend directory exists
if exist "backend\" (
    echo [OK] Backend directory found
) else (
    echo [ERROR] Backend directory not found
    exit /b 1
)

REM Check if .env exists
if exist "backend\.env" (
    echo [OK] .env file found
) else (
    echo [ERROR] .env file not found
    exit /b 1
)

REM Check if package.json has reset:data script
findstr /M "reset:data" backend\package.json >nul
if %errorlevel% equ 0 (
    echo [OK] reset:data script found in package.json
) else (
    echo [ERROR] reset:data script not found in package.json
    exit /b 1
)

REM Check if reset script exists
if exist "backend\scripts\resetProductionData.js" (
    echo [OK] resetProductionData.js script found
) else (
    echo [ERROR] resetProductionData.js script not found
    exit /b 1
)

echo.
echo ====================================
echo To run the actual reset:
echo ====================================
echo.
echo   cd backend
echo   npm install  (if not done)
echo   $env:RESET_CONFIRM='YES'; npm run reset:data
echo.
echo WARNING: This will delete all data except 2 admin accounts!
echo.
