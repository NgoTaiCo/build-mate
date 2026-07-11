# Research Phase: Catalog Adapter Architecture

**Phase 0 Output** | **Date**: 2026-07-11

## Research Summary

All major architectural decisions were clarified in Session 2026-07-07 and are documented in the feature specification. This research consolidates those findings and confirms the approach.

## Key Decisions

### 1. Two-Tier Data Architecture (UPDATED)

**Decision**: Pre-fetched real PhongVu data (via Teko Discovery API) cached as JSON files + optional live API fallback.

**Rationale**: 
- PhongVu.vn is the authoritative retail catalog; Teko Discovery API provides direct access to real product data.
- Pre-fetching at build time and caching as JSON ensures: fast startup, no runtime API calls, deterministic behavior, offline capability.
- Per-category fallback (if live API call fails at runtime, reverts to cached JSON) ensures robustness without complexity.
- Matches hackathon time-box (16h): pre-fetch 8 component types once, cache permanently, no runtime scraping needed.

**API Details**:
- Endpoint: `https://discovery.tekoapis.com/api/v2/search-skus-v2`
- Method: POST with bearer token (provided via `~/.openclaw/openclaw.json`)
- Request body: component type slug (e.g., `/c/cpu`), price range, page size
- Response: `data.products[]` array with real PhongVu product listings

**Data Flow**:
1. **Build time**: Crawl PhongVu API for each component type, extract canonical fields, save to `src/data/phongvu-catalog-<type>.json`
2. **Runtime**: Load pre-fetched JSON files (deterministic, fast)
3. **Fallback**: If live API available, optionally update cached data; if unavailable, use cached version

**Alternatives Considered**:
- Pure hardcoded mock (no real data): Less realistic; rejected to use real PhongVu products.
- Real-time API calls only (no cache): Adds latency, requires token, breaks offline; rejected for hackathon.
- Database: Out of scope for 16h time-box; rejected.

### 2. Search Criteria & Filtering Logic

**Decision**: Multi-criteria AND logic with optional fields. Support: `type`, `socket`, `ram_gen`, `form_factor`, `price_min`, `price_max`, `stock_status`, `clearance_mm`, `tdp_min`, `tdp_max`, `wattage_min`, `wattage_max`.

**Rationale**: 
- Build Compiler calls search once per component type with combined criteria (socket + RAM gen + stock + price).
- AND logic prevents false positives (no incompatible components returned).
- Optional fields (omitted = ignore) simplifies API and supports partial searches.

**Alternatives Considered**:
- Complex query language (GraphQL, SQL): Overkill; simple object API sufficient.
- Pagination: Catalog is ~50 mock + hundreds live; full return acceptable for Compiler use case.

### 3. Case Form Factor Matching

**Decision**: Hierarchical matching for case `form_factor` (ATX ≥ mATX ≥ ITX); exact match for mainboard.

**Rationale**: 
- ATX cases physically fit smaller builds (mATX/ITX mainboards); mATX cases fit ITX.
- Mainboard form factor is deterministic (immutable in spec); no hierarchy needed.
- Compiler needs to match physical constraints: if customer picks ITX mainboard, only ITX cases qualify; if ATX mainboard, ATX + anything larger.

**Alternatives Considered**:
- All exact match: Overly restrictive; ATX cases are wasted if mainboard is mATX.
- Always return all sizes: Allows physical incompatibilities (ITX mainboard in ATX case = waste).

### 4. Live Search Ordering

**Decision**: Price ascending (cheapest first) for live Apify results; deterministic (stable sort) for mock.

**Rationale**: 
- Retail users prioritize budget; lowest price per component maximizes build accessibility.
- Mock data ordering is fixed by pre-defined dataset; same criteria always produce same result.
- Live data changes; sorting ensures consistent UX across sessions.

**Alternatives Considered**:
- Relevance/rating-based: Not available from Apify scrape; too expensive to add.
- No sort: Apify results vary unpredictably; confusing for users.

### 5. Cooler Multi-Socket Support

**Decision**: `socket` field is array of strings (e.g., `["AM5", "AM4", "LGA1700"]`).

**Rationale**: 
- Real coolers support multiple sockets (e.g., Noctua NH-D15 supports AM4, AM5, LGA1700+).
- Array representation matches reality; filtering checks if `criteria.socket in cooler.socket[]`.
- Simpler than alternative (separate compatibility table).

**Alternatives Considered**:
- Compatibility matrix table: More complex; array is sufficient.
- String with delimiters: Less type-safe; array is clearer.

## Technical Approach Confirmation

**Data Fetching & Caching**:
- Use Teko Discovery API (`https://discovery.tekoapis.com/api/v2/search-skus-v2`) to fetch real PhongVu product listings per component type (8 types).
- Pre-fetch at build time using bash script: `scripts/fetch-phongvu-catalog.sh` (iterates each type, calls API, transforms response).
- Extract relevant fields from API response: `sku`, `name`, `latestPrice`, `totalAvailable`, `shortDescription`, `highlight` → canonical Component schema.
- Save pre-fetched data to `src/data/phongvu-catalog-<type>.json` (one file per type).
- At runtime, load JSON files (no API call needed; fully deterministic).

**Field Mapping from PhongVu API**:
- `sku` → `id` (unique identifier)
- `name` → `name`
- `latestPrice` (string, VND) → `price` (number)
- `totalAvailable` → stock_status (`in_stock` if totalAvailable > 0, else `out_of_stock`)
- `shortDescription` / `highlight` → extract type-specific fields (socket, TDP, RAM gen, etc.) via regex/parsing
- `discountPercent` → optional `promo` field (e.g., "20% discount")

**Component Type Slugs for API**:
- CPU: `/c/cpu`
- Mainboard: `/c/mainboard` (or similar per Phong Vu categories)
- RAM: `/c/ram`
- PSU: `/c/psu`
- Cooler: `/c/cooler`
- Case: `/c/case`
- Storage: `/c/storage`
- GPU: `/c/gpu`

**Pre-fetched Data**:
- Real PhongVu products (~50-200 per type depending on catalog size).
- Stored as JSON array in `src/data/phongvu-catalog-<type>.json`.
- Covers realistic brands, specs, price ranges, stock status.
- Deterministic (same set every session until manually re-fetched).

**Filtering Logic**:
- Pure functions (no side effects), unit-testable.
- Apply all provided criteria with AND logic.
- Omitted/null/undefined fields are skipped (no filter).
- Price range inclusive on both ends (price_min ≤ price ≤ price_max).
- Support TDP/wattage/clearance range filtering.

**Determinism**:
- Mock search results: same input → same output (verified by 100 iterations in SC-005).
- Live search results: sorted by price ascending (deterministic order).
- No randomization or external state in filtering.

## Dependencies & Risks

**Dependencies**:
- Teko Discovery API token: Bearer token in `~/.openclaw/openclaw.json` (provided by user).
- Build script: `scripts/fetch-phongvu-catalog.sh` to crawl API at build time.
- Regex/parsing logic: Extract socket, TDP, RAM gen from `shortDescription` and `highlight` HTML/text.
- TypeScript types: Use interfaces for Component, SearchCriteria, SearchResult.
- Jest: For unit testing filtering logic and API transformer.

**Risks & Mitigations**:
- **API token expiry**: Pre-fetching happens at build time (controlled); cached data is valid for hackathon duration. If token expires, re-run build script.
- **Field parsing complexity**: PhongVu API response is HTML-rich (shortDescription contains HTML, highlight has SVG icons). Parsing may need regex tuning per component type. Mitigation: Start with highlight (structured HTML attributes), fall back to shortDescription if needed.
- **Missing or inconsistent fields**: PhongVu API may have null values or missing fields (e.g., totalAvailable=null). Use defaults: `null totalAvailable` → `out_of_stock`; missing socket → log warning + skip component.
- **API response size**: Pre-fetching 8 types × 50-200 products = 400-1600 products. JSON cache will be ~5-10MB (manageable). At runtime, entire dataset loaded to memory (acceptable for 16h hackathon).

## API Component Type Slugs

Map each component type to its Teko Discovery API slug for pre-fetching (confirmed 2026-07-11):

| Component Type | API Slug | Notes |
|---|---|---|
| CPU | `/c/cpu` | Single slug |
| Mainboard | `/c/mainboard-bo-mach-chu` | Single slug |
| RAM | `/c/ram-pc` | Single slug |
| PSU | `/c/psu-nguon-may-tinh` | Single slug |
| Cooler | `/c/tan-nhiet` | Single slug |
| Case | `/c/case` | Single slug |
| Storage | `/c/o-cung-hdd` + `/c/o-cung-ssd` | **TWO slugs** — fetch both, merge results into single catalog file |
| GPU | `/c/vga-card-man-hinh` | Single slug |

**Storage Special Case**: Storage has 2 separate API endpoints (HDD vs SSD). Pre-fetch script should:
1. Call `/c/o-cung-hdd` → get HDD products
2. Call `/c/o-cung-ssd` → get SSD products
3. Merge both results into `src/data/phongvu-catalog-storage.json` with all products together

## Build Process

**Pre-fetch Script** (`scripts/fetch-phongvu-catalog.sh`):

Confirmed slugs (2026-07-11):
```bash
#!/bin/bash
# Pre-fetch real PhongVu data and generate catalog JSON files

TOKEN=$(cat ~/.openclaw/openclaw.json | jq -r '.tekoDiscoveryToken')
ENDPOINT="https://discovery.tekoapis.com/api/v2/search-skus-v2"

# Define type → slug mapping
declare -A SLUGS=(
  [cpu]="/c/cpu"
  [mainboard]="/c/mainboard-bo-mach-chu"
  [ram]="/c/ram-pc"
  [psu]="/c/psu-nguon-may-tinh"
  [cooler]="/c/tan-nhiet"
  [case]="/c/case"
  [gpu]="/c/vga-card-man-hinh"
)

# Fetch for each type
for TYPE in cpu mainboard ram psu cooler case gpu; do
  SLUG=${SLUGS[$TYPE]}
  echo "Fetching $TYPE ($SLUG)..."
  
  # Paginate through all products
  page=1
  all_products="[]"
  while true; do
    response=$(curl -s -X POST "$ENDPOINT" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"slug\":\"$SLUG\",\"pageSize\":50,\"page\":$page,...}")
    
    products=$(echo $response | jq '.data.products')
    if [ $(echo $products | jq 'length') -eq 0 ]; then
      break
    fi
    all_products=$(echo "[$all_products, $products]" | jq 'add')
    page=$((page+1))
  done
  
  # Transform and save
  npx ts-node scripts/phongvu-transformer.ts "$all_products" "src/data/phongvu-catalog-$TYPE.json"
done

# Storage: Special case (2 slugs: HDD + SSD)
echo "Fetching storage (HDD + SSD)..."
storage_products="[]"
for SLUG in "/c/o-cung-hdd" "/c/o-cung-ssd"; do
  page=1
  while true; do
    response=$(curl -s -X POST "$ENDPOINT" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"slug\":\"$SLUG\",\"pageSize\":50,\"page\":$page,...}")
    products=$(echo $response | jq '.data.products')
    if [ $(echo $products | jq 'length') -eq 0 ]; then break; fi
    storage_products=$(echo "[$storage_products, $products]" | jq 'add')
    page=$((page+1))
  done
done
npx ts-node scripts/phongvu-transformer.ts "$storage_products" "src/data/phongvu-catalog-storage.json"

echo "✅ Pre-fetch complete. Commit phongvu-catalog-*.json to git."
```

## Next Steps

- **Phase 1 (Complete)**:
  - ✅ Confirm API slugs for all 8 component types (done 2026-07-11)
  - ✅ Finalize API field mapping and transformation rules
  - ✅ Data model (Component entity, SearchCriteria), contracts (search API, API transformer), quickstart guide
  
- **Phase 2**: Implementation
  - Implement Teko API HTTP client (with token from `~/.openclaw/openclaw.json`)
  - Implement PhongVu transformer (parse API response → Component schema)
  - Implement pre-fetch build script (`npm run fetch:phongvu`)
  - Implement search filters (socket, price, stock, form factor, etc.)
  - Add unit tests (regex parsing, filter logic, determinism)
  - Run pre-fetch, commit `phongvu-catalog-*.json` files to repo
