# PowerShell:  cd D:\lifeguard-ai  then  .\install-backend.ps1
$ErrorActionPreference = "Stop"
$backend = Join-Path $PSScriptRoot "backend"
Set-Location $backend
Write-Host "Installing into user site-packages (no venv)..." -ForegroundColor Cyan

$ok = $false
if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3.11 -m pip install -r requirements.txt --user
    if ($LASTEXITCODE -eq 0) { $ok = $true }
    if (-not $ok) {
        & py -3 -m pip install -r requirements.txt --user
        if ($LASTEXITCODE -eq 0) { $ok = $true }
    }
}
if (-not $ok -and (Get-Command python -ErrorAction SilentlyContinue)) {
    & python -m pip install -r requirements.txt --user
    if ($LASTEXITCODE -eq 0) { $ok = $true }
}

if (-not $ok) {
    Write-Host "`npip failed. Free several GB on drive C: (Python installs there), then retry." -ForegroundColor Red
    exit 1
}
Write-Host "`nDone. Start server: .\run-backend.ps1" -ForegroundColor Green
Write-Host "Then open: http://127.0.0.1:5000/demo/" -ForegroundColor Green
