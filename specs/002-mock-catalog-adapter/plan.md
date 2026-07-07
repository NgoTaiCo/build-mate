# Implementation Plan: Catalog Adapter (Live-first, Mock fallback)

**Branch**: `002-mock-catalog-adapter` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-mock-catalog-adapter/spec.md`

## Summary

Catalog Adapter = Tool plugin layer (ADR-0001 §3) — provides `search_components(criteria)` cho Build Compiler với hai data source: (1) live scraping via Apify từ PhongVu.vn catalog, (2) static mock dataset ~50 components làm fallback. Live-first, per-category fallback khi Apify fail. Search filter 12 criteria field với AND logic, hierarchical form_factor matching (case), price-ascending sort. Trả về component với đầy đủ field Compiler cần (format align với `@buildmate/compiler` types — `data-model.md` 001). Package riêng TypeScript, pure functions cho mock path, async cho Apify path. Được gọi bởi OpenClaw tool plugin (HOUR 8-10 wire-up).

**Clarifications propagated (session 2026-07-07 — xem spec.md §Clarifications)**: (1) live-first via Apify, mock fallback; (2) per-category fallback khi Apify fail từng loại; (3) case form_factor hierarchical (ATX >= mATX >= ITX); (4) live results sort price ascending; (5) cooler socket compatibility = array of strings.

## Technical Context

**Language/Version**: TypeScript 5.x trên Node.js 22.17 LTS (LTS đã cài, Constitution Quality Gate = `npm test`)
**Primary Dependencies**: zero runtime dependency cho mock path (pure functions); dev-only: `typescript`, `tsx`, `@types/node`. Apify path: `apify-client` (official SDK cho Apify Actor invocation) — duy nhất 1 runtime dependency cho live scraping.
**Storage**: N/A — mock data in-memory trong code (static array); live data fetched per-request in-memory (không cache, không persist giữa session). Catalog data không cần DB.
**Testing**: `node:test` (Node built-in test runner) + `node:assert/strict` — same convention as `@buildmate/compiler` (001). Zero external test dependency.
**Target Platform**: Node 22+ (server-side tool plugin, same as compiler)
**Project Type**: library (package riêng — ADR-0001 §4.4 pattern: tách tool plugin thành package, test độc lập)
**Performance Goals**: mock search <50ms (FR-011, SC-001); live Apify scrape <5s (network-bound, không control được). Mock search = pure filter in-memory — computation trivial.
**Constraints**: zero OpenClaw runtime dependency; mock path = deterministic pure functions (FR-011); live path = async I/O qua Apify API; must return components in format compatible with `@buildmate/compiler` Component type (FR-012); per-category fallback (FR-010); price-ascending sort on live data (FR-011).
**Scale/Scope**: ~50 mock components across 8 types; 12 search criteria fields; 1 public function `search_components`; ~20 unit test (mock + live stub); 1 package (`packages/catalog/`). Cooler sockets = array.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| # | Nguyen tac (Constitution) | Trang thai | Ghi chu |
|---|---|---|---|
| I | OpenClaw owns session/memory | PASS | Catalog adapter khong touch session/memory. Khong xay SessionStore. Catalog data in-memory per-request. |
| II | Build Compiler = deterministic trust layer | N/A (Catalog layer) | Catalog != Compiler. Catalog cung cap data input cho Compiler. Mock path = pure functions (deterministic). Live path = async network I/O (non-deterministic by nature) — accepted constraint. |
| III | Model = provider config | PASS | Catalog khong goi model, khong them LangChain/LangGraph. |
| IV | WebChat = channel primary | N/A | Catalog = tool plugin, channel-agnostic. |
| V | Docs tieng Viet + English thuat ngu | PASS | Plan docs theo convention. |

| Constraint | Trang thai | Ghi chu |
|---|---|---|
| Hackathon time-box (HOUR 6-8 = MockCatalog) | PASS | Dung slot ADR-0003 §3. |
| MVP = S1+S3, S3 KHONG cat | PASS | search_components = S1 core. Compiler su dung catalog data cho compile_build (S1) + detect_errors (S3). |
| Quality Gate: `npm test` xanh truoc demo | PASS by design | Plan output ~20 unit test standalone. |
| boundary-architect: Catalog = Tool plugin layer, package rieng | PASS | `packages/catalog/` tach, khong tron OpenClaw runtime. |
| ADR-0003 §2.3 scope (OUT: P2/P3/P4, payment that) | PASS | compare_components out-of-scope (spec explicit). Apify scraping = only PhongVu (single vendor, in-scope decision Q1). |

**Gate result (pre-Phase 0)**: PASS — khong violation. Khong can Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-mock-catalog-adapter/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── catalog-api.md   # public function contracts
├── checklists/
│   └── requirements.md  # from /speckit.specify + /speckit.clarify
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/
├── compiler/                    # 001-build-compiler-core (existing)
│   └── ...
└── catalog/                     # 002-mock-catalog-adapter (this feature)
    ├── package.json             # name: @buildmate/catalog, "test": node --test
    ├── tsconfig.json            # strict, target ES2023, module NodeNext
    ├── src/
    │   ├── index.ts             # public API barrel: search_components
    │   ├── types.ts             # CatalogComponent, SearchCriteria, CatalogResult
    │   ├── mock-data.ts         # ~50 static components (all 8 types)
    │   ├── search.ts            # search_components core logic (filter + sort)
    │   ├── filter.ts            # individual filter predicates (socket, ram_gen, price, etc.)
    │   ├── form-factor.ts       # form_factor hierarchy constants + matching logic
    │   └── apify/               # Live scraping module
    │       ├── client.ts        # Apify API client wrapper
    │       └── mapper.ts        # PhongVu scraped data → CatalogComponent mapping
    └── tests/
        ├── search.test.ts       # core search: combined criteria, AND logic
        ├── filter-socket.test.ts     # socket filter (exact + cooler array match)
        ├── filter-price.test.ts      # price range filter (inclusive, min>max)
        ├── filter-stock.test.ts      # stock_status filter
        ├── filter-ram-gen.test.ts    # ram_gen filter
        ├── filter-form-factor.test.ts # form_factor filter (hierarchical for case, exact for mb)
        ├── filter-clearance.test.ts  # clearance_mm filter
        ├── filter-tdp.test.ts        # tdp_min/tdp_max filter
        ├── filter-wattage.test.ts    # wattage_min/wattage_max filter
        ├── mock-data.test.ts    # mock dataset integrity (≥5 per type, field completeness)
        ├── sort.test.ts         # price ascending sort, deterministic mock order
        └── apify.test.ts        # Apify client mock/stub tests (live tests skip without API key)
```

**Structure Decision**: Single library package tai `packages/catalog/` — same pattern as `packages/compiler/` (001). Package tach = ranh gioi vat ly enforcement: OpenClaw tool plugin (feature wire-up sau) import `@buildmate/catalog` lam dependency, khong tron code. Mock path = pure functions, test doc lap. Apify module = tach rieng trong `src/apify/` de mock path khong import no (FR-009 mock determinism preserved).

## Complexity Tracking

> Khong co Constitution violation → bang trong, khong ghi.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| — | — | — |

### Post-Phase 1 re-check (sau khi design xong + research clarified)

| # | Nguyen tac | Re-check | Evidence |
|---|---|---|---|
| I | OpenClaw owns session/memory | PASS | `data-model.md` §7: no state, no persistence. Mock data = static array; live data = fetched per-request. No session/memory management. `contracts/catalog-api.md` §5: no OpenClaw tool registration in this feature. |
| II | Build Compiler = deterministic trust layer | N/A (catalog) | Catalog provides data FOR Compiler, does not do compatibility checks. Mock path = deterministic pure functions (`contracts` §1 `searchComponentsMock`). `research.md` §1 explicit: catalog field mapping to Compiler format ensures Compiler gets data it needs. |
| III | Model = provider config | PASS | `contracts` §5: "no LLM calls — deterministic filter + sort only". No LangChain/LangGraph. |
| IV | WebChat primary | N/A | Catalog = library, channel-agnostic. `contracts` doesn't mention channel. |
| V | Docs tieng Viet + English thuat ngu | PASS | All artifacts (plan/research/data-model/contracts/quickstart) follow convention. |
| Hackathon | time-box HOUR 6-8 | PASS | `quickstart.md` explicit: wire-up = feature sau (HOUR 8-10); feature nay = core only. ~50 mock + Apify client. |
| Quality Gate | `npm test` xanh | PASS | `quickstart.md`: ~20 tests, 12 test files, all mock-path deterministic. Apify tests stubbed (no API key needed). |
| boundary | Catalog = Tool plugin layer, package rieng | PASS | `packages/catalog/` tach; `contracts` §5 non-goals: "no OpenClaw tool registration". `data-model.md` §7: "no state, pure functions for mock path". |
| ADR-0003 §2.3 scope | OUT: P2/P3/P4, no scope creep | PASS | compare_components out-of-scope (spec explicit + `contracts` §5). Apify = only PhongVu (single vendor, in-scope per clarification Q1). No caching, no pagination, no multi-vendor. |

**Gate result (post-Phase 1)**: PASS — design khong drift. Mock path deterministic (Principle II consistent); live path async = accepted constraint. Khong violation can Complexity Tracking.
