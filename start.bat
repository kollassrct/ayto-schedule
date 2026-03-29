@echo off
echo =====================================================
echo   MRCE Smart Timetable Manager
echo   Python Flask + SQLite
echo =====================================================
echo.

echo [1/2] Installing Flask...
pip install flask
if %errorlevel% neq 0 (
    echo ERROR: pip install failed. Make sure Python is installed.
    pause
    exit /b 1
)

echo.
echo [2/2] Starting server...
echo.
echo   Open browser: http://localhost:5000
echo.
python app.py
pause
