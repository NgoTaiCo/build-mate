#!/bin/bash
# Fetch real PhongVu product data from Teko Discovery API
# Usage: npm run fetch:phongvu
#
# No credentials required - Teko API endpoint is public!

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "PhongVu Catalog Fetcher"
echo "======================"
echo "ℹ Fetching from Teko Discovery API (no auth required)"
echo ""

# Run the TypeScript fetcher
cd "$PROJECT_ROOT"
npx tsx "$SCRIPT_DIR/fetch-phongvu-catalog.ts"
