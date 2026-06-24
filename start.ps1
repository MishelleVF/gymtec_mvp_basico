# ============================================================
# GYMTEC - Levantar Frontend (3000) + Backend (8000)
# Ejecutar desde PowerShell:  .\start.ps1
# ============================================================

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n=== GYMTEC ===" -ForegroundColor Cyan

# --- Backend FastAPI (puerto 8000) ---
Write-Host "Levantando backend en puerto 8000..." -ForegroundColor Yellow
$backend = Start-Process `
    -FilePath "$root\.venv\Scripts\python.exe" `
    -ArgumentList "-m","uvicorn","app.api.main:app","--host","0.0.0.0","--port","8000" `
    -WorkingDirectory "$root\backend" `
    -PassThru
Write-Host "  Backend PID: $($backend.Id)" -ForegroundColor Green

# --- Frontend Next.js (puerto 3000) ---
Write-Host "Levantando frontend en puerto 3000..." -ForegroundColor Yellow
$frontend = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList "run","dev","--","--port","3000" `
    -WorkingDirectory "$root\frontend" `
    -PassThru
Write-Host "  Frontend PID: $($frontend.Id)" -ForegroundColor Green

Write-Host "`nListo! Abre http://localhost:3000" -ForegroundColor Cyan
Write-Host "Para apagar: taskkill /PID $($backend.Id) /F ; taskkill /PID $($frontend.Id) /F`n"
