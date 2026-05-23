$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot

function Require-Command($Name, $InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "Missing command: $Name" -ForegroundColor Red
    Write-Host $InstallHint
    exit 1
  }
}

Require-Command "node" "Install Node.js first, then reopen PowerShell."
Require-Command "npm" "Install Node.js first, then reopen PowerShell."

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "node_modules"))) {
  Write-Host "Installing dependencies..." -ForegroundColor Cyan
  npm install
}

Write-Host ""
Write-Host "Starting GPI 2.0..." -ForegroundColor Green
Write-Host "The browser will open automatically."
npm run dev -- --open
