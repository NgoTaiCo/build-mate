# Generate complete openclaw.json from .env for Windows

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
$MODEL_PROVIDER = $env_vars["MODEL_PROVIDER"] -or "xiaomi-token-plan/mimo-v2.5-pro"
$API_KEY = $env_vars["API_KEY"] -or ""
$SESSION_IDLE_MINUTES = $env_vars["SESSION_IDLE_MINUTES"] -or "60"
$MEMORY_BACKEND = $env_vars["MEMORY_BACKEND"] -or "qmd"
$GATEWAY_PORT = $env_vars["OPENCLAW_PORT"] -or "18789"

# Generate random token if not set
if (-not $env_vars["GATEWAY_TOKEN"]) {
    $bytes = New-Object Byte[] 24
    [Security.Cryptography.RNGCryptoServiceProvider]::new().GetBytes($bytes)
    $GATEWAY_TOKEN = -join ($bytes | ForEach-Object { "{0:x2}" -f $_ })
} else {
    $GATEWAY_TOKEN = $env_vars["GATEWAY_TOKEN"]
}

if (-not $API_KEY) {
    Write-Host "Warning: API_KEY not set in .env" -ForegroundColor Yellow
}

$config = @"
{
  "agents": {
    "defaults": {
      "workspace": "/workspace",
      "models": {
        "xiaomi/mimo-v2-flash": { "alias": "Xiaomi" },
        "xiaomi/mimo-v2-pro": {},
        "xiaomi-token-plan/mimo-v2.5-pro": { "alias": "Xiaomi MiMo V2.5 Pro" }
      },
      "model": {
        "primary": "$MODEL_PROVIDER"
      }
    }
  },
  "gateway": {
    "mode": "local",
    "auth": {
      "mode": "token",
      "token": "$GATEWAY_TOKEN"
    },
    "port": $GATEWAY_PORT,
    "bind": "loopback",
    "tailscale": {
      "mode": "off",
      "resetOnExit": false
    },
    "controlUi": {
      "allowInsecureAuth": true
    },
    "nodes": {
      "denyCommands": [
        "camera.snap",
        "camera.clip",
        "screen.record",
        "contacts.add",
        "calendar.add",
        "reminders.add",
        "sms.send",
        "sms.search"
      ]
    }
  },
  "session": {
    "dmScope": "per-channel-peer",
    "reset": {
      "mode": "idle",
      "idleMinutes": $SESSION_IDLE_MINUTES
    }
  },
  "tools": {
    "profile": "coding"
  },
  "plugins": {
    "enabled": true,
    "entries": {
      "xiaomi": {
        "enabled": true
      }
    }
  },
  "memory": {
    "backend": "$MEMORY_BACKEND"
  },
  "models": {
    "mode": "merge",
    "providers": {
      "xiaomi": {
        "baseUrl": "https://api.xiaomimimo.com/v1",
        "api": "openai-completions",
        "models": [
          {
            "id": "mimo-v2-flash",
            "name": "Xiaomi MiMo V2 Flash",
            "reasoning": false,
            "input": ["text"],
            "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
            "contextWindow": 262144,
            "maxTokens": 8192
          },
          {
            "id": "mimo-v2-pro",
            "name": "Xiaomi MiMo V2 Pro",
            "reasoning": true,
            "input": ["text"],
            "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
            "contextWindow": 1048576,
            "maxTokens": 32000
          },
          {
            "id": "mimo-v2-omni",
            "name": "Xiaomi MiMo V2 Omni",
            "reasoning": true,
            "input": ["text", "image"],
            "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
            "contextWindow": 262144,
            "maxTokens": 32000
          }
        ]
      },
      "xiaomi-token-plan": {
        "baseUrl": "https://token-plan-sgp.xiaomimimo.com/v1",
        "api": "openai-completions",
        "models": [
          {
            "id": "mimo-v2.5-pro",
            "name": "Xiaomi MiMo V2.5 Pro",
            "reasoning": true,
            "input": ["text"],
            "cost": {
              "input": 1,
              "output": 3,
              "cacheRead": 0.2,
              "cacheWrite": 0,
              "tieredPricing": [
                {"input": 1, "output": 3, "cacheRead": 0.2, "cacheWrite": 0, "range": [0, 256000]},
                {"input": 1, "output": 3, "cacheRead": 0.4, "cacheWrite": 0, "range": [256000]}
              ]
            },
            "contextWindow": 1048576,
            "maxTokens": 131072
          },
          {
            "id": "mimo-v2.5",
            "name": "Xiaomi MiMo V2.5",
            "reasoning": true,
            "input": ["text", "image"],
            "cost": {
              "input": 0.4,
              "output": 2,
              "cacheRead": 0.08,
              "cacheWrite": 0,
              "tieredPricing": [
                {"input": 0.4, "output": 2, "cacheRead": 0.08, "cacheWrite": 0, "range": [0, 256000]},
                {"input": 0.4, "output": 2, "cacheRead": 0.16, "cacheWrite": 0, "range": [256000]}
              ]
            },
            "contextWindow": 1048576,
            "maxTokens": 131072
          }
        ]
      }
    }
  },
  "auth": {
    "profiles": {
      "xiaomi:default": {
        "provider": "xiaomi",
        "mode": "api_key"
      },
      "xiaomi-token-plan:default": {
        "provider": "xiaomi-token-plan",
        "mode": "api_key"
      }
    }
  }
}
"@

Set-Content -Path "openclaw.json" -Value $config -Encoding UTF8

Write-Host "✓ openclaw.json generated" -ForegroundColor Green
Write-Host "  Model: $MODEL_PROVIDER"
Write-Host "  Gateway token: $($GATEWAY_TOKEN.Substring(0, 16))..."
Write-Host "  Session idle: ${SESSION_IDLE_MINUTES}m"
Write-Host "  Memory: $MEMORY_BACKEND"
Write-Host ""
Write-Host "Ready to start: docker compose up -d" -ForegroundColor Green
