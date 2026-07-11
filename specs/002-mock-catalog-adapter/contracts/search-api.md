# Contract: Catalog Search API

**API Version**: 1.0.0 | **Date**: 2026-07-11

## Function: `search_components(criteria)`

Searches the component catalog using multi-criteria filtering.

### Signature

```typescript
function search_components(criteria: SearchCriteria): SearchResult
```

### Input: SearchCriteria

An optional object containing filter parameters. All fields are optional; omitted fields are ignored.

```typescript
interface SearchCriteria {
  type?: string;                    // Component type ("CPU", "mainboard", etc.)
  socket?: string;                  // Socket standard (e.g., "AM5")
  ram_gen?: "DDR4" | "DDR5";        // RAM generation
  form_factor?: "ATX" | "mATX" | "ITX" | "SFX";  // Form factor
  price_min?: number;               // Minimum price in VND (inclusive)
  price_max?: number;               // Maximum price in VND (inclusive)
  stock_status?: "in_stock" | "out_of_stock";   // Stock availability
  clearance_mm?: number;            // Minimum clearance in mm (inclusive)
  tdp_min?: number;                 // Minimum TDP in watts (inclusive)
  tdp_max?: number;                 // Maximum TDP in watts (inclusive)
  wattage_min?: number;             // Minimum PSU wattage in watts (inclusive)
  wattage_max?: number;             // Maximum PSU wattage in watts (inclusive)
}
```

### Output: SearchResult

An object containing an array of matching components.

```typescript
interface SearchResult {
  components: Component[];
}
```

Each `Component` includes:
- Shared fields: `sku`, `name`, `type`, `price`, `stock_status`, `promo`
- Type-specific fields: `socket`, `ram_gen`, `tdp`, `wattage`, `clearance_mm`, `form_factor` (where applicable)

### Behavior

1. **AND Logic**: All provided criteria are applied simultaneously. A component must satisfy ALL specified conditions.
2. **Optional Fields**: Fields not provided (omitted, null, undefined) are skipped; no filter applied.
3. **Empty Criteria**: Calling with `{}` returns all ~50 components from mock or hundreds from live (unfiltered).
4. **No Matches**: Returns `{ components: [] }` (empty array, never null).

### Filtering Rules

#### Type Filtering
Exact match on `component.type`.

#### Socket Filtering
- For CPU, mainboard: exact match on `component.socket`
- For cooler: matches if `criteria.socket` is in `component.socket[]`

#### Form Factor Filtering
- For case: hierarchical matching (filtering for "mATX" returns mATX + ITX cases)
- For mainboard, PSU: exact match

#### Price Filtering
Inclusive on both ends: `criteria.price_min ≤ component.price ≤ criteria.price_max`

#### Stock Status Filtering
Exact match on `component.stock_status`.

#### RAM Generation Filtering
Exact match on `component.ram_gen`.

#### Clearance & TDP/Wattage Filters
Inclusive on both bounds:
- Clearance: `component.clearance_mm ≥ criteria.clearance_mm`
- TDP: `criteria.tdp_min ≤ component.tdp ≤ criteria.tdp_max`
- Wattage: `criteria.wattage_min ≤ component.wattage ≤ criteria.wattage_max`

### Result Ordering

- **Mock Data**: Deterministic order based on pre-defined dataset; same input always produces same output.
- **Live Data**: Sorted by price ascending (cheapest first).

### Performance

- **Latency**: < 50ms on commodity hardware (laptop-grade CPU)
- **Memory**: In-memory data structures; no database queries

### Data Sources

1. **Primary**: Live Apify scraping of PhongVu.vn (real-time data, up to thousands of components)
2. **Fallback**: Static mock dataset (~50 components per type) — used when live fetch fails or times out
3. **Strategy**: Per-category fallback (if CPU scraping fails, only CPU uses mock; GPU continues with live)

### Examples

#### Example 1: Search for AM5 CPUs under 8M VND, in stock

**Request**:
```typescript
search_components({
  type: "CPU",
  socket: "AM5",
  price_max: 8000000,
  stock_status: "in_stock"
})
```

**Expected**: Returns all CPUs with socket="AM5", price ≤ 8M VND, stock_status="in_stock"

#### Example 2: Search for DDR5 mainboards, AM5, under 5M, in stock

**Request**:
```typescript
search_components({
  type: "mainboard",
  socket: "AM5",
  ram_gen: "DDR5",
  price_max: 5000000,
  stock_status: "in_stock"
})
```

**Expected**: Returns mainboards matching all 4 criteria

#### Example 3: Search for ATX or larger cases with 300mm+ clearance

**Request**:
```typescript
search_components({
  type: "case",
  form_factor: "ATX",
  clearance_mm: 300
})
```

**Expected**: Returns ATX + mATX + ITX cases with clearance ≥ 300mm (hierarchical matching)

#### Example 4: Empty criteria (no filters)

**Request**:
```typescript
search_components({})
```

**Expected**: Returns all ~50 components from mock or all live components (unfiltered)

### Error Handling

- **Invalid type value**: Returns `{ components: [] }` (empty result, not error)
- **price_min > price_max**: Returns `{ components: [] }` (contradictory bounds)
- **Invalid enum value**: Returns `{ components: [] }` (no match)
- **Network timeout on live fetch**: Falls back to mock for that component type
- **All data sources unavailable**: Returns mock data (built-in fallback always available)

### Edge Cases

- **Non-existent component type** (e.g., "speaker"): Returns `[]`
- **Empty dataset for a type**: Returns `[]` for that type
- **Missing optional field in criteria**: Field is skipped; no filter applied
- **Null/undefined criteria value**: Treated as omitted; field skipped
- **Cooler with single socket**: `socket: ["AM5"]` — filtering for "AM5" matches
- **Case with ITX form factor**: Filtering for "mATX" returns nothing (ITX < mATX in hierarchy)
