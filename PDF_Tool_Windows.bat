@echo off
title Toolbox – PDF, Bilder und mehr — Lokaler Starter
cd /d "%~dp0"

echo ===================================================
echo   Toolbox – PDF, Bilder und mehr — Fuer Windows
echo ===================================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    python server.py
    goto end
)

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    py server.py
    goto end
)

echo [Hinweis] Python wurde nicht gefunden.
echo Oeffne das Tool direkt im Standard-Browser...
start dist\index.html

:end
