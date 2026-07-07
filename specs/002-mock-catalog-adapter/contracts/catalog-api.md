# Contract: Catalog Adapter Public API

**Branch**: `002-mock-catalog-adapter` | **Date**: 2026-07-07
**Project type**: library (pure functions for mock, async for live) — contract = function signatures + I/O schemas.
**Consumers**: OpenClaw tool plugin (feature wire-up sau, ADR-0003 HOUR 8-10) goi `@buildmate/catalog` lam dependency. `@buildmate/compiler` consume returned components.
**Dependencies**: `@buildmate/compiler` (type-level only — CatalogComponent compatible with Compiler.Component).

## Public API surface

Package `@buildmate/catalog` export 2 functions (barrel `src/index.ts`):

```typescript
export function searchComponents(criteria: SearchCriteria): Promise<CatalogResult>;
export function searchComponentsMock(criteria: SearchCriteria): CatalogComponent[];
```

> `searchComponentsMock`: pure synchronous version — chỉ dùng mock data, deterministic. Dùng cho unit test Compiler integration không cần Apify.
> `searchComponents`: primary API — live-first with per-category fallback.

---

## 1. `searchComponentsMock(criteria)` → `CatalogComponent[]`

**Purpose**: Pure synchronous search on mock data only. Deterministic (FR-011). Dùng trong unit test, CI, local dev không cần Apify API key.

**Input**: `SearchCriteria` (xem `data-model.md` §2).
```typescript
interface SearchCriteria {
  type?: ComponentType;
  socket?: string;
  ram_gen?: string;
  form_factor?: string;
  price_min?: number;
  price_max?: number;
  stock_status?: "in_stock" | "out_of_stock";
  clearance_mm?: number;
  tdp_min?: number;
  tdp_max?: number;
  wattage_min?: number;
  wattage_max?: number;
}
```

**Output**: `CatalogComponent[]` — array of components in price-ascending order. Empty array if no match.

**Contract**:
- Deterministic: same criteria → same result, byte-for-byte identical (SC-005).
- Pure function: no side effects, no I/O, no network, no randomness.
- All criteria optional: `{}` → all ~50 mock components, price-ascending.
- Returns `[]` not `null`/`undefined` for no-match (FR-004).
- AND logic: all active criteria must match (FR-005).
- Inclusive range: `price_min <= price <= price_max` (FR-007).
- Hierarchical form_factor for case: `"mATX"` → includes ATX cases (FR-008).
- Price ascending sort (FR-011).
- Throws only on structurally invalid input (e.g., `criteria` not an object). Does not throw on unknown field values → returns `[]`.

**Example**:
```typescript
const results = searchComponentsMock({
  type: "cpu",
  socket: "AM5",
  price_min: 5000000,
  price_max: 15000000,
  stock_status: "in_stock",
});
// → [{ id: "cpu-001", name: "AMD Ryzen 7 7800X3D", type: "cpu", price: 9500000,
//       stock_status: "in_stock", promo: null, socket: "AM5", tdp: 120,
//       ram_gen_supported: ["DDR5"] }, ...]
```

---

## 2. `searchComponents(criteria)` → `Promise<CatalogResult>`

**Purpose**: Primary API — live-first search via Apify with per-category mock fallback (FR-009, FR-010).

**Input**: `SearchCriteria` (same as above).

**Output**: `CatalogResult` (xem `data-model.md` §3).
```typescript
interface CatalogResult {
  components: CatalogComponent[];
  source: "live" | "mock" | "mixed";
  errors: DataSourceError[];
}
```

**Contract**:
- Live-first: attempts Apify for each applicable type. On Apify failure (timeout/error/empty) → falls back to mock data for that type only (FR-010).
- Per-category: each type fetched independently. CPU Apify fail → CPU mock; GPU Apify succeed → GPU live. Mixed = `source: "mixed"`.
- Price-ascending sort (FR-011).
- Apify call timeout: 10s per type. No retry (fallback handles failure).
- Apify API key from `APIFY_API_KEY` env var. Not present → full mock mode (`source: "mock"`), no error thrown.
- `errors[]` populated per failed type for diagnostics. Non-fatal — does not block search.
- Components returned in Compiler-compatible format (research §1 field mapping).
- Throws on structurally invalid `criteria`. Does not throw on network failure (graceful fallback).

**Example**:
```typescript
const result = await searchComponents({
  type: "mainboard",
  socket: "AM5",
  ram_gen: "DDR5",
  stock_status: "in_stock",
});
// result.source = "live" (Apify succeeded)
// result.components = [{ id: "mb-phongvu-001", name: "ASUS TUF B650-PLUS", ... }]
// result.errors = []
```

**Fallback example** (Apify timeout → per-category mock):
```typescript
const result = await searchComponents({ type: "psu" });
// result.source = "mock" (Apify failed for PSU, mock used)
// result.errors = [{ type: "psu", source: "apify", message: "timeout after 10s" }]
// result.components = [{ id: "psu-001", name: "Corsair RM650", type: "psu", ... }]
```

---

## 3. Data Flow: Live Path

```text
searchComponents(criteria)
  │
  ├─ determine target types (criteria.type || ALL_8_TYPES)
  │
  ├─ for each type (parallel via Promise.allSettled):
  │    ├─ ApifyActor.run({ category: type, ... })
  │    │    ├─ success → mapScrapedProducts(raw) → CatalogComponent[]
  │    │    └─ failure → record DataSourceError → getMockData(type)
  │    └─ return components
  │
  ├─ merge all type results into single array
  ├─ apply filter predicates (AND logic)
  ├─ sort by price ascending
  └─ return CatalogResult
```

---

## 4. Mock Data Contract

Mock dataset array `src/mock-data.ts` — exported as `MOCK_CATALOG: CatalogComponent[]`.

**Integrity guarantees**:
- ≥5 components per type (SC-004).
- ≥1 in_stock + ≥1 out_of_stock per type (SC-004).
- All Compiler-required fields populated (no `undefined` where Compiler expects `number`/`string`).
- All `type` values valid `ComponentType` discriminators.
- All `id` values unique across entire catalog.
- Realistic brand names and specs (no placeholder/fake data).

---

## 5. Non-Goals (explicitly excluded)

- `compareComponents(a, b)` — separate feature.
- REST API / HTTP endpoint — this is an in-process library, not a web service.
- OpenClaw tool registration — wire-up feature sau (HOUR 8-10).
- Caching layer — no cache between `searchComponents` calls.
- Pagination — full result returned always.
- Multi-vendor data — only PhongVu source.
- Image URLs, reviews, detailed descriptions — not in catalog data.
