$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is niet gevonden. Installeer Node.js (LTS) en probeer opnieuw."
  exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "npm is niet gevonden. Installeer Node.js (LTS) en probeer opnieuw."
  exit 1
}

if (-not (Test-Path (Join-Path $projectRoot "node_modules"))) {
  Write-Host "Dependencies installeren (eenmalig)..."
  npm install
}

Write-Host "Lokale server starten..."
Write-Host "Open daarna: http://localhost:3000/"
Write-Host "Stoppen kan met Ctrl+C in dit venster."
npm run netlify:dev
