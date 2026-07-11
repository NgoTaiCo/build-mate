# Generate openclaw.json from .env for Windows

if (-not (Test-Path ".env")) {
    Write-Host "Cannot find .env" -ForegroundColor Red
    exit 1
}

# Load .env
$env_vars = @{}
Get-Content ".env" | Where-Object { $_ -and -not $_.StartsWith("#") } | ForEach-Object {
    $parts = $_ -split "=", 2
    if ($parts.Length -eq 2) {
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()
        $env_vars[$key] = $value
    }
}

# Defaults
$MODEL_PROVIDER = $env_vars["MODEL_PROVIDER"] -or "mimo/mimo-pro"
$API_KEY = $env_vars["API_KEY"] -or ""
$SESSION_IDLE_MINUTES = $env_vars["SESSION_IDLE_MINUTES"] -or "60"
$MEMORY_BACKEND = $env_vars["MEMORY_BACKEND"] -or "qmd"

if (-not $API_KEY) {
    Write-Host "Warning: API_KEY not set in .env" -ForegroundColor Yellow
}

$config = @{
    session = @{
        dmScope = "per-channel-peer"
        reset = @{
            mode = "idle"
            idleMinutes = [int]$SESSION_IDLE_MINUTES
        }
    }
    memory = @{
        backend = $MEMORY_BACKEND
    }
    agents = @{
        defaults = @{
            model = $MODEL_PROVIDER
            workspace = "/workspace"
        }
    }
    channels = @{
        webchat = @{
            blockStreaming = $false
        }
    }
    plugins = @{
        enabled = $true
        entries = @{
            "buildmate-tools" = @{
                enabled = $false
            }
        }
    }
} | ConvertTo-Json -Depth 10

Set-Content -Path "openclaw.json" -Value $config -Encoding UTF8

Write-Host "✓ openclaw.json generated" -ForegroundColor Green
Write-Host "  Model: $MODEL_PROVIDER"
Write-Host "  Session idle: ${SESSION_IDLE_MINUTES}m"
Write-Host "  Memory: $MEMORY_BACKEND"
Write-Host ""
Write-Host "Ready to start: docker compose up -d" -ForegroundColor Green
