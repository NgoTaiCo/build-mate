# Feature Specification: Catalog Adapter (Live-first, Mock fallback)

**Feature Branch**: `002-mock-catalog-adapter`  
**Created**: 2026-07-07  
**Status**: Draft  
**Input**: User description: "MockCatalogAdapter tool: ~50 linh kien (CPU/mainboard/RAM/PSU/cooler/case/storage/GPU) with fields price, stock_status, promo, socket, ram_gen, tdp, wattage, clearance_mm, form_factor. Expose search_components(criteria) deterministic filter by type/socket/price-range/stock. Returns component list with all fields needed by Compiler. Out-of-scope: compare_components (separate feature), live PhongVuApi scraping, real-time stock."

## Clarifications

### Session 2026-07-07

- Q: Should this adapter integrate live PhongVu data (via third-party scraper + API), or remain purely mock/static? → A: Live-first via Apify scraping partner, mock fallback (~50 components) if live scraping fails or is unavailable.
- Q: Should fallback be all-or-nothing or per-category when Apify fails? → A: Per-category fallback — each component type independently falls back to mock if its Apify scrape fails.
- Q: Should case form_factor filtering use hierarchical matching (ATX fits mATX/ITX) or exact match? → A: Hierarchical — filtering cases by form_factor returns cases of that size or larger (ATX > mATX > ITX); mainboard form_factor uses exact match.
- Q: How should live Apify search results be ordered? → A: Price ascending (cheapest first), matching retail user expectations for budget-driven builds.
- Q: How should cooler multi-socket support be represented? → A: Array of strings (`["AM5","AM4","LGA1700"]`); filter matches when criteria socket is in the array.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Find Compatible CPUs by Socket (Priority: P1)

The Build Compiler needs to find all CPUs that fit a specific socket (e.g., AM5) within a customer's budget. The catalog receives a search request for CPU type filtered by socket, fetches matching components, and returns them with price, stock, promo, socket, and TDP fields so the Compiler can validate compatibility and calculate total build cost.

**Why this priority**: Socket filtering is the most fundamental compatibility check — without it, the Compiler cannot select compatible CPU-mainboard pairs. This is the primary data path the Compiler depends on.

**Independent Test**: Can be fully tested by calling search with `{ type: "CPU", socket: "AM5" }` and verifying all returned components have `socket: "AM5"` and `type: "CPU"`.

**Acceptance Scenarios**:

1. **Given** the catalog has CPUs for both AM5 and LGA1700 sockets, **When** search_components is called with `{ type: "CPU", socket: "AM5" }`, **Then** only AM5 CPUs are returned, each with price, stock_status, promo, socket, and tdp fields populated.
2. **Given** the catalog has no CPUs for socket sWRX8, **When** search_components is called with `{ type: "CPU", socket: "sWRX8" }`, **Then** an empty list is returned.
3. **Given** the catalog has 8 CPUs across sockets, **When** search_components is called with `{ type: "CPU" }` (no socket filter), **Then** all 8 CPUs are returned unfiltered by socket.

---

### User Story 2 - Filter Components by Price Range (Priority: P2)

The Build Compiler needs to narrow component choices to fit a customer's stated budget. The catalog receives a price range (min/max) in the search criteria and returns only components whose price falls within that range.

**Why this priority**: Budget filtering is essential for real-world retail use cases — customers always have a budget. It builds on P1 by adding a second filter dimension.

**Independent Test**: Can be tested by calling search with `{ type: "CPU", price_min: 3000000, price_max: 8000000 }` and verifying all returned CPUs have price between those thresholds.

**Acceptance Scenarios**:

1. **Given** CPUs ranging from 2M to 15M VND, **When** search_components is called with `{ type: "CPU", price_min: 3000000, price_max: 8000000 }`, **Then** only CPUs with price between 3M and 8M VND are returned.
2. **Given** the same catalog, **When** search_components is called with `{ type: "CPU", price_min: 20000000 }` (min exceeds all prices), **Then** an empty list is returned.
3. **Given** the same catalog, **When** search_components is called with `{ type: "CPU", price_max: 0 }`, **Then** an empty list is returned.

---

### User Story 3 - Filter by Stock Status (Priority: P2)

The Build Compiler, when building a customer's PC, must only recommend components that are actually in stock. The catalog filters components by stock_status ("in_stock" or "out_of_stock") so the Compiler doesn't suggest unavailable items.

**Why this priority**: Stock awareness prevents the Compiler from recommending parts the customer cannot buy. Non-stock components would break the checkout flow later in the retail pipeline.

**Independent Test**: Can be tested by calling search with `{ type: "GPU", stock_status: "in_stock" }` and verifying no returned component has `stock_status: "out_of_stock"`.

**Acceptance Scenarios**:

1. **Given** a mix of in-stock and out-of-stock GPUs, **When** search_components is called with `{ type: "GPU", stock_status: "in_stock" }`, **Then** only GPUs with `stock_status == "in_stock"` are returned.
2. **Given** all RAM modules are out of stock, **When** search_components is called with `{ type: "RAM", stock_status: "in_stock" }`, **Then** an empty list is returned.
3. **Given** no stock_status filter is provided, **When** search_components is called with `{ type: "CPU" }`, **Then** both in-stock and out-of-stock components are returned (no stock filtering applied).

---

### User Story 4 - Filter Mainboards by RAM Generation (Priority: P2)

The Build Compiler needs to ensure mainboards and RAM modules are compatible by RAM generation. The catalog supports filtering mainboards by `ram_gen` (e.g., DDR5, DDR4) so the Compiler can match mainboard and RAM.

**Why this priority**: RAM generation mismatch is a fatal build error (E002 RAM_GEN_MISMATCH). This filter enables the Compiler to prevent that error during component search.

**Independent Test**: Can be tested by calling search with `{ type: "mainboard", ram_gen: "DDR5" }` and verifying all returned mainboards support DDR5.

**Acceptance Scenarios**:

1. **Given** mainboards with DDR4 and DDR5 support, **When** search_components is called with `{ type: "mainboard", ram_gen: "DDR5" }`, **Then** only DDR5 mainboards are returned.
2. **Given** a DDR5-only mainboard, **When** search_components is called with `{ type: "mainboard", ram_gen: "DDR4" }`, **Then** that mainboard is excluded from results.

---

### User Story 5 - Filter Cases by Form Factor and GPU Clearance (Priority: P3)

The Build Compiler needs to ensure a selected case fits the mainboard form factor and has enough clearance for the GPU. The catalog supports filtering cases by `form_factor` (ATX, mATX, ITX) and `clearance_mm` (minimum required) so the Compiler can validate physical fit.

**Why this priority**: Physical fit is important but lower priority than electrical compatibility (socket, RAM gen). Cases rarely block a build unless the user picks an unusually small case or long GPU.

**Independent Test**: Can be tested by calling search with `{ type: "case", form_factor: "ATX", clearance_mm: 300 }` and verifying all returned cases support ATX and have GPU clearance >= 300mm.

**Acceptance Scenarios**:

1. **Given** cases with form factors ATX, mATX, ITX and varying clearances, **When** search_components is called with `{ type: "case", form_factor: "mATX", clearance_mm: 280 }`, **Then** only cases supporting mATX (or larger, e.g., ATX cases that also fit mATX) with clearance >= 280mm are returned.
2. **Given** an ITX case with 250mm clearance, **When** search_components is called with `{ type: "case", clearance_mm: 300 }`, **Then** that case is excluded.

---

### User Story 6 - Multi-Criteria Combined Search (Priority: P1)

The Build Compiler frequently needs to combine multiple filters in a single call (e.g., "DDR5 mainboards under 5M VND that are in stock"). The catalog applies all provided criteria simultaneously (AND logic) to narrow results down to exactly matching components.

**Why this priority**: The Compiler's core loop calls search once per component type with combined criteria. Without combined filtering, the Compiler would need multiple round-trips, increasing complexity and latency.

**Independent Test**: Can be tested by calling search with `{ type: "mainboard", socket: "AM5", ram_gen: "DDR5", price_min: 3000000, price_max: 5000000, stock_status: "in_stock" }` and verifying all returned components satisfy all 5 conditions.

**Acceptance Scenarios**:

1. **Given** a diverse mainboard catalog, **When** search_components is called with `{ type: "mainboard", socket: "AM5", ram_gen: "DDR5", stock_status: "in_stock" }`, **Then** every returned component has type=mainboard, socket=AM5, ram_gen=DDR5, and stock_status=in_stock.
2. **Given** the same catalog, **When** conflicting criteria are provided (e.g., `socket: "AM5"` + `ram_gen: "DDR4"` — no such mainboard exists), **Then** an empty list is returned.

---

### Edge Cases

- What happens when criteria includes a type not present in the catalog (e.g., "speaker")? → Returns an empty list.
- What happens when price_min > price_max? → Returns an empty list (no component can satisfy contradictory bounds).
- What happens when a non-existent value is given for an enum field (e.g., `socket: "XYZ123"`)? → Returns an empty list.
- What happens when search_components is called with an empty criteria object `{}`? → Returns all ~50 components unfiltered.
- How does the system handle missing optional fields in criteria? → Only fields present in criteria are used for filtering; missing fields are ignored (no filter applied for that dimension).
- What happens when stock_status filter is an unsupported value (e.g., "discontinued")? → Returns an empty list (only "in_stock" and "out_of_stock" are valid).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The catalog MUST source data from two tiers: (1) live scraping via Apify of PhongVu.vn product listings across 8 component types, and (2) a built-in static mock dataset of approximately 50 pre-defined components when live data is unavailable.
- **FR-002**: Each component MUST have the following fields where applicable to its type:
  - All types: `id` (unique identifier), `name` (human-readable), `type` (one of the 8 types), `price` (VND, integer), `stock_status` ("in_stock" | "out_of_stock"), `promo` (string or null).
  - CPU: `socket` (e.g., AM5, LGA1700), `tdp` (watts, integer).
  - Mainboard: `socket` (e.g., AM5, LGA1700), `ram_gen` (DDR4 | DDR5), `form_factor` (ATX | mATX | ITX).
  - RAM: `ram_gen` (DDR4 | DDR5).
  - PSU: `wattage` (watts, integer), `form_factor` (ATX | SFX).
  - Case: `form_factor` (ATX | mATX | ITX), `clearance_mm` (integer, mm).
  - Cooler: `socket` (array of compatible socket strings, e.g., `["AM5", "AM4", "LGA1700"]`), `tdp` (max TDP support, watts).
  - Storage: no type-specific fields beyond shared fields.
  - GPU: `tdp` (watts), `clearance_mm` (length, integer).
- **FR-003**: The catalog MUST expose a `search_components(criteria)` function that accepts a criteria object with any combination of: `type`, `socket`, `ram_gen`, `form_factor`, `price_min`, `price_max`, `stock_status`, `clearance_mm`, `tdp_min`, `tdp_max`, `wattage_min`, `wattage_max`.
- **FR-004**: `search_components` MUST return results as an array of component objects. When no components match criteria, returns an empty array (never null/undefined).
- **FR-005**: `search_components` MUST apply AND logic across all provided criteria fields (a component must satisfy all specified conditions to be included).
- **FR-006**: `search_components` MUST ignore criteria fields that are not provided (omitted, null, or undefined) — they impose no filter.
- **FR-007**: Price range filtering MUST be inclusive on both ends (price_min <= price <= price_max).
- **FR-008**: Case form_factor filtering MUST use hierarchical matching: filtering for `mATX` returns mATX + ATX cases (any size >= requested). The hierarchy is ATX > mATX > ITX. Mainboard form_factor filtering uses exact match. Clearance filtering MUST be inclusive (case.clearance_mm >= criteria.clearance_mm).
- **FR-009**: The catalog MUST support two data sources: (a) live scraping via Apify from PhongVu.vn catalog, and (b) a built-in static mock dataset (~50 components). Live data is the primary source; mock data is the fallback when live scraping fails or is unavailable.
- **FR-010**: The adapter MUST fall back to mock data on a per-category basis: if Apify scraping fails for a specific component type (timeout, error, empty results), only that type uses mock data while other types continue using live data.
- **FR-011**: `search_components` applied to mock data MUST be deterministic — same criteria always produces the same result list in the same order. For live data, results MUST be sorted by price ascending (cheapest first).
- **FR-012**: Each returned component MUST include all fields relevant to its type, sufficient for the Build Compiler to perform compatibility validation without additional data fetches.

### Key Entities

- **Component**: Represents a single PC hardware part in the catalog. Has a type (CPU/mainboard/RAM/PSU/cooler/case/storage/GPU), shared fields (id, name, type, price, stock_status, promo), and type-specific fields (socket, ram_gen, tdp, wattage, clearance_mm, form_factor) that are present only when relevant to that type.
- **SearchCriteria**: Represents the filter parameters passed to `search_components`. All fields are optional. Multiple criteria combine via AND logic.

### Out of Scope (Explicit)

- `compare_components` function — deferred to a separate feature.
- Persistence layer or database — catalog data lives in-memory per session.
- Image URLs, detailed descriptions, or review data.
- Price history or price trending.
- Pagination or cursor-based results — the catalog is small enough for full return.
- Multi-vendor sourcing — only PhongVu catalog data (via Apify scraping).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `search_components` returns results for any valid criteria combination in under 50ms on commodity hardware (laptop-grade CPU).
- **SC-002**: Every component type has at least 5 pre-defined entries in the catalog, covering realistic real-world brands and specifications.
- **SC-003**: 100% of Compiler-driven component searches complete without errors when using either live (Apify) or mock data, with graceful fallback on live failure.
- **SC-004**: The mock fallback dataset covers every component type with at least 5 entries each, including at least one in-stock and one out-of-stock entry per type.
- **SC-005**: Calling `search_components` with the same criteria on mock data 100 times produces identical results (determinism verified). Live data results reflect the scraped catalog state.
