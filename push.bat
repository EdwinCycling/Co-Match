@echo off
:: Ga naar de juiste projectmap (vervang dit pad als het script elders staat)
cd /d "C:\Users\Edwin\Documents\Apps\co-match"

echo === 1. Wijzigingen verzamelen ===
git add .

echo.
echo === 2. Wijzigingen opslaan (Commit) ===
:: Dit maakt een automatische melding met de huidige datum en tijd
for /f "tokens=2 delims==" %%i in ('wmic os get localdatetime /value') do set dt=%%i
set datetime=%dt:~0,4%-%dt:~4,2%-%dt:~6,2% %dt:~8,2%:%dt:~10,2%
git commit -m "Automatische update via script - %datetime%"

echo.
echo === 3. Pushing naar GitHub ===
git push origin main

echo.
echo === Klaar! Drukt op een toets om af te sluiten ===
pause