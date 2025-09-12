@echo off
chcp 65001 > nul

REM Set log file
set LOG_FILE=%~dp0build_log_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%.txt
set LOG_FILE=%LOG_FILE: =0%
echo Build Log: %LOG_FILE%

REM Create log entry
echo [%date% %time%] Start building CopilotNode >> "%LOG_FILE%"

echo ========================================
echo CopilotNode Windows Auto Build Script
echo ========================================
echo.
echo [INFO] Log file: %LOG_FILE%
echo.

REM Check if virtual environment exists
if exist "venv\" (
    echo [INFO] Found existing virtual environment, checking if usable...
    echo [%date% %time%] Found existing virtual environment >> "%LOG_FILE%"
    
    REM Check if activation script exists
    if exist "venv\Scripts\activate.bat" (
        echo [INFO] Virtual environment activation script exists, testing...
        echo [%date% %time%] Testing virtual environment >> "%LOG_FILE%"
        
        REM Temporarily activate virtual environment for testing
        call venv\Scripts\activate.bat
        python -c "import sys; print('[TEST] Python path:', sys.executable)" >nul 2>&1
        
        if %errorlevel% equ 0 (
            echo [INFO] Existing virtual environment is working, skipping creation
            echo [%date% %time%] Virtual environment test passed, skipping creation >> "%LOG_FILE%"
            call venv\Scripts\deactivate.bat
            goto :skip_venv_creation
        ) else (
            echo [WARNING] Existing virtual environment is damaged, rebuilding...
            echo [%date% %time%] Virtual environment damaged, rebuilding >> "%LOG_FILE%"
            call venv\Scripts\deactivate.bat
            rmdir /s /q venv
        )
    ) else (
        echo [WARNING] Virtual environment directory exists but activation script missing, rebuilding...
        echo [%date% %time%] Virtual environment activation script missing, rebuilding >> "%LOG_FILE%"
        rmdir /s /q venv
    )
) else (
    echo [INFO] No virtual environment found, creating new one
    echo [%date% %time%] No virtual environment found, creating new >> "%LOG_FILE%"
)

REM Create virtual environment
echo [STEP 1/6] Creating virtual environment...
echo [%date% %time%] Start creating virtual environment >> "%LOG_FILE%"
python -m venv venv 2>>"%LOG_FILE%"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create virtual environment! Please check if Python is properly installed
    echo [%date% %time%] Failed to create virtual environment, error code: %errorlevel% >> "%LOG_FILE%"
    echo.
    echo [INFO] Please check log file for details: %LOG_FILE%
    echo.
    pause
    exit /b 1
)
echo [INFO] Virtual environment created successfully
echo [%date% %time%] Virtual environment created successfully >> "%LOG_FILE%"
echo.

:skip_venv_creation

REM Activate virtual environment
echo [STEP 2/6] Activating virtual environment...
echo [%date% %time%] Activating virtual environment >> "%LOG_FILE%"
call venv\Scripts\activate.bat 2>>"%LOG_FILE%"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to activate virtual environment!
    echo [%date% %time%] Failed to activate virtual environment, error code: %errorlevel% >> "%LOG_FILE%"
    echo.
    echo [INFO] Please check log file for details: %LOG_FILE%
    echo.
    pause
    exit /b 1
)
echo [INFO] Virtual environment activated
echo [%date% %time%] Virtual environment activated successfully >> "%LOG_FILE%"
echo.

REM Upgrade pip
echo [STEP 3/6] Upgrading pip...
echo [%date% %time%] Upgrading pip >> "%LOG_FILE%"
python -m pip install --upgrade pip 2>>"%LOG_FILE%"
if %errorlevel% neq 0 (
    echo [WARNING] pip upgrade failed, but continuing...
    echo [%date% %time%] pip upgrade failed, error code: %errorlevel% >> "%LOG_FILE%"
)
echo.

REM Install dependencies
echo [STEP 4/6] Installing project dependencies...
echo [%date% %time%] Installing project dependencies >> "%LOG_FILE%"
if exist "requirements.txt" (
    echo [INFO] Installing dependencies from requirements.txt...
    pip install -r requirements.txt 2>>"%LOG_FILE%"
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install project dependencies!
        echo [%date% %time%] Failed to install project dependencies, error code: %errorlevel% >> "%LOG_FILE%"
        echo.
        echo [INFO] Please check log file for details: %LOG_FILE%
        echo.
        pause
        exit /b 1
    )
    echo [INFO] Project dependencies installed successfully
    echo [%date% %time%] Project dependencies installed successfully >> "%LOG_FILE%"
) else (
    echo [WARNING] requirements.txt not found, skipping dependency installation
    echo [%date% %time%] requirements.txt not found >> "%LOG_FILE%"
)

echo [INFO] Installing PyInstaller...
echo [%date% %time%] Installing PyInstaller >> "%LOG_FILE%"
pip install pyinstaller 2>>"%LOG_FILE%"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install PyInstaller!
    echo [%date% %time%] Failed to install PyInstaller, error code: %errorlevel% >> "%LOG_FILE%"
    echo.
    echo [INFO] Please check log file for details: %LOG_FILE%
    echo.
    pause
    exit /b 1
)
echo [INFO] PyInstaller installed successfully
echo [%date% %time%] PyInstaller installed successfully >> "%LOG_FILE%"
echo.

REM Test application
echo [STEP 5/6] Testing application...
echo [%date% %time%] Start testing application >> "%LOG_FILE%"
echo [INFO] Running application import test...
timeout /t 1 /nobreak > nul
python test_import.py 2>>"%LOG_FILE%"
if %errorlevel% neq 0 (
    echo [ERROR] Application test failed! Please check if there are issues with the code
    echo [%date% %time%] Application test failed, error code: %errorlevel% >> "%LOG_FILE%"
    echo.
    echo [INFO] Please check log file for details: %LOG_FILE%
    echo.
    pause
    exit /b 1
)
echo [%date% %time%] Application test passed >> "%LOG_FILE%"
echo.

REM Execute packaging
echo [STEP 6/6] Starting to package executable...
echo [%date% %time%] Start packaging >> "%LOG_FILE%"
if exist "copilot_node.spec" (
    echo [INFO] Using existing copilot_node.spec file for packaging...
    echo [%date% %time%] Using copilot_node.spec file for packaging >> "%LOG_FILE%"
    pyinstaller copilot_node.spec --clean 2>>"%LOG_FILE%"
) else (
    echo [INFO] copilot_node.spec not found, using app.py for packaging...
    echo [%date% %time%] Using app.py for packaging >> "%LOG_FILE%"
    pyinstaller --onefile --windowed --name="CopilotNode" --add-data="web;web" --add-data="core;core" --add-data="api;api" app.py 2>>"%LOG_FILE%"
)

if %errorlevel% neq 0 (
    echo [ERROR] Packaging failed! Please check error messages
    echo [%date% %time%] Packaging failed, error code: %errorlevel% >> "%LOG_FILE%"
    echo.
    echo [INFO] Please check log file for details: %LOG_FILE%
    echo.
    pause
    exit /b 1
)
echo [%date% %time%] Packaging successful >> "%LOG_FILE%"
echo.

REM Check packaging result
if exist "dist\" (
    echo [SUCCESS] Packaging completed!
    echo [%date% %time%] Packaging completed successfully >> "%LOG_FILE%"
    echo.
    echo ========================================
    echo Packaging result:
    dir dist /b
    echo ========================================
    echo.
    echo [INFO] Executable file location: %cd%\dist\
) else (
    echo [ERROR] Packaging completed but dist directory not found
    echo [%date% %time%] Packaging completed but dist directory not found >> "%LOG_FILE%"
)

REM Clean temporary files
echo [INFO] Cleaning temporary files...
echo [%date% %time%] Cleaning temporary files >> "%LOG_FILE%"
if exist "build\" rmdir /s /q build
if exist "__pycache__\" rmdir /s /q __pycache__
if exist "*.pyc" del /q *.pyc

REM Exit virtual environment
echo [INFO] Exiting virtual environment...
echo [%date% %time%] Exiting virtual environment >> "%LOG_FILE%"
call venv\Scripts\deactivate.bat

echo [%date% %time%] Build completed >> "%LOG_FILE%"

echo.
echo ========================================
echo Build completed!
echo.
echo Usage instructions:
echo 1. Executable file is in the dist directory
echo 2. Ensure target machine has necessary system dependencies before running
echo 3. To rebuild, simply run this script again
echo 4. If errors occur, check log file: %LOG_FILE%
echo ========================================
echo.
echo Press any key to exit...
pause > nul