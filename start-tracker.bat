@echo off
title MTG Price Tracker Launcher

echo Avvio di MTG Price Tracker...
echo ----------------------------------------

echo [1/3] Avvio del Backend (Porta 3000)...
start "MTG Backend" cmd /k "node tracker.js"

echo [2/3] Avvio del Frontend Ionic (Porta 8100)...
cd mtg-tracker
start "MTG Frontend" cmd /k "npx ionic serve --no-open"

echo [3/3] In attesa del caricamento dei servizi (5 secondi)...
timeout /t 5 /nobreak >nul

echo Apertura di Google Chrome...
start chrome "http://localhost:8100"

echo ----------------------------------------
echo Avvio completato!
echo ----------------------------------------
exit
