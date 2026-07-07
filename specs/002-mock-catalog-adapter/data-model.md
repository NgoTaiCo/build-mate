# Data Model: Catalog Adapter

**Branch**: `002-mock-catalog-adapter` | **Date**: 2026-07-07
**Source**: spec.md Key Entities + research.md §1 (field mapping)
**Implementation note**: types duoi day = TypeScript type definitions. Khong co persistence — mock data in-memory static array; live data fetched per-request.

## Entities Overview

```text
SearchCriteria ──→ search_components() ──→ CatalogComponent[]
                            │
                            ├── Apify live data (primary, per-type)
                            └── Mock data (fallback, per-type)
```

---

## 1. CatalogComponent (output — Compiler-compatible format)

CatalogComponent = output type cua `search_components`. Matches `@buildmate/compiler` Component union + extra catalog-specific fields. Research §1 mapping applied.

### 1.1 Shared fields (all types)

Field | Type | Required | Description
---|---|---|---
`id` | `string` | yes | Unique identifier (mock: `"cpu-001"`, live: PhongVu SKU)
`name` | `string` | yes | Human-readable product name
`type` | `ComponentType` | yes | Discriminator — one of 8 types
`price` | `number` | yes | Price in VND (integer)
`stock_status` | `"in_stock" \| "out_of_stock"` | yes | Availability
`promo` | `string \| null` | yes | Promotion text or null

### 1.2 Type-specific fields

#### CPU (`type: "cpu"`)

Field | Type | Required | Compiler use
---|---|---|---
`socket` | `string` | yes (E001) | e.g. `"AM5"`, `"LGA1700"`
`tdp` | `number` | yes (W001) | Watts
`ram_gen_supported` | `string[]` | yes (E002) | e.g. `["DDR5"]`, `["DDR4", "DDR5"]`

#### Mainboard (`type: "mainboard"`)

Field | Type | Required | Compiler use
---|---|---|---
`socket` | `string` | yes (E001) | e.g. `"AM5"`
`ram_gen_supported` | `string[]` | yes (E002) | e.g. `["DDR5"]`
`form_factor` | `string` | yes (E005) | `"ATX"` \| `"mATX"` \| `"ITX"`

> Research §1: catalog `ram_gen: "DDR5"` → wrap to `ram_gen_supported: ["DDR5"]`.

#### RAM (`type: "ram"`)

Field | Type | Required | Compiler use
---|---|---|---
`generation` | `string` | yes (E002) | `"DDR4"` \| `"DDR5"` (Compiler field name: `generation`)
`tdp` | `number` | no (W001 optional) | DDR5 ~3W, DDR4 ~2W

> Research §1: catalog `ram_gen` → Compiler `generation`.

#### PSU (`type: "psu"`)

Field | Type | Required | Compiler use
---|---|---|---
`wattage` | `number` | yes (W001) | e.g. `650`, `850`
`form_factor` | `string` | yes (E005) | `"ATX"` \| `"SFX"`

> PSU does NOT have `tdp` field (Constitution Principle II + Compiler data model rule — PSU is source, not load).

#### Case (`type: "case"`)

Field | Type | Required | Compiler use
---|---|---|---
`max_cooler_height` | `number` | yes (E004) | Cooler height limit (mm). Mock: ATX ~165, mATX ~160, ITX ~80.
`supported_mb_form_factors` | `string[]` | yes (E005) | e.g. `["ATX", "mATX", "ITX"]`
`supported_psu_form_factors` | `string[]` | yes (E005) | e.g. `["ATX", "SFX"]`

> Research §1: derived from catalog `form_factor` (single) via hierarchy. `"ATX"` → fits ATX/mATX/ITX. ITX case → `["ITX"]` only. PSU: ATX-sized case → fits ATX + SFX; ITX → SFX only.

**Catalog-only extra fields** (pass-through, Compiler ignores):

Field | Type | Description
---|---|---
`clearance_mm` | `number` | GPU length clearance (for future Compiler use / display)
`form_factor` | `string` | Original catalog form_factor (kept for display)

#### Cooler (`type: "cooler"`)

Field | Type | Required | Compiler use
---|---|---|---
`height` | `number` | yes (E004) | Cooler height in mm. Tower ~155-165, low-profile ~60-70.

**Catalog-only extra fields** (pass-through):

Field | Type | Description
---|---|---
`socket` | `string[]` | Compatible socket list (clarification Q5), e.g. `["AM5", "AM4", "LGA1700"]`
`tdp` | `number` | Max TDP support (for future CPU-cooler TDP matching)

> Research §1: Compiler 001 uses `height` for E004. Catalog `socket` (array) and `tdp` (max) are pass-through — not consumed by current Compiler rules.

#### Storage (`type: "storage"`)

Field | Type | Required | Compiler use
---|---|---|---
_(shared only)_ | — | — | E003 required-set (boot-completeness). No compatibility fields.

> Storage has no type-specific fields beyond shared. Compiler only checks existence for E003.

#### GPU (`type: "gpu"`)

Field | Type | Required | Compiler use
---|---|---|---
`tdp` | `number` | yes (W001) | GPU power draw (e.g. `220`, `450`)

**Catalog-only extra fields** (pass-through):

Field | Type | Description
---|---|---
`clearance_mm` | `number` | GPU length in mm (for future case clearance check)

> GPU is NOT in E003 required-set (optional component). But `tdp` must be present for W001 when GPU exists.

### 1.3 ComponentType (discriminator)

```typescript
type ComponentType = "cpu" | "mainboard" | "ram" | "psu" | "cooler" | "case" | "storage" | "gpu";
```

---

## 2. SearchCriteria (input)

Field | Type | Required | Description
---|---|---|---
`type` | `ComponentType` | no | Filter by component type. Omit = all 8 types.
`socket` | `string` | no | Socket filter. Exact match for CPU/mainboard; `array.includes()` for cooler.
`ram_gen` | `string` | no | RAM generation filter (`"DDR4"` \| `"DDR5"`). Matches mainboard `ram_gen_supported` and RAM `generation`.
`form_factor` | `string` | no | Form factor filter. Hierarchical `>=` for case; exact `===` for mainboard (FR-008).
`price_min` | `number` | no | Minimum price (VND), inclusive (FR-007).
`price_max` | `number` | no | Maximum price (VND), inclusive (FR-007).
`stock_status` | `"in_stock" \| "out_of_stock"` | no | Stock status filter. Omit = both in-stock and out-of-stock returned.
`clearance_mm` | `number` | no | Min GPU clearance for case filter (FR-008 inclusive).
`tdp_min` | `number` | no | Min TDP filter (applies to CPU, GPU, cooler — types that have `tdp`).
`tdp_max` | `number` | no | Max TDP filter.
`wattage_min` | `number` | no | Min PSU wattage filter.
`wattage_max` | `number` | no | Max PSU wattage filter.

**Validation rules**:
- All fields optional. Empty `{}` = return all components unfiltered.
- `price_min > price_max` → returns empty array (no component satisfies).
- Unknown field values → returns empty array for that filter.
- Fields not present in criteria → ignored (no filter applied, FR-006).

---

## 3. CatalogResult (search output)

```typescript
interface CatalogResult {
  components: CatalogComponent[];   // filtered + sorted results
  source: DataSource;                // "live" | "mock" | "mixed" (per-category fallback)
  errors: DataSourceError[];         // per-type Apify errors (for logging/diagnostics)
}
```

### 3.1 DataSource

```typescript
type DataSource = "live" | "mock" | "mixed";
// "live" = all types from Apify
// "mock" = all types from mock fallback  
// "mixed" = some live, some mock (per-category fallback)
```

### 3.2 DataSourceError

Field | Type | Description
---|---|---
`type` | `ComponentType` | Which type's Apify call failed
`source` | `"apify"` | Source type
`message` | `string` | Error message for logging

**Note**: `DataSourceError` chỉ báo cáo — không fail `search_components`. Fallback = transparent to caller.

---

## 4. ApifyScrapedProduct (internal — pre-map)

Raw data từ Apify Actor trước khi `mapper.ts` transforms:

Field | Type | Description
---|---|---
`name` | `string` | Product title
`price` | `number \| null` | Price in VND (nullable — promo price có thể missing)
`stock_status` | `string \| null` | Raw stock text (e.g. "Con hang", "Het hang")
`promo` | `string \| null` | Promotion text
`specs` | `string` | Raw HTML/text specification table từ PhongVu product page
`category` | `string \| null` | PhongVu category (e.g. "CPU", "Mainboard") — used to infer `type`

---

## 5. Form Factor Hierarchy Constants

```typescript
const FORM_FACTOR_RANK: Record<string, number> = {
  "ITX": 1,
  "mATX": 2,
  "ATX": 3,
};

const FORM_FACTOR_COMPAT: Record<string, string[]> = {
  "ATX": ["ATX", "mATX", "ITX"],
  "mATX": ["mATX", "ITX"],
  "ITX": ["ITX"],
};
```

Used by: case filter predicate (hierarchical), mock data derivation (`supported_mb_form_factors`).

---

## 6. Search Execution Order

1. **Data fetch** (per-type, parallelizable):
   - Determine target types from `criteria.type` (or ALL_TYPES)
   - For each type: try Apify → on fail, use mock for that type
   - Record `DataSourceError[]` for diagnostics
2. **Filter** (AND logic across active criteria):
   - Type check (redundant if single-type fetch, needed for multi-type)
   - Socket (exact for CPU/mb, includes for cooler)
   - RAM generation (exact)
   - Form factor (hierarchical for case, exact for mb, skip for others)
   - Stock status (exact)
   - Price range (inclusive)
   - Clearance (inclusive min — only cases have clearance)
   - TDP range (inclusive — only CPU/GPU/cooler have tdp)
   - Wattage range (inclusive — only PSU has wattage)
3. **Sort**: price ascending
4. **Return**: `CatalogResult`

---

## 7. Invariants

- **Mock deterministic**: same criteria → same `CatalogComponent[]` order byte-for-byte (FR-011)
- **Live non-deterministic**: Apify results vary by time; sort ensures stable ordering within a single call
- **Empty result**: `components: []`, NOT null/undefined (FR-004)
- **Type safety**: Component union discriminated by `type`, TypeScript exhaustiveness check
- **No state**: pure functions for mock path; Apify path has network I/O but no mutable state
- **Extra fields OK**: catalog fields not consumed by Compiler are pass-through — Compiler ignores unknown fields

## 8. Out-of-scope data

- `compare_components` function (separate feature)
- Pagination/cursor (catalog small enough — ~50 mock, live Apify returns manageable set)
- Caching layer (research §9)
- Multi-vendor (only PhongVu via Apify)
- Image URLs, reviews, detailed descriptions
- Real-time stock updates (stock_status from Apify = snapshot at call time)

