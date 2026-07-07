# Research: Catalog Adapter

**Branch**: `002-mock-catalog-adapter` | **Date**: 2026-07-07
**Source**: spec.md FR-001–FR-012 + Constitution Principle II

## 1. Component Field Mapping: Catalog → Compiler

**Decision**: Catalog adapter emits components trong format tương thích với `@buildmate/compiler` Component type (định nghĩa tại `specs/001-build-compiler-core/data-model.md` §2). Catalog spec's field names là logical descriptors; implementation translates sang Compiler field names.

**Rationale**: FR-012 requires "Each returned component MUST include all fields relevant to its type, sufficient for the Build Compiler to perform compatibility validation". Compiler không biết về catalog field names — catalog phải emit đúng contract.

**Alternatives considered**:
- Trả về raw catalog field names + để Compiler tự map → rejected: vi phạm FR-012, Compiler cần import catalog types.
- Catalog định nghĩa interface riêng + provide adapter function → rejected: thêm layer không cần thiết cho hackathon time-box.

**Mapping table** (catalog logical field → Compiler field):

| Component | Catalog field | Compiler field | Notes |
|---|---|---|---|
| CPU | `socket` | `socket` | Same |
| CPU | `tdp` | `tdp` | Same |
| CPU | — | `ram_gen_supported: string[]` | Derived from CPU model known specs. Mock data hardcodes (e.g., 7800X3D → `["DDR5"]`). Apify scraped → parse from product spec text. |
| Mainboard | `socket` | `socket` | Same |
| Mainboard | `ram_gen` (single) | `ram_gen_supported: string[]` | Wrap single value: `"DDR5"` → `["DDR5"]`. Mainboard hỗ trợ 1 generation (99% case). Chấp nhận single-value in mock; Apify có thể parse multi nếu Z790 DDR4+DDR5. |
| Mainboard | `form_factor` (single) | `form_factor` (single) | Same string (e.g., `"ATX"`, `"mATX"`, `"ITX"`). |
| RAM | `ram_gen` (single) | `generation` (single) | Rename. Compiler dùng `generation`, catalog dùng `ram_gen`. |
| RAM | — | `tdp` (optional) | Derived: DDR5 ~3W/stick, DDR4 ~2W/stick. Mock data include optional `tdp`. |
| PSU | `wattage` | `wattage` | Same |
| PSU | `form_factor` | `form_factor` | Same (`"ATX"`, `"SFX"`). |
| Case | `form_factor` (single) | `supported_mb_form_factors: string[]` | Derive từ hierarchy. `"ATX"` → `["ATX", "mATX", "ITX"]`; `"mATX"` → `["mATX", "ITX"]`; `"ITX"` → `["ITX"]`. |
| Case | — | `supported_psu_form_factors: string[]` | Derived. ATX/mATX cases → `["ATX", "SFX"]` (both supported); ITX cases → `["SFX"]` typically. Mock data hardcodes. |
| Case | — | `max_cooler_height` (number) | Derived từ product spec. Mock data hardcodes realistic values (ATX ~165-175mm, mATX ~160mm, ITX ~70-85mm). Not directly in catalog spec — added during implementation. |
| Case | `clearance_mm` | (pass-through) | GPU length clearance. Compiler 001 không check GPU clearance — pass-through cho future use / display. |
| Cooler | `socket` (array) | (pass-through) | Compiler 001 không check cooler socket compatibility — pass-through. |
| Cooler | `tdp` (max TDP) | (pass-through) | Compiler 001 không check TDP matching — pass-through cho future / display. |
| Cooler | — | `height` (number) | DERIVED: catalog must include height for Compiler E004. Mock data hardcodes (tower ~155-165mm, low-profile ~60-70mm). Apify scraped from spec text. |
| GPU | `tdp` | `tdp` | Same |
| GPU | `clearance_mm` | (pass-through) | GPU length. Compiler 001 không check. |

**Key insight**: Catalog có nhiều field hơn Compiler cần (cookie socket, clearance_mm cho GPU, TDP cho cooler). Catalog keep all fields — Compiler consume subset; extra fields không gây lỗi (Compiler type union `tdp? optional`). FR-012 satisfied: all required Compiler fields populated.

## 2. Apify Integration Pattern

**Decision**: Sử dụng `apify-client` npm package làm dependency runtime duy nhất. Apify Actor đã được pre-built để scrape PhongVu.vn (Actor ID cần được cấu hình). API key từ env var `APIFY_API_KEY`.

**Rationale**: User specified Apify as partner. Official SDK handles auth, retry, timeout natively. Actor-based architecture = Apify manages scraping infrastructure, ta chỉ gọi API.

**Alternatives considered**:
- Tự build scraper với Puppeteer/Playwright → rejected: tốn thời gian, cần maintain infrastructure, không phù hợp hackathon.
- Dùng raw HTTP fetch → rejected: Apify authentication phức tạp, SDK xử lý sẵn.

**Apify flow**:
```
CatalogClient.search_components(criteria)
  → for each type in criteria (or all 8 types):
    → call Apify Actor.run({ type, ... })  (parallel if multiple types)
    → on success: map scraped data → CatalogComponent[]
    → on failure: fallback to mock data for that type
  → merge all types → apply filter predicates → sort → return
```

**Timeout & retry**: Apify Actor call timeout = 10s (hackathon constraint — không chờ lâu). Retry = 0 (per-category fallback handles failure). Actor warm-up time có thể chậm lần đầu → accept first-call latency.

**Actor output contract**: Apify Actor trả về JSON array of product objects với các field: `name`, `price`, `stock_status`, `specs` (raw text). `mapper.ts` chịu trách nhiệm parse `specs` text → structured fields (socket, ram_gen, tdp, form_factor, clearance, wattage). Regex-based parsing, fallback to null nếu không parse được.

## 3. Mock Dataset Design

**Decision**: ~50 components hardcoded trong `src/mock-data.ts` dạng static array `CatalogComponent[]`. Mỗi type ≥5 entry, ≥1 in-stock + ≥1 out-of-stock. Giá realistic VND. Brand/spec theo sản phẩm thực tế (không invented) để Compiler test có ý nghĩa.

**Rationale**: SC-002 và SC-004 yêu cầu ≥5 per type + in-stock/out-of-stock mix. Hardcoded = deterministic (FR-011 mock path). Không cần JSON file riêng — compile-time check integrity.

**Distribution**:

| Type | Count | Notes |
|---|---|---|
| CPU | 6 | 3 AM5 (Ryzen 7000/9000), 3 LGA1700 (Intel 12th/13th/14th gen) |
| Mainboard | 6 | 3 AM5 (B650/X670), 3 LGA1700 (B760/Z790); mix ATX/mATX |
| RAM | 6 | 3 DDR5 (16/32GB kits), 3 DDR4 (16/32GB kits) |
| PSU | 6 | Mix 550W–1000W, ATX + 2 SFX |
| Cooler | 6 | 2 air tower, 2 AIO 240/360mm, 2 low-profile |
| Case | 6 | 2 ATX, 2 mATX, 2 ITX; mix GPU clearance 250–400mm |
| Storage | 6 | 3 NVMe SSD, 2 SATA SSD, 1 HDD |
| GPU | 8 | Mix NVIDIA RTX 30/40 series + AMD RX 6000/7000; mix TDP 150–450W |

## 4. form_factor Hierarchy Implementation

**Decision**: Define hierarchy constant: `FF_RANK = { ITX: 1, mATX: 2, ATX: 3 }`. Filter predicate: `FF_RANK[component.form_factor] >= FF_RANK[criteria.form_factor]` cho case; `===` cho mainboard (FR-008).

**Rationale**: FR-008 from clarification Q3: hierarchical matching for cases, exact for mainboards. Rank-based comparison đơn giản, dễ test, deterministic.

**Case → Compiler field derivation**:
```
input: case.form_factor = "ATX"
output: case.supported_mb_form_factors = ["ATX", "mATX", "ITX"]  (all <= ATX)
        case.supported_psu_form_factors = ["ATX", "SFX"]          (ATX cases fit both)
```

**Mock data rule**: `supported_mb_form_factors` pre-computed khi định nghĩa mock data (không compute runtime) — performance + determinism. Apify path: derive từ scraped form_factor sau khi parse.

## 5. Search Filter Implementation Pattern

**Decision**: Each criteria field → standalone predicate function. `search_components` compose tất cả active predicate với AND logic. Filter order: type → socket → ram_gen → form_factor → stock_status → price → clearance → tdp → wattage. Sort: price ascending (live) or stable-order (mock).

**Rationale**: FR-005 AND logic, FR-006 ignore missing fields. Standalone predicate dễ unit test từng filter. Filter order optimized: type discriminant first (narrow most), then cheap equality checks, then range checks.

**Predicate signatures**:
```typescript
type Predicate = (component: CatalogComponent) => boolean;

function makeTypePredicate(type: string): Predicate;
function makeSocketPredicate(socket: string): Predicate;  // exact for CPU/mb, array.includes for cooler
function makeRamGenPredicate(ram_gen: string): Predicate; // exact match on generation field
function makeFormFactorPredicate(form_factor: string, isCase: boolean): Predicate; // hierarchical or exact
function makeStockPredicate(stock_status: string): Predicate;
function makePricePredicate(min?: number, max?: number): Predicate; // inclusive
function makeClearancePredicate(min?: number): Predicate; // component.clearance_mm >= min
function makeTdpPredicate(min?: number, max?: number): Predicate;
function makeWattagePredicate(min?: number, max?: number): Predicate;
```

**Cooler socket special case**: Cooler có `socket: string[]`. Filter `search_components({ type: "cooler", socket: "AM5" })` → predicate = `c.socket.includes("AM5")`. Deterministic, no fuzzy matching.

## 6. Per-Category Fallback Architecture

**Decision**: `search_components` orchestrates data fetching per type. Mỗi type fetched independently: Apify call → success (use live) / failure (use mock). Merge results rồi apply filter predicates.

**Rationale**: FR-010 yêu cầu per-category (clarification Q2). Architecture cho phép partial success: nếu Apify succeed CPU + GPU nhưng fail Storage → CPU/GPU live data, Storage mock data. Không atomic requirement — accepted tradeoff cho hackathon.

**Implementation sketch**:
```typescript
async function search_components(criteria: SearchCriteria): Promise<CatalogComponent[]> {
  const types = criteria.type ? [criteria.type] : ALL_TYPES;
  const results: CatalogComponent[] = [];
  
  for (const type of types) {
    try {
      const live = await fetchFromApify(type, criteria);
      results.push(...live);
    } catch {
      const mock = getMockData(type);
      results.push(...mock);
    }
  }
  
  return applyFilters(results, criteria).sort(byPriceAscending);
}
```

**Mock data segregation**: `getMockData(type)` trả về mock components for that type only. Keeps mock data organized by type.

## 7. TypeScript Module Structure

**Decision**: Same pattern as `@buildmate/compiler` (001): strict tsconfig, ES2023 target, NodeNext module. Testing via `node:test`. Package name: `@buildmate/catalog`.

**Rationale**: Convention consistency với 001. `node:test` = zero external test dependency (Constitution Quality Gate).

**Module separation**:
- `src/index.ts` — public API: `search_components`
- `src/types.ts` — type definitions
- `src/mock-data.ts` — static mock dataset
- `src/search.ts` — orchestrator: fetch + filter + sort + merge
- `src/filter.ts` — predicate factories
- `src/form-factor.ts` — hierarchy constants
- `src/apify/client.ts` — Apify SDK wrapper (dependency isolated)
- `src/apify/mapper.ts` — scraped data → CatalogComponent

**Mock path purity**: `search.ts`, `filter.ts`, `form-factor.ts`, `mock-data.ts` không import `src/apify/` — pure functions, deterministic. Chỉ `search_components` (entry point) mới import Apify module. Cho phép unit test mock data path không cần Apify API key.

## 8. Apify Actor Specs Parsing Strategy

**Decision**: Regex-based parsing từ `specs` text field (raw HTML scraped from PhongVu product page). Mỗi component type có parser riêng. Fallback: nếu không parse được → omit field (nullable, Compiler skip non-critical).

**Rationale**: PhongVu.vn không có structured API — specs nằm trong HTML table với key-value pairs. Regex approach pragmatic cho hackathon (không cần NLP/LLM cho parsing). Field parse được = type-specific regex patterns.

**Parse patterns** (examples):

| Field | Regex pattern | Example match |
|---|---|---|
| CPU socket | `/Socket:\s*(AM\d\|LGA\d+)/i` | "Socket: AM5" |
| CPU TDP | `/TDP:\s*(\d+)\s*W/i` | "TDP: 65W" |
| RAM gen | `/DDR(\d)/i` | "DDR5" |
| PSU wattage | `/(\d+)\s*W/i` | "650W" |
| Form factor | `/(ATX\|mATX\|Mini-ITX\|ITX)/i` | "ATX" |
| Clearance | `/GPU\s*.*?(\d+)\s*mm/i` | "GPU max 320mm" |

**Unparseable fields**: Set to `null`/`undefined` — Compiler handles missing attributes via E006 if field is required for compatibility.

## 9. No Caching Strategy

**Decision**: Không cache Apify results. Mỗi `search_components` call = fresh Apify call.

**Rationale**: Hackathon time-box — caching adds complexity (TTL, invalidation, stale data handling) không worth it. Live data freshness prioritized. Accept latency tradeoff. Mock data = instant (no network).

