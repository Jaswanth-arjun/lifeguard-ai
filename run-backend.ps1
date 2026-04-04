# PowerShell:  cd D:\lifeguard-ai  then  .\run-backend.ps1
# Do NOT paste .bat file contents here — batch syntax is not valid in PowerShell.
$backend = Join-Path $PSScriptRoot "backend"
Set-Location $backend
Write-Host "Starting Flask from: $backend" -ForegroundColor Cyan
Write-Host "Open in browser: http://127.0.0.1:5000/demo/`n" -ForegroundColor Green

if (Get-Command py -ErrorAction SilentlyContinue) {
    foreach ($ver in @("-3.11", "-3")) {
        & py $ver -c "import flask, sklearn" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Using: py $ver" -ForegroundColor Gray
            & py $ver app.py
            exit $LASTEXITCODE
        }
    }
}

& python -c "import flask, sklearn" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Using: python" -ForegroundColor Gray
    & python app.py
    exit $LASTEXITCODE
}

Write-Host "`nMissing packages for the Python that runs first in PATH." -ForegroundColor Red
Write-Host "Fix:  .\install-backend.ps1" -ForegroundColor Yellow
Write-Host "Or:   py -3.11 -m pip install -r requirements.txt --user" -ForegroundColor Yellow
exit 1
