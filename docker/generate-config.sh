#!/bin/bash
# Generate complete openclaw.json from .env variables

set -e

# Load .env
if [ ! -f .env ]; then
  echo "❌ .env not found. Run: cp .env.example .env"
  exit 1
fi

source .env

# Defaults
MODEL_PROVIDER=${MODEL_PROVIDER:-xiaomi-token-plan/mimo-v2.5-pro}
API_KEY=${API_KEY:-}
SESSION_IDLE_MINUTES=${SESSION_IDLE_MINUTES:-60}
MEMORY_BACKEND=${MEMORY_BACKEND:-qmd}
GATEWAY_TOKEN=${GATEWAY_TOKEN:-$(openssl rand -hex 24 2>/dev/null || echo "7480b2368b88d458de8fa9d00aa359bb5db5a12fa24fe21e")}
GATEWAY_PORT=${OPENCLAW_PORT:-18789}

if [ -z "$API_KEY" ]; then
  echo "⚠️  API_KEY not set in .env. Using placeholder."
fi

# Extract provider from MODEL_PROVIDER (e.g., "xiaomi/mimo-v2-pro" -> "xiaomi")
PROVIDER=$(echo "$MODEL_PROVIDER" | cut -d'/' -f1)

# Generate full config JSON
cat > openclaw.json << 'CONFIGEOF'
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
        "primary": "MODEL_PROVIDER_PLACEHOLDER"
      }
    }
  },
  "gateway": {
    "mode": "local",
    "auth": {
      "mode": "token",
      "token": "GATEWAY_TOKEN_PLACEHOLDER"
    },
    "port": GATEWAY_PORT_PLACEHOLDER,
    "bind": "auto",
    "tailscale": {
      "mode": "off",
      "resetOnExit": false
    },
    "controlUi": {
      "allowInsecureAuth": true,
      "allowedOrigins": ["*"]
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
      "idleMinutes": SESSION_IDLE_MINUTES_PLACEHOLDER
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
    "backend": "MEMORY_BACKEND_PLACEHOLDER"
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
CONFIGEOF

# Replace placeholders
sed -i.bak \
  -e "s|MODEL_PROVIDER_PLACEHOLDER|$MODEL_PROVIDER|g" \
  -e "s|GATEWAY_TOKEN_PLACEHOLDER|$GATEWAY_TOKEN|g" \
  -e "s|GATEWAY_PORT_PLACEHOLDER|$GATEWAY_PORT|g" \
  -e "s|SESSION_IDLE_MINUTES_PLACEHOLDER|$SESSION_IDLE_MINUTES|g" \
  -e "s|MEMORY_BACKEND_PLACEHOLDER|$MEMORY_BACKEND|g" \
  openclaw.json

rm -f openclaw.json.bak

echo "✓ openclaw.json generated"
echo "  Model: $MODEL_PROVIDER"
echo "  Gateway token: ${GATEWAY_TOKEN:0:16}..."
echo "  Session idle: ${SESSION_IDLE_MINUTES}m"
echo "  Memory: $MEMORY_BACKEND"
echo ""
echo "🚀 Ready to start: docker compose up -d"
