@echo off
title Orion - trocar senha
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sistema\orion.ps1" senha
pause
