# PhongVu Catalog Data Fetching Guide

This guide explains how to fetch real product data from PhongVu via the Teko Discovery API and cache it locally.

## Prerequisites

1. **Teko Discovery API Credentials**: You need a valid API key for the Teko Discovery API
2. **OpenClaw Configuration**: API key must be stored in `~/.openclaw/openclaw.json`

## Setup

### 1. Configure API Credentials

Create `~/.openclaw/openclaw.json`:

```json
{
  "teko_api_key": "your-api-key-here",
  "teko_api_token": "your-token-here"
}
```

### 2. Run the Fetch Script

```bash
cd packages/catalog
npm run fetch:phongvu
```

This will:
- Fetch data from the Teko Discovery API for all 8 component types
- Save results to `src/data/phongvu-catalog-<type>.json`
- Automatically retry failed pages
- Apply the PhongVu transformer to extract relevant fields

## What Gets Fetched

The script fetches real product data from PhongVu for:

- **CPU** - Processors (AM5, LGA1700, etc.)
- **Mainboard** - Motherboards (DDR4/DDR5, ATX/mATX/ITX)
- **RAM** - Memory modules (DDR4/DDR5)
- **PSU** - Power supplies (ATX/SFX, 550W-1000W+)
- **Cooler** - CPU coolers (air, AIO, multi-socket support)
- **Case** - PC cases (ATX/mATX/ITX with GPU clearance)
- **Storage** - HDDs and SSDs (fetches 2 separate API slugs)
- **GPU** - Graphics cards (TDP, length specs)

## Data Transformation

The Teko API returns raw product data. The transformer extracts:

### Shared Fields (All Types)
- `sku` - PhongVu SKU (unique identifier)
- `name` - Product name
- `price` - Price in VND (parsed from string)
- `stock_status` - "in_stock" or "out_of_stock"
- `promo` - Promotional text if available

### Type-Specific Fields

**CPU**:
- `socket` - Extracted via regex: "Socket 1700" → "1700"
- `tdp` - Thermal Design Power: "TDP: 65W" → 65

**Mainboard**:
- `socket` - Same as CPU
- `ram_gen` - DDR4 or DDR5 via regex
- `form_factor` - ATX, mATX, or ITX

**RAM**:
- `ram_gen` - DDR4 or DDR5 extracted from name/description

**PSU**:
- `wattage` - Power capacity in watts
- `form_factor` - ATX or SFX

**Cooler**:
- `socket` - Array of supported sockets: ["AM5", "AM4", "LGA1700"]
- `tdp` - Max TDP support in watts

**Case**:
- `form_factor` - ATX, mATX, or ITX
- `clearance_mm` - GPU clearance in millimeters

**Storage**:
- No type-specific fields

**GPU**:
- `tdp` - Power consumption
- `clearance_mm` - Card length in millimeters

## File Format

Each `phongvu-catalog-<type>.json` file contains an array of components in JSON format:

```json
[
  {
    "sku": "211208131",
    "name": "CPU Intel Core i5-12400",
    "type": "cpu",
    "price": 5590000,
    "stock_status": "in_stock",
    "promo": null,
    "socket": "1700",
    "tdp": 65
  },
  ...
]
```

## Runtime Behavior

Once data is cached locally:

1. `searchComponentsMock()` - Uses mock data from `src/mock-data.ts`
2. `loadCatalogByType(type)` - Loads from JSON cache, falls back to mock if missing
3. `searchComponents()` - Loads cached data + applies filters + optional live Apify fallback

## Troubleshooting

### API Key Not Found

```
❌ Error: ~/.openclaw/openclaw.json not found
```

Solution: Create `~/.openclaw/openclaw.json` with valid Teko API credentials

### API Returns Error

```
Error: API error: 401 Unauthorized
```

Solution: Check API key validity in `~/.openclaw/openclaw.json`

### No Data Fetched

If a type returns 0 products, check:
- API slug is correct (see TYPE_SLUGS in script)
- Price filter range (1.5M - 43.5M VND) contains products for that type
- API connectivity/rate limits

## Debugging

To see detailed fetch progress:

```bash
# The script logs each page fetch
npm run fetch:phongvu

# Example output:
# Fetching CPU...
#   Fetching /c/cpu page 1...
#   Fetching /c/cpu page 2...
#   ✓ Saved 120 products to src/data/phongvu-catalog-cpu.json
```

## Integration in CI/CD

To automatically fetch fresh data during builds:

```bash
# In package.json
"scripts": {
  "prebuild": "npm run fetch:phongvu || true",  // Fails gracefully if no API access
  "build": "tsc"
}
```

This ensures:
- CI environments with API access get fresh data
- CI environments without API access fall back to cached data
- Local development can fetch on demand

## Performance

- **Fetch time**: ~5-10 seconds per type (depends on API latency)
- **Total time**: ~50-80 seconds for all 8 types
- **Storage**: ~2-5 MB per type (typical), ~20-30 MB total
- **Runtime load**: <10ms to load all JSON into memory

## Next Steps

After fetching data:

1. Commit the JSON files to git
2. Run tests to validate transformer: `npm test`
3. Test search: `npm run dev` and call `searchComponentsMock()`
4. Deploy to production (search will use cached data, no runtime API calls)
