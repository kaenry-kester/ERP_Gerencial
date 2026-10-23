@echo off
title Orion - fechar
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sistema\orion.ps1" parar
timeout /t 5 >nul
