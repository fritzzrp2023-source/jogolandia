@echo off
cd /d "%~dp0"
title Jogarium - Teste Localhost
echo.
echo Testando a Jogarium no localhost...
echo.
echo Endereco do site:
echo http://localhost:8080
echo.
echo Painel tecnico:
echo http://localhost:8080/api/health
echo.
start "" "http://localhost:8080"
node server.js
pause
