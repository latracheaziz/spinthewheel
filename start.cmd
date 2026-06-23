@echo off
title Spin The Wheel Launcher
echo ===================================================
echo   Demarrage de l'application Spin The Wheel
echo ===================================================

echo [1/2] Lancement du backend dans une nouvelle fenetre...
start "Spin The Wheel - Backend" cmd /k "cd backend && npm install && npm run dev"

echo [2/2] Lancement du frontend dans une nouvelle fenetre...
start "Spin The Wheel - Frontend" cmd /k "cd frontend && npm install && npm run dev"

echo.
echo L'application est en cours de demarrage !
echo.
echo - Backend  : http://localhost:5000
echo - Frontend : http://localhost:5175 (ou 5173/5174)
echo.
echo Vous pouvez fermer cette fenetre principale.
echo ===================================================
pause
