@echo off
title Orion
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sistema\orion.ps1" iniciar
if errorlevel 1 pause
timeout /t 8 >nul
