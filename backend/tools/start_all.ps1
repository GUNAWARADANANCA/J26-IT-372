# Starts everything the counter demo needs (API, bridge and web app each in its own window):
#   MongoDB (unless it already answers on port 27017), the API, the web app and - when
#   BRIDGE_DEVICE_URL is set in backend/.env - the bridge for an ESP32-CAM scale running a pull sketch.
# Parts that are already running are left alone, so it is safe to run again.
#
#   powershell -ExecutionPolicy Bypass -File backend\tools\start_all.ps1
$ErrorActionPreference = 'Stop'
$backend = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path (Split-Path -Parent $backend) 'frontend'
$python = Join-Path $backend '.venv\Scripts\python.exe'
$local = Join-Path $env:USERPROFILE 'PostAssist'  # not under AppData: packaged apps get a private copy of it

function Test-Port([int]$port) {
    $client = New-Object Net.Sockets.TcpClient
    try { $client.Connect('127.0.0.1', $port); return $true } catch { return $false } finally { $client.Close() }
}

function Wait-Port([int]$port, [string]$name) {
    foreach ($i in 1..40) { if (Test-Port $port) { return }; Start-Sleep -Milliseconds 500 }
    throw "$name did not start (port $port) - look at its window for the error"
}

function Start-Window([string]$title, [string]$dir, [string]$command) {
    # -EncodedCommand keeps paths with spaces intact
    $script = "`$Host.UI.RawUI.WindowTitle = '$title'; $command"
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
    Start-Process powershell -WorkingDirectory $dir -ArgumentList '-NoExit', '-EncodedCommand', $encoded
}

if (-not (Test-Path $python)) { throw "backend\.venv is missing - follow Documents\Setup_and_Run_Guide.md section 2 first" }

# 1. MongoDB: the Windows service, mongod on PATH, or the portable copy under %LOCALAPPDATA%\PostAssist
if (Test-Port 27017) {
    'MongoDB    already running'
} else {
    $service = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
    if ($service) {
        Start-Service MongoDB
    } else {
        $found = Get-Command mongod -ErrorAction SilentlyContinue
        $mongod = if ($found) { $found.Source } else { Join-Path $local 'mongodb\bin\mongod.exe' }
        if (-not (Test-Path $mongod)) { throw "MongoDB is not installed - see Documents\Setup_and_Run_Guide.md section 1" }
        $data = Join-Path $local 'mongo-data'
        New-Item -ItemType Directory -Force $data | Out-Null
        # Started through WMI so it has no console: a database must not stop because a terminal window closed.
        $line = "`"$mongod`" --dbpath `"$data`" --bind_ip 127.0.0.1 --port 27017 --logpath `"$local\mongod.log`" --logappend"
        Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $line } | Out-Null
    }
    Wait-Port 27017 'MongoDB'
    'MongoDB    started'
}

# 2. API (all interfaces, so the phone app can reach it)
if (Test-Port 8000) {
    'API        already running'
} else {
    Start-Window 'PostAssist - API' $backend "& '$python' -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
    Wait-Port 8000 'The API'
    'API        started'
}

# 3. Bridge for a pull-sketch scale
$deviceUrl = ''
foreach ($line in Get-Content (Join-Path $backend '.env') -ErrorAction SilentlyContinue) {
    if ($line -match '^\s*BRIDGE_DEVICE_URL\s*=\s*(\S+)') { $deviceUrl = $Matches[1] }
}
if (-not $deviceUrl) {
    'Bridge     not needed (BRIDGE_DEVICE_URL is empty)'
} elseif (Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" | Where-Object { $_.CommandLine -like '*device_bridge.py*' }) {
    'Bridge     already running'
} else {
    Start-Window 'PostAssist - scale bridge' $backend "& '$python' tools\device_bridge.py"
    "Bridge     started for $deviceUrl"
}

# 4. Web app
if (Test-Port 5173) {
    'Web app    already running'
} else {
    Start-Window 'PostAssist - web app' $frontend 'npm run dev'
    Wait-Port 5173 'The web app'
    'Web app    started'
}

''
'Open https://localhost:5173  (counter2 for the counter and the IoT scale page)'
'Stop a part with Ctrl+C in its window. MongoDB runs in the background: stop it with  taskkill /IM mongod.exe'
