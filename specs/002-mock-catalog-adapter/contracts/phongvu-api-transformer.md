# Contract: PhongVu API Transformer

**Purpose**: Transform Teko Discovery API response (PhongVu catalog) to canonical Component schema

**API Endpoint**: `https://discovery.tekoapis.com/api/v2/search-skus-v2`

## API Request Structure

```json
{
  "terminalId": 4,
  "slug": "/c/cpu",              // Component type slug
  "query": "",                   // Optional: search query (empty for all)
  "sorting": {
    "sort": "SORT_BY_UNSPECIFIED",
    "order": "ORDER_BY_UNSPECIFIED"
  },
  "filter": {
    "priceGte": 1500000,         // Min price in VND
    "priceLte": 43500000         // Max price in VND
  },
  "pageSize": 50,                // Items per page
  "page": 1,                     // Page number
  "isNeedFeaturedProducts": false
}
```

## API Response Structure

```json
{
  "code": 200,
  "traceId": "...",
  "message": "Success",
  "data": {
    "products": [
      {
        "sku": "211208131",
        "name": "CPU Intel Core i5-12400 (...)",
        "latestPrice": "5590000",        // Price in VND as string
        "supplierRetailPrice": "6990000", // Original price
        "discountAmount": "1400000",
        "discountPercent": 20,
        "totalAvailable": 2,             // Stock count (null if unknown)
        "sellable": true,
        "shortDescription": "<p>- Socket: 1700<br>- TDP: 65W<br>...</p>",
        "highlight": "<div>Socket 1700</div><div>6 nhân/12 luồng</div>",
        "brandName": "Intel",
        "imageUrl": "https://...",
        "categories": [
          {
            "code": "NH03-01-01",
            "name": "Bộ vi xử lý (CPU)",
            "id": 386137
          }
        ],
        "updatedAt": "1779348039"
      }
    ]
  }
}
```

## Field Mapping Rules

### Shared Fields (All Component Types)

| PhongVu Field | Component Field | Transformation Rule |
|---|---|---|
| `sku` | `sku` | Use as-is (unique identifier - REQUIRED in all components) |
| `name` | `name` | Use as-is (human-readable name) |
| `latestPrice` | `price` | Parse string → integer (remove commas if present) |
| `totalAvailable` | `stock_status` | If null or 0: `"out_of_stock"`; else: `"in_stock"` |
| `discountPercent` | `promo` | If > 0: `"[N]% discount"` or null; else: null |

### Type-Specific Field Extraction

All type-specific fields (socket, TDP, RAM gen, etc.) must be extracted from:
1. **`highlight`** (preferred): Structured HTML with semantic tags and SVG icons
2. **`shortDescription`** (fallback): HTML with `<br>` separators and dashes

#### CPU

| Target Field | Extraction Strategy |
|---|---|
| `socket` | Regex: `Socket\s*([\w\d]+)` from highlight/description. Example: "Socket 1700" → `"1700"` |
| `tdp` | Regex: `TDP[\s:]*(\d+)\s*W` from description. Example: "TDP: 65W" → `65` |

**Example CPU Parsing**:
```typescript
// Input highlight:
// "<div>Socket 1700</div><div>6 nhân / 12 luồng</div>"
// Input shortDescription:
// "<p>- Socket: 1700<br>- TDP: 65W<br>...</p>"

const socket = highlight.match(/Socket\s*([\w\d]+)/)? [1] : description.match(/Socket:\s*([\w\d]+)/)? [1]
// Result: "1700"

const tdp = description.match(/TDP[\s:]*(\d+)\s*W/)? [1]
// Result: 65
```

#### Mainboard

| Target Field | Extraction Strategy |
|---|---|
| `socket` | Same as CPU: `Socket ([\w\d]+)` |
| `ram_gen` | Regex: `DDR\d+` from highlight/description. Match: `DDR4` or `DDR5` |
| `form_factor` | Regex: `(ATX\|mATX\|ITX)` from description. Exact match required |

**Example Mainboard Parsing**:
```typescript
// Input:
// "Mainboard ASUS ROG STRIX X870-E (Socket AM5, DDR5, ATX)"

const socket = "AM5"
const ram_gen = description.match(/(DDR\d+)/)? [1] // "DDR5"
const form_factor = description.match(/(ATX|mATX|ITX)/)? [1] // "ATX"
```

#### RAM

| Target Field | Extraction Strategy |
|---|---|
| `ram_gen` | Regex: `(DDR4\|DDR5)` from name or description |

**Example RAM Parsing**:
```typescript
// Input name: "Corsair Vengeance RGB Pro DDR5 32GB 6000MHz"
const ram_gen = name.match(/(DDR4|DDR5)/)? [1] // "DDR5"
```

#### PSU

| Target Field | Extraction Strategy |
|---|---|
| `wattage` | Regex: `(\d+)\s*W(att)?` from description. Extract first match |
| `form_factor` | Regex: `(ATX\|SFX)` from description |

**Example PSU Parsing**:
```typescript
// Input: "Corsair RM1000e 1000W 80+ Gold ATX"
const wattage = description.match(/(\d+)\s*W(?:att)?/)? [1] // "1000"
const form_factor = description.match(/(ATX|SFX)/)? [1] // "ATX"
```

#### Cooler

| Target Field | Extraction Strategy |
|---|---|
| `socket` | Regex: socket list from description. Extract all `[\w\d]+` after "Socket" or "LGA/AM" pattern. Result: array |
| `tdp` | Regex: `(\d+)\s*W` from description. Extract max TDP |

**Example Cooler Parsing**:
```typescript
// Input: "Noctua NH-D15 (Socket: AM5, AM4, LGA1700 / TDP: 220W)"
const socket = description.match(/Socket[:\s]*([\w\d,\s]+)/i)? [1]
              .split(',').map(s => s.trim())
// Result: ["AM5", "AM4", "LGA1700"]

const tdp = description.match(/TDP[\s:]*(\d+)\s*W/)? [1] // "220"
```

#### Case

| Target Field | Extraction Strategy |
|---|---|
| `form_factor` | Regex: `(ATX\|mATX\|ITX)` from description |
| `clearance_mm` | Regex: `clearance[\s:]*(\d+)\s*mm` or `(\d+)\s*mm\s*clear` |

**Example Case Parsing**:
```typescript
// Input: "Lian Li Lancool 215 (mATX, GPU Clearance 310mm)"
const form_factor = description.match(/(ATX|mATX|ITX)/)? [1] // "mATX"
const clearance_mm = description.match(/clearance[\s:]*(\d+)\s*mm/i)? [1] // "310"
```

#### Storage

| Target Field | Extraction Strategy |
|---|---|
| (none) | No type-specific fields; use only shared fields |

#### GPU

| Target Field | Extraction Strategy |
|---|---|
| `tdp` | Regex: `TDP[\s:]*(\d+)\s*W` or `Power[\s:]*(\d+)\s*W` |
| `clearance_mm` | Regex: `length[\s:]*(\d+)\s*mm` or `(\d+)\s*mm\s*length` |

**Example GPU Parsing**:
```typescript
// Input: "NVIDIA RTX 4090 (TDP: 575W, Length: 420mm)"
const tdp = description.match(/TDP[\s:]*(\d+)\s*W/)? [1] // "575"
const clearance_mm = description.match(/length[\s:]*(\d+)\s*mm/i)? [1] // "420"
```

## Component Type Slugs

Confirmed API slugs (as of 2026-07-11):

| Type | Slug(s) |
|---|---|
| CPU | `/c/cpu` |
| Mainboard | `/c/mainboard-bo-mach-chu` |
| RAM | `/c/ram-pc` |
| PSU | `/c/psu-nguon-may-tinh` |
| Cooler | `/c/tan-nhiet` |
| Case | `/c/case` |
| Storage | `/c/o-cung-hdd` AND `/c/o-cung-ssd` (fetch both, merge) |
| GPU | `/c/vga-card-man-hinh` |

## Pagination Strategy

- Fetch all pages (no hardcoded limit) by incrementing `page` until `products[]` is empty or incomplete
- For Storage: make 2 separate API calls (`/c/o-cung-hdd` + `/c/o-cung-ssd`), merge results
- Example:
  ```bash
  for slug in "/c/cpu" "/c/mainboard-bo-mach-chu" ...; do
    page=1
    products=[]
    while true; do
      POST request with slug=$slug, page=$page
      If no products returned or < pageSize items, break
      Else append products to results
      page++
    done
    Save results to phongvu-catalog-<type>.json
  done
  
  # Special case: Storage
  for slug in "/c/o-cung-hdd" "/c/o-cung-ssd"; do
    [fetch paginated results for each slug]
    Merge both results
  done
  Save merged to phongvu-catalog-storage.json
  ```

## Error Handling

| Scenario | Action |
|---|---|
| Missing socket field | Log warning, skip component (required for most types) |
| Invalid price (not parseable) | Skip component |
| `totalAvailable` is null | Treat as `out_of_stock` |
| Regex match fails for optional field | Use null or omit field (e.g., promo=null) |
| API returns error | Catch error, return empty result, fallback to previous cache |

## Implementation Checklist

- [ ] Implement HTTP client for Teko API (with bearer token from config)
- [ ] Implement PhongVu transformer (all 8 types with their extraction rules)
- [ ] Implement CSV/JSON export for pre-fetched data
- [ ] Add unit tests for each type's regex parsing (test with real API samples)
- [ ] Add integration test that fetches real data and validates schema
- [ ] Add build script `npm run fetch:phongvu` to invoke transformer
- [ ] Commit generated `phongvu-catalog-*.json` files to repo
- [ ] Document any API changes or new fields in ADR
