# Start the Prelegal backend (FastAPI) and frontend (Next.js) in the background on Windows.
# Stop them with scripts\stop.ps1.
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$RunDir = Join-Path $Root ".run"
$BackendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { "8000" }
$FrontendPort = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { "3000" }
New-Item -ItemType Directory -Force $RunDir | Out-Null

# Use uv from PATH, or fall back to the Python module (pip install uv).
if (Get-Command uv -ErrorAction SilentlyContinue) {
    $UvExe = "uv"; $UvArgs = @()
} else {
    & python -m uv --version *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "uv is required: https://docs.astral.sh/uv/getting-started/installation/"
    }
    $UvExe = "python"; $UvArgs = @("-m", "uv")
}

function Test-Running($Name) {
    $PidFile = Join-Path $RunDir "$Name.pid"
    if (-not (Test-Path $PidFile)) { return $false }
    return [bool](Get-Process -Id (Get-Content $PidFile) -ErrorAction SilentlyContinue)
}

if ((Test-Running "backend") -or (Test-Running "frontend")) {
    Write-Error "Prelegal is already running. Use scripts\stop.ps1 first."
}

function Start-Background($Name, $FilePath, [string[]]$Arguments, $WorkingDirectory) {
    $Log = Join-Path $RunDir "$Name.log"
    $Process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory `
        -RedirectStandardOutput $Log -RedirectStandardError "$Log.err" -WindowStyle Hidden -PassThru
    Set-Content -Path (Join-Path $RunDir "$Name.pid") -Value $Process.Id
}

Write-Host "Installing dependencies..."
& $UvExe @($UvArgs + @("--directory", (Join-Path $Root "backend"), "sync", "--quiet"))
if (-not (Test-Path (Join-Path $Root "frontend\node_modules"))) {
    & npm.cmd --prefix (Join-Path $Root "frontend") install --silent
}

Write-Host "Starting backend on http://localhost:$BackendPort ..."
Start-Background "backend" $UvExe ($UvArgs + @("run", "uvicorn", "app.main:app", "--reload", "--port", $BackendPort)) `
    (Join-Path $Root "backend")

Write-Host "Starting frontend on http://localhost:$FrontendPort ..."
$env:PRELEGAL_API_URL = "http://127.0.0.1:$BackendPort"
Start-Background "frontend" "npm.cmd" @("run", "dev", "--", "--port", $FrontendPort) (Join-Path $Root "frontend")

# Wait for both services to answer before reporting success.
function Wait-For($Name, $Url) {
    for ($i = 0; $i -lt 60; $i++) {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
            return
        } catch {
            if (-not (Test-Running $Name)) { break }
            Start-Sleep -Seconds 1
        }
    }
    Write-Error "The $Name did not start. See $RunDir\$Name.log and $Name.log.err"
}
Wait-For "backend" "http://127.0.0.1:$BackendPort/api/health"
Wait-For "frontend" "http://127.0.0.1:$FrontendPort/"

Write-Host "Prelegal is running at http://localhost:$FrontendPort (API at http://localhost:$BackendPort/docs)."
Write-Host "Logs are in .run\. Stop with scripts\stop.ps1."
