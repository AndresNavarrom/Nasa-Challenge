<#
Earth Jukebox demo launcher (Windows PowerShell 5.1 or later).

  .\run-demo.ps1            start the app and open http://127.0.0.1:8080
  .\run-demo.ps1 -Build     rebuild the app image first (NEEDS INTERNET)
  .\run-demo.ps1 -Stop      stop the app
  .\run-demo.ps1 -NoOpen    start it without opening the browser

Without -Build it never touches the network: it runs the app image already
built on this machine (docker compose build app), so it works with the network
cable unplugged (FR2, NFR1). macOS, Linux and Git Bash: run-demo.sh.

If Windows refuses to run scripts:
  powershell -ExecutionPolicy Bypass -File .\run-demo.ps1
#>
param(
    [switch]$Build,
    [switch]$Stop,
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
$Url = 'http://127.0.0.1:8080'
$Image = 'earth-jukebox-app:latest'
$TimeoutSeconds = 30

Set-Location -Path $PSScriptRoot

function Fail([string]$Message) {
    Write-Host "run-demo: $Message" -ForegroundColor Red
    exit 1
}

# Runs a docker command, hiding its output; returns $true when it exits with 0.
function Test-Docker([string[]]$Arguments) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & docker @Arguments *> $null
        return ($LASTEXITCODE -eq 0)
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Test-Answering {
    try {
        $response = Invoke-WebRequest -Uri "$Url/" -UseBasicParsing -TimeoutSec 1
        return ($response.StatusCode -eq 200)
    } catch {
        return $false
    }
}

if ($null -eq (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail 'Docker is not installed. Install Docker Desktop, then run this again.'
}
if (-not (Test-Docker @('info'))) {
    Fail 'Docker is not running. Start Docker Desktop, wait until it says it is running, then run this again.'
}

if ($Stop) {
    Test-Docker @('compose', 'down') | Out-Null
    Write-Host 'Earth Jukebox stopped.'
    exit 0
}

if ($Build) {
    Write-Host 'Building the app image (needs internet)...'
    & docker compose build app
    if ($LASTEXITCODE -ne 0) { Fail 'the app image did not build (see above).' }
} elseif (-not (Test-Docker @('image', 'inspect', $Image))) {
    Fail 'the app image is not built on this machine. While you still have internet, run: .\run-demo.ps1 -Build'
}

if (Test-Answering) {
    $running = (& docker compose ps --status running --services 2>$null) -contains 'app'
    if ($running) {
        Write-Host "Earth Jukebox is already running on $Url"
    } else {
        Fail 'something else is already using port 8080. Close it (or run .\run-demo.ps1 -Stop) and try again.'
    }
} else {
    $clock = [System.Diagnostics.Stopwatch]::StartNew()
    # --no-build and --pull never: start only what is on this machine, never the network.
    if (-not (Test-Docker @('compose', 'up', '-d', '--no-build', '--pull', 'never', 'app'))) {
        Fail 'the app container did not start. See: docker compose logs app'
    }
    while (-not (Test-Answering)) {
        if ($clock.Elapsed.TotalSeconds -gt $TimeoutSeconds) {
            & docker compose logs --tail 20 app
            Fail "the app did not answer within $TimeoutSeconds s (log above)."
        }
        Start-Sleep -Milliseconds 100
    }
    $seconds = [math]::Round($clock.Elapsed.TotalSeconds, 1)
    Write-Host "Earth Jukebox is ready on $Url (started in $seconds s)" -ForegroundColor Green
}

if (-not $NoOpen) {
    Start-Process $Url
}

Write-Host 'Stop it with: .\run-demo.ps1 -Stop'
