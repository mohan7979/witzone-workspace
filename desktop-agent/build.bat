@echo off
REM ============================================================
REM  Witzone Workspace Agent — Windows Build Script
REM  Run this once on any Windows PC to produce WitzoneAgent.exe
REM  Requires: Python 3.10+ installed (https://python.org)
REM ============================================================

echo === Witzone Agent Builder ===
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install from https://python.org and try again.
    pause
    exit /b 1
)

echo [1/3] Installing dependencies...
pip install -r requirements-windows.txt --quiet
if errorlevel 1 (
    echo ERROR: Failed to install dependencies.
    pause
    exit /b 1
)

echo [2/3] Building executable...
pyinstaller agent.spec --clean --noconfirm
if errorlevel 1 (
    echo ERROR: Build failed.
    pause
    exit /b 1
)

echo [3/3] Done!
echo.
echo Output: dist\WitzoneAgent.exe
echo.
echo Distribute dist\WitzoneAgent.exe to each employee laptop.
echo On first run, right-click the tray icon and choose "Login / Re-authenticate"
echo to register the employee's credentials on that machine.
echo.
pause
