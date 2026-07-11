#!/bin/bash
# Fetch real PhongVu product data from Teko Discovery API
# Usage: npm run fetch:phongvu
#
# Supports multiple credential sources (in order):
#   1. TEKO_API_KEY environment variable
#   2. ~/.openclaw/openclaw.json (OpenClaw config)
#   3. .teko-credentials file (project-specific)

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "PhongVu Catalog Fetcher"
echo "======================"
echo ""

# Check if any credential source is available
if [ -z "$TEKO_API_KEY" ] && [ ! -f "$HOME/.openclaw/openclaw.json" ] && [ ! -f "$PROJECT_ROOT/.teko-credentials" ]; then
    echo "❌ Error: No Teko API credentials found"
    echo ""
    echo "Set credentials via ONE of:"
    echo "  1. Environment variable:"
    echo "     export TEKO_API_KEY='your-api-key-here'"
    echo "     npm run fetch:phongvu"
    echo ""
    echo "  2. OpenClaw config:"
    echo "     mkdir -p ~/.openclaw"
    echo "     cat > ~/.openclaw/openclaw.json << 'EOF'"
    echo "     { \"teko_api_key\": \"your-api-key-here\" }"
    echo "     EOF"
    echo ""
    echo "  3. Project credentials file:"
    echo "     echo 'your-api-key-here' > .teko-credentials"
    echo "     (This file is in .gitignore, safe for local development)"
    exit 1
fi

# Show which credential source is being used
if [ -n "$TEKO_API_KEY" ]; then
    echo "ℹ Using TEKO_API_KEY from environment"
elif [ -f "$HOME/.openclaw/openclaw.json" ]; then
    echo "ℹ Using credentials from ~/.openclaw/openclaw.json"
elif [ -f "$PROJECT_ROOT/.teko-credentials" ]; then
    echo "ℹ Using credentials from .teko-credentials"
fi
echo ""

# Run the TypeScript fetcher
cd "$PROJECT_ROOT"
npx tsx "$SCRIPT_DIR/fetch-phongvu-catalog.ts"
