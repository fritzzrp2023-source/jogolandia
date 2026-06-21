@echo off
cd /d "%~dp0"
title Jogarium - Servidor Local
echo.
echo Iniciando a Jogarium...
echo.
echo Abrindo http://localhost:8080
echo Quando o site abrir, deixe esta janela aberta.
echo Para fechar o site, feche esta janela.
echo.
start "" "http://localhost:8080"
node server.js
echo.
echo O servidor foi encerrado.
pause
