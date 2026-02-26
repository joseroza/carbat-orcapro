@echo off
title OrcaPro - Iniciando...
cd /d C:\orcapro-data\carbat-orcapro
echo Aguardando Docker iniciar...
timeout /t 10 /nobreak >nul
docker compose up -d
echo.
echo OrcaPro iniciado! Acesse: http://localhost:3000
timeout /t 3 /nobreak >nul
start http://localhost:3000
