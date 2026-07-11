# Tasks: Catalog Adapter (Live-first, Mock fallback)

**Input**: Design documents from `/specs/002-mock-catalog-adapter/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/catalog-api.md, quickstart.md

**Tests**: Included — spec quality gate requires `npm test` pass with ~20 test cases across 12 test files.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2...)
- Include exact file paths in descriptions

## Path Conventions

- Source: `packages/catalog/src/`
- Tests: `packages/catalog/tests/`
- Package root: `packages/catalog/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, directory structure, dependencies

- [X] T001 Create directory structure: `packages/catalog/src/apify/`, `packages/catalog/tests/`
- [X] T002 Initialize package.json at `packages/catalog/package.json` with name `@buildmate/catalog`, type `module`, test script `node --import tsx --test tests/*.test.ts`
- [X] T003 [P] Create tsconfig.json at `packages/catalog/tsconfig.json` (strict, target ES2023, module NodeNext)
- [X] T004 [P] Install dependencies: `npm install` at `packages/catalog/` (dev: typescript, tsx, @types/node; runtime: apify-client)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, constants, filter predicates, and mock dataset — MUST complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 [P] Create all type definitions in `packages/catalog/src/types.ts` — CatalogComponent (8 type-specific shapes: cpu/mainboard/ram/psu/cooler/case/storage/gpu), SearchCriteria (12 optional fields), CatalogResult, ComponentType, DataSource, DataSourceError (per data-model.md §1-§3)
- [X] T006 [P] Create form factor hierarchy constants in `packages/catalog/src/form-factor.ts` — FORM_FACTOR_RANK (ITX=1/mATX=2/ATX=3) and FORM_FACTOR_COMPAT lookup (per data-model.md §5 + research.md §4)
- [X] T007 [P] Create all filter predicate factories in `packages/catalog/src/filter.ts` — makeTypePredicate, makeSocketPredicate (exact for cpu/mb, array.includes for cooler), makeRamGenPredicate, makeFormFactorPredicate (hierarchical for case, exact for mb), makeStockPredicate, makePricePredicate (inclusive), makeClearancePredicate (inclusive >=), makeTdpPredicate, makeWattagePredicate, composePredicates (AND logic) (per research.md §5 + FR-005/FR-006/FR-007/FR-008)
- [X] T008 [P] Create mock dataset in `packages/catalog/src/mock-data.ts` — ~50 CatalogComponent entries across 8 types (CPU:6, mainboard:6, RAM:6, PSU:6, cooler:6, case:6, storage:6, GPU:8), each with ≥1 in_stock + ≥1 out_of_stock per type, realistic brands/specs in VND, all Compiler-required fields populated (per research.md §3 + SC-002/SC-004)
- [X] T009 Create mock data integrity test in `packages/catalog/tests/mock-data.test.ts` — verify: ≥5 per type, ≥1 in_stock/out_of_stock each type, unique IDs, all required fields non-null, all type discriminators valid (per SC-004 + quickstart.md test suite)

**Checkpoint**: Foundation ready — types, filters, mock data in place. All filter predicates independently functional.

---

## Phase 3: User Story 6 - Multi-Criteria Combined Search (Priority: P1) 🎯 MVP

**Goal**: `searchComponentsMock` orchestrator that combines all filter predicates with AND logic, sorts by price ascending, returns deterministic results. This is THE core feature — all other stories verify individual filter predicates.

**Independent Test**: Call `searchComponentsMock({ type: "mainboard", socket: "AM5", ram_gen: "DDR5", stock_status: "in_stock" })` — returns only AM5 DDR5 in-stock mainboards, price-ascending.

### Tests for User Story 6

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T010 [P] [US6] Create combined search test in `packages/catalog/tests/search.test.ts` — test: multi-criteria AND logic, single criterion, empty criteria `{}`, conflicting criteria (empty), unknown type (empty), no-match (empty array, never null)
- [X] T011 [P] [US6] Create sort test in `packages/catalog/tests/sort.test.ts` — test: price ascending order, stable mock order, deterministic (100 calls same result)

### Implementation for User Story 6

- [X] T012 [US6] Implement `searchComponentsMock` in `packages/catalog/src/search.ts` — orchestrate: determine target types → filter via composePredicates → sort by price ascending → return CatalogComponent[] (FR-004 never null, FR-005 AND logic, FR-006 ignore missing fields, FR-011 price ascending)
- [X] T013 [US6] Create barrel export in `packages/catalog/src/index.ts` — export `searchComponentsMock` from search.ts, re-export types from types.ts (per contracts/catalog-api.md §1)

**Checkpoint**: `searchComponentsMock` fully functional — run `npx tsx -e "import { searchComponentsMock } from './packages/catalog/src/index.ts'; console.log(searchComponentsMock({}).length)"` should return ~50

---

## Phase 4: User Story 1 - Socket Filter (Priority: P1)

**Goal**: Verify socket filter works for CPU (exact match), mainboard (exact match), and cooler (array.includes).

**Independent Test**: `searchComponentsMock({ type: "cpu", socket: "AM5" })` returns only AM5 CPUs; `searchComponentsMock({ type: "cooler", socket: "AM5" })` returns coolers with AM5 in their socket array.

### Tests for User Story 1

> **NOTE: Tests should FAIL initially (if filter not yet verifying correctly) then PASS after validation**

- [X] T014 [P] [US1] Create socket filter test in `packages/catalog/tests/filter-socket.test.ts` — test: exact CPU match (AM5→AM5 CPUs only), exact mainboard match, cooler array.includes match, unknown socket (empty), no socket filter (returns all of that type), multi-socket cooler match (per FR-002 + clarification Q5)

### Implementation for User Story 1

_No new implementation — socket predicate in filter.ts (T007) already covers this. Tasks for validation & edge cases._

- [X] T015 [US1] Verify and harden makeSocketPredicate edge cases in `packages/catalog/src/filter.ts` — CPU without socket field → skipped (not matched), cooler with empty socket array → not matched, case sensitivity (AM5 === am5? → enforce uppercase)

---

## Phase 5: User Story 2 - Price Range Filter (Priority: P2)

**Goal**: Verify price range filter with inclusive bounds (min <= price <= max).

**Independent Test**: `searchComponentsMock({ type: "cpu", price_min: 3000000, price_max: 8000000 })` returns CPUs in 3M-8M range.

### Tests for User Story 2

- [X] T016 [P] [US2] Create price filter test in `packages/catalog/tests/filter-price.test.ts` — test: inclusive range, min-only (price >= min), max-only (price <= max), min > max (empty), no match (all prices outside range), boundary case (min == max == component price → included)

### Implementation for User Story 2

- [X] T017 [US2] Verify makePricePredicate handles edge cases in `packages/catalog/src/filter.ts` — negative price (should not exist but guard), non-numeric price (skip, not match), missing price field (skip)

---

## Phase 6: User Story 3 - Stock Status Filter (Priority: P2)

**Goal**: Verify stock_status filter correctly separates in_stock / out_of_stock.

**Independent Test**: `searchComponentsMock({ type: "gpu", stock_status: "in_stock" })` returns only GPUs with stock_status === "in_stock".

### Tests for User Story 3

- [X] T018 [P] [US3] Create stock filter test in `packages/catalog/tests/filter-stock.test.ts` — test: in_stock only, out_of_stock only, no filter (both returned), unknown status value (empty), missing stock_status field (skip)

### Implementation for User Story 3

_No new implementation — makeStockPredicate in filter.ts (T007) covers this._

---

## Phase 7: User Story 4 - RAM Generation Filter (Priority: P2)

**Goal**: Verify ram_gen filter on mainboards and RAM modules.

**Independent Test**: `searchComponentsMock({ type: "mainboard", ram_gen: "DDR5" })` returns only DDR5 mainboards.

### Tests for User Story 4

- [X] T019 [P] [US4] Create RAM gen filter test in `packages/catalog/tests/filter-ram-gen.test.ts` — test: DDR5 mainboards only, DDR4 RAM only, mismatch (no DDR4 mainboards when filtering DDR5), filter on type without ram field (skip — no effect), case sensitivity

### Implementation for User Story 4

- [X] T020 [US4] Verify makeRamGenPredicate in `packages/catalog/src/filter.ts` — mainboard matches against `ram_gen_supported[]` (includes check), RAM matches against `generation` string (exact), component without ram field → skip

---

## Phase 8: User Story 5 - Form Factor & Clearance Filter (Priority: P3)

**Goal**: Verify form_factor hierarchical case matching + clearance_mm filter.

**Independent Test**: `searchComponentsMock({ type: "case", form_factor: "mATX" })` returns mATX + ATX cases; `searchComponentsMock({ type: "case", clearance_mm: 300 })` returns cases with clearance >= 300mm.

### Tests for User Story 5

- [X] T021 [P] [US5] Create form factor filter test in `packages/catalog/tests/filter-form-factor.test.ts` — test: case hierarchical (mATX→ATX+mATX, ITX→all), mainboard exact (mATX→mATX only), ITX case→ITX only, unknown form_factor (empty), non-case/non-mb type (skip)
- [X] T022 [P] [US5] Create clearance filter test in `packages/catalog/tests/filter-clearance.test.ts` — test: inclusive >=, strict > not required, no match, component without clearance (skip)
- [X] T023 [P] [US5] Create TDP filter test in `packages/catalog/tests/filter-tdp.test.ts` — test: tdp_min only, tdp_max only, combined range, no component with tdp (skip)
- [X] T024 [P] [US5] Create wattage filter test in `packages/catalog/tests/filter-wattage.test.ts` — test: wattage_min only, wattage_max only, non-PSU type (skip — no wattage field)

### Implementation for User Story 5

- [X] T025 [US5] Verify makeFormFactorPredicate in `packages/catalog/src/filter.ts` — case uses FORM_FACTOR_RANK >= comparison, mainboard uses exact string ===, non-case/mb component → skip (per FR-008 + research §4)
- [X] T026 [US5] Verify makeClearancePredicate, makeTdpPredicate, makeWattagePredicate handle missing fields gracefully in `packages/catalog/src/filter.ts` — component without field → skip (not fail), non-numeric → skip

---

## Phase 9: Apify Live Data Integration

**Purpose**: Live scraping via Apify with per-category mock fallback. Requires APIFY_API_KEY env var.

**Note**: This phase can be worked on in parallel with Phase 4-8 (individual filter tests).

- [X] T027 [P] Create Apify client wrapper in `packages/catalog/src/apify/client.ts` — Apify client init from `APIFY_API_KEY` env var, `fetchType(type: ComponentType)` method calling Actor.run with timeout 10s, error handling → return null on failure (per research.md §2 + FR-010)
- [X] T028 [P] Create Apify product mapper in `packages/catalog/src/apify/mapper.ts` — `mapScrapedProduct(raw)` → CatalogComponent: parse `specs` text via regex for socket/TDP/ram_gen/form_factor/wattage/clearance per type; infer `type` from PhongVu category; map `stock_status` from text ("Còn hàng"→in_stock, else→out_of_stock); map `price` to integer VND (per research.md §8)
- [X] T029 [P] Create Apify integration test (stubbed) in `packages/catalog/tests/apify.test.ts` — test: mapper parses known spec text correctly, client returns null when no API key, mapper handles missing fields (returns null for unparseable), fallback to mock on client failure

### Implementation for Live Search

- [X] T030 Implement `searchComponents` async function in `packages/catalog/src/search.ts` — per-category fetch: for each type → try Apify → on fail use mock for that type; merge results → apply filters → sort price ascending; return CatalogResult with `source` and `errors[]` (per contracts/catalog-api.md §2 + research.md §6)
- [X] T031 [US6] Update barrel export in `packages/catalog/src/index.ts` — add `searchComponents` export

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, integrity checks, documentation

- [X] T032 Run full test suite: `npm test` in `packages/catalog/` — all tests pass, ~20 test cases across 12 files
- [X] T033 Run typecheck: `npm run typecheck` in `packages/catalog/` — zero errors
- [X] T034 Validate against quickstart.md checklist — all setup steps verified, project structure matches, test suite coverage complete
- [X] T035 [P] Verify mock data component count: `searchComponentsMock({}).length` ≈ 50
- [X] T036 [P] Verify determinism: call `searchComponentsMock({ type: "cpu" })` 100 times → identical arrays (SC-005)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) — BLOCKS all user stories
- **User Story 6 (Phase 3)**: Depends on Foundational (Phase 2) — Core search orchestrator 🎯 MVP
- **User Story 1–5 (Phase 4–8)**: Depends on Foundational (Phase 2) — Individual filter tests. Can run in parallel with each other and with Phase 3
- **Apify Integration (Phase 9)**: Depends on Foundational (Phase 2) + Phase 3 (US6 search). Can run in parallel with Phase 4-8
- **Polish (Phase 10)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1 - Socket)**: After Foundational — No dependencies on other stories
- **US2 (P2 - Price)**: After Foundational — No dependencies on other stories
- **US3 (P2 - Stock)**: After Foundational — No dependencies on other stories
- **US4 (P2 - RAM Gen)**: After Foundational — No dependencies on other stories
- **US5 (P3 - Form Factor)**: After Foundational — No dependencies on other stories
- **US6 (P1 - Combined Search)**: After Foundational — Uses all filter predicates (T007), independent of individual filter tests (US1-US5)

### Within Each User Story

- Tests MUST be written and FAIL before implementation (where applicable)
- Implementation tasks after tests
- Tests → verify → story complete

### Parallel Opportunities

- T003 + T004: tsconfig and npm install can run together
- T005, T006, T007, T008: All foundational source files can be created in parallel (different files)
- T010 + T011: Search and sort tests in parallel
- T014, T016, T018, T019, T021–T024: All individual filter tests can be created in parallel (12 test files, different files)
- T027, T028, T029: Apify client, mapper, and test can be created in parallel
- Phase 4–8 (US1–US5) can run entirely in parallel — all are test-only phases verifying existing filter predicates
- Phase 4–8 + Phase 9 can run in parallel after Phase 3 is complete

---

## Parallel Example: Foundational Phase

```bash
# Launch all foundational source files together:
Task: "Create all type definitions in packages/catalog/src/types.ts"
Task: "Create form factor hierarchy constants in packages/catalog/src/form-factor.ts"
Task: "Create all filter predicate factories in packages/catalog/src/filter.ts"
Task: "Create mock dataset in packages/catalog/src/mock-data.ts"
```

## Parallel Example: Individual Filter Tests (US1–US5)

```bash
# After Phase 2 & 3 complete, launch all filter tests in parallel:
Task: "socket filter test in packages/catalog/tests/filter-socket.test.ts"
Task: "price filter test in packages/catalog/tests/filter-price.test.ts"
Task: "stock filter test in packages/catalog/tests/filter-stock.test.ts"
Task: "RAM gen filter test in packages/catalog/tests/filter-ram-gen.test.ts"
Task: "form factor filter test in packages/catalog/tests/filter-form-factor.test.ts"
Task: "clearance filter test in packages/catalog/tests/filter-clearance.test.ts"
Task: "TDP filter test in packages/catalog/tests/filter-tdp.test.ts"
Task: "wattage filter test in packages/catalog/tests/filter-wattage.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 6 Only — Core Search)

1. Complete Phase 1: Setup → directory + package initialized
2. Complete Phase 2: Foundational → types + filters + mock data ready
3. Complete Phase 3: US6 → `searchComponentsMock` functional
4. **STOP and VALIDATE**: Run `T010, T011` tests — core search works
5. `npx tsx -e "import { searchComponentsMock } from './packages/catalog/src/index.ts'; console.log(searchComponentsMock({ type: 'cpu', socket: 'AM5' }))"` → returns AM5 CPUs

### Incremental Delivery

1. Setup + Foundational → Core building blocks ready
2. US6 (Combined Search) → `searchComponentsMock` works → **MVP!**
3. US1–US5 (Individual filter tests) → All 12 test files pass → Full test coverage
4. Apify (Live data) → `searchComponents` works with live data → Production-ready
5. Polish → `npm test` green, typecheck clean → **Hackathon demo ready**

### Parallel Team Strategy

With 2 developers:

1. Both: Setup + Foundational (Phase 1-2) together
2. Once Foundational done:
   - **Developer A**: Phase 3 (US6 search orchestrator) + Phase 9 (Apify)
   - **Developer B**: Phase 4-8 (US1–US5 individual filter tests)
3. Both: Phase 10 (Polish) — verify everything passes

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests use `node:test` + `node:assert/strict` — zero external test dependencies
- Mock data path (T005–T026) = pure functions, no Apify/network needed
- Apify path (T027–T031) = requires `APIFY_API_KEY` env var; tests stubbed
- Commit after each phase checkpoint
- Run `npm test` after each phase to verify no regressions
- Constitution Quality Gate: `npm test` must pass (all ~20 tests) before demos
