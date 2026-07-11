# Data Model: Catalog Adapter

**Phase 1 Output** | **Date**: 2026-07-11

## Entity: Component

A single PC hardware part in the catalog. All components have shared fields; type-specific fields are present only when relevant.

### Shared Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sku` | string | Yes | Stock Keeping Unit from PhongVu (unique identifier, e.g., "211208131") |
| `name` | string | Yes | Human-readable name (e.g., "CPU Intel Core i5-12400") |
| `type` | enum | Yes | Component type: "CPU" \| "mainboard" \| "RAM" \| "PSU" \| "cooler" \| "case" \| "storage" \| "GPU" |
| `price` | number | Yes | Price in VND (Vietnamese Dong), integer, ≥0 |
| `stock_status` | enum | Yes | "in_stock" \| "out_of_stock" |
| `promo` | string \| null | No | Promotional text if available, otherwise null |

### Type-Specific Fields

#### CPU
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `socket` | string | Yes | Socket standard (e.g., "AM5", "LGA1700") |
| `tdp` | number | Yes | Thermal Design Power in watts, integer |

#### Mainboard
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `socket` | string | Yes | Socket standard (e.g., "AM5", "LGA1700") |
| `ram_gen` | enum | Yes | "DDR4" \| "DDR5" |
| `form_factor` | enum | Yes | "ATX" \| "mATX" \| "ITX" |

#### RAM
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ram_gen` | enum | Yes | "DDR4" \| "DDR5" |

#### PSU
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wattage` | number | Yes | Power capacity in watts, integer |
| `form_factor` | enum | Yes | "ATX" \| "SFX" |

#### Cooler
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `socket` | string[] | Yes | Array of compatible sockets (e.g., `["AM5", "AM4", "LGA1700"]`) |
| `tdp` | number | Yes | Max TDP support in watts, integer |

#### Case
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `form_factor` | enum | Yes | "ATX" \| "mATX" \| "ITX" |
| `clearance_mm` | number | Yes | GPU clearance in millimeters, integer |

#### Storage
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| (none beyond shared) | — | — | Type-specific fields N/A for storage |

#### GPU
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tdp` | number | Yes | Power consumption in watts, integer |
| `clearance_mm` | number | Yes | Card length in millimeters, integer |

### Example Component Instances

**CPU (Intel Core i5-12400)**
```typescript
{
  sku: "211208131",
  name: "CPU Intel Core i5-12400 (6 nhân 12 luồng - Boost tối đa 4.4 GHz - 18MB - 1700)",
  type: "CPU",
  price: 5590000,
  stock_status: "in_stock",
  promo: "20% discount",
  socket: "1700",
  tdp: 65
}
```

**Mainboard (ASUS ROG STRIX X870-E)**
```typescript
{
  sku: "311450256",
  name: "ASUS ROG STRIX X870-E",
  type: "mainboard",
  price: 8500000,
  stock_status: "in_stock",
  promo: null,
  socket: "AM5",
  ram_gen: "DDR5",
  form_factor: "ATX"
}
```

**Cooler (Noctua NH-D15)**
```typescript
{
  sku: "401280150",
  name: "Noctua NH-D15 (Socket: AM5, AM4, LGA1700 / TDP: 220W)",
  type: "cooler",
  price: 2500000,
  stock_status: "in_stock",
  promo: null,
  socket: ["AM5", "AM4", "LGA1700"],
  tdp: 220
}
```

**Case (Lian Li Lancool 215)**
```typescript
{
  sku: "300950180",
  name: "Lian Li Lancool 215 (mATX, GPU Clearance 310mm)",
  type: "case",
  price: 1200000,
  stock_status: "out_of_stock",
  promo: null,
  form_factor: "mATX",
  clearance_mm: 310
}
```

## Entity: SearchCriteria

Represents filter parameters passed to `search_components(criteria)`. All fields are optional.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | No | Component type filter (e.g., "CPU") |
| `socket` | string | No | Socket filter (e.g., "AM5") |
| `ram_gen` | enum | No | "DDR4" \| "DDR5" |
| `form_factor` | enum | No | "ATX" \| "mATX" \| "ITX" \| "SFX" |
| `price_min` | number | No | Minimum price in VND (inclusive) |
| `price_max` | number | No | Maximum price in VND (inclusive) |
| `stock_status` | enum | No | "in_stock" \| "out_of_stock" |
| `clearance_mm` | number | No | Minimum GPU/case clearance in mm (inclusive) |
| `tdp_min` | number | No | Minimum TDP in watts (inclusive) |
| `tdp_max` | number | No | Maximum TDP in watts (inclusive) |
| `wattage_min` | number | No | Minimum PSU wattage in watts (inclusive) |
| `wattage_max` | number | No | Maximum PSU wattage in watts (inclusive) |

### Example Criteria

**Search for AM5 CPUs under 8M VND, in stock**
```typescript
{
  type: "CPU",
  socket: "AM5",
  price_max: 8000000,
  stock_status: "in_stock"
}
```

**Search for DDR5 mainboards under 5M, AM5 socket**
```typescript
{
  type: "mainboard",
  socket: "AM5",
  ram_gen: "DDR5",
  price_max: 5000000
}
```

**Search for ATX or larger cases with 300mm+ clearance**
```typescript
{
  type: "case",
  form_factor: "ATX",
  clearance_mm: 300
}
```

## Filtering Rules

### AND Logic
All provided criteria are applied simultaneously (AND logic). A component must satisfy ALL specified conditions to be included in results.

### Optional Fields
Fields not provided (omitted, null, or undefined) impose no filter — they are skipped.

### Form Factor Hierarchy (Cases Only)
For case filtering, `form_factor` uses hierarchical matching:
- Filtering for `"ATX"` returns: ATX + mATX + ITX cases (all sizes)
- Filtering for `"mATX"` returns: mATX + ITX cases
- Filtering for `"ITX"` returns: ITX cases only

Mainboard `form_factor` uses exact match (no hierarchy).

### Socket Matching (Coolers)
For coolers, `socket` criteria matches if the requested socket is in the cooler's socket array:
```typescript
// Cooler: socket = ["AM5", "AM4", "LGA1700"]
// Criteria: socket = "AM5"
// Result: MATCH (AM5 is in array)
```

### Price Range (Inclusive)
Price filtering is inclusive on both bounds:
- `price_min` ≤ component.price ≤ `price_max`

### Clearance & TDP Ranges (Inclusive)
All range filters (clearance_mm, tdp_min/max, wattage_min/max) are inclusive:
- `clearance_mm`: component.clearance_mm ≥ criteria.clearance_mm
- `tdp_min` ≤ component.tdp ≤ `tdp_max`
- `wattage_min` ≤ component.wattage ≤ `wattage_max`

## SearchResult

| Field | Type | Description |
|-------|------|-------------|
| `components` | Component[] | Array of matching components |

### Example Result

```typescript
{
  components: [
    {
      id: "cpu-amd-5700x3d",
      name: "AMD Ryzen 7 5700X3D",
      type: "CPU",
      price: 11500000,
      stock_status: "in_stock",
      promo: "Giảm 500k",
      socket: "AM5",
      tdp: 105
    },
    {
      id: "cpu-amd-7700x",
      name: "AMD Ryzen 7 7700X",
      type: "CPU",
      price: 9800000,
      stock_status: "in_stock",
      promo: null,
      socket: "AM5",
      tdp: 105
    }
  ]
}
```

If no components match, `components` is an empty array `[]` (never null/undefined).

## Data Sources

### Live Data (Apify)
- Fetched from PhongVu.vn via Apify SDK
- Cached per session
- Sorted by price ascending
- Timeout: 5s per component type
- Per-category fallback on timeout

### Mock Data
- Pre-defined JSON structure (~50 components)
- Deterministic ordering (same input → same output)
- Used as fallback when live fetch fails or times out
- At least 5 entries per type
- At least 1 in-stock and 1 out-of-stock per type
