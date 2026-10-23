@echo off
title Orion - restaurar copia
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sistema\orion.ps1" restaurar
pause
