# Stop the Prelegal backend and frontend started by scripts\start.ps1.
$Root = Split-Path -Parent $PSScriptRoot
$RunDir = Join-Path $Root ".run"
$BackendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { "8000" }
$FrontendPort = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { "3000" }

foreach ($Name in @("frontend", "backend")) {
    $PidFile = Join-Path $RunDir "$Name.pid"
    if (Test-Path $PidFile) {
        # /T also stops the child processes started by npm and uv.
        & taskkill.exe /F /T /PID (Get-Content $PidFile) *> $null
        Remove-Item $PidFile
    }
}

# Fallback: stop whatever is still listening on the ports.
foreach ($Port in @($FrontendPort, $BackendPort)) {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object { & taskkill.exe /F /T /PID $_ *> $null }
}

Write-Host "Prelegal stopped."
