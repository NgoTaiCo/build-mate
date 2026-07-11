#!/bin/bash
# Generate openclaw.json from .env variables

set -e

# Load .env
if [ ! -f .env ]; then
  echo "❌ .env not found. Run: cp .env.example .env"
  exit 1
fi

source .env

# Defaults
MODEL_PROVIDER=${MODEL_PROVIDER:-mimo/mimo-pro}
API_KEY=${API_KEY:-}
SESSION_IDLE_MINUTES=${SESSION_IDLE_MINUTES:-60}
MEMORY_BACKEND=${MEMORY_BACKEND:-qmd}

if [ -z "$API_KEY" ]; then
  echo "⚠️  API_KEY not set in .env. Using placeholder."
  echo "   Edit .env and run: bash generate-config.sh"
fi

cat > openclaw.json << EOF
{
  "session": {
    "dmScope": "per-channel-peer",
    "reset": {
      "mode": "idle",
      "idleMinutes": $SESSION_IDLE_MINUTES
    }
  },
  "memory": {
    "backend": "$MEMORY_BACKEND"
  },
  "agents": {
    "defaults": {
      "model": "$MODEL_PROVIDER",
      "workspace": "/workspace"
    }
  },
  "channels": {
    "webchat": {
      "blockStreaming": false
    }
  },
  "plugins": {
    "enabled": true,
    "entries": {
      "buildmate-tools": {
        "enabled": false
      }
    }
  }
}
EOF

echo "✓ openclaw.json generated"
echo "  Model: $MODEL_PROVIDER"
echo "  Session idle: ${SESSION_IDLE_MINUTES}m"
echo "  Memory: $MEMORY_BACKEND"
echo ""
echo "🚀 Ready to start: docker compose up -d"
