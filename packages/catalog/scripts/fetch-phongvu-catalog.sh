#!/bin/bash
# Fetch real PhongVu product data from Teko Discovery API
# Usage: npm run fetch:phongvu

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "PhongVu Catalog Fetcher"
echo "======================"
echo ""

# Check if API token is configured
if [ ! -f "$HOME/.openclaw/openclaw.json" ]; then
    echo "❌ Error: ~/.openclaw/openclaw.json not found"
    echo ""
    echo "Please configure your Teko API credentials:"
    echo "  1. Create ~/.openclaw/openclaw.json"
    echo "  2. Add: { \"teko_api_key\": \"your-api-key-here\" }"
    exit 1
fi

echo "Using API config from ~/.openclaw/openclaw.json"
echo ""

# Run the TypeScript fetcher
cd "$PROJECT_ROOT"
npx tsx "$SCRIPT_DIR/fetch-phongvu-catalog.ts"
