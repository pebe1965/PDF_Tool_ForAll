@echo off
title PDF Tool ForAll — Lokaler Starter
cd /d "%~dp0"

echo ===================================================
echo   PDF Tool ForAll — Fuer Windows
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
