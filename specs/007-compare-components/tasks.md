# Tasks: Component Comparison Tool

**Input**: Design documents from `/specs/007-compare-components/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md
**Note**: S2 stretch feature — chỉ implement sau khi 001+002+003 hoàn thành. Mỗi user story implement và test độc lập.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize comparator package and workspace wiring

- [ ] T001 Create comparator package directory structure (`packages/comparator/src/`, `packages/comparator/tests/`) per implementation plan
- [ ] T002 Initialize `packages/comparator/package.json` with name `@buildmate/comparator`, dev deps (`typescript`, `tsx`, `@types/node`), and test script
- [ ] T003 [P] Create `packages/comparator/tsconfig.json` (strict, target ES2023, module NodeNext)
- [ ] T004 [P] Add `@buildmate/comparator` workspace entry to root `package.json` if root workspaces exist

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, validation, and catalog SKU lookup extension

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Extend `@buildmate/catalog` `SearchCriteria` type with optional `sku?: string[]` in `packages/catalog/src/types.ts`
- [ ] T006 Implement `sku` array filter predicate in `packages/catalog/src/search.ts`
- [ ] T007 Add unit test for catalog `sku` filter in `packages/catalog/tests/search.test.ts`
- [ ] T008 Define comparator types (`CompareInput`, `ComparisonTable`, `ComparisonRow`, `Recommendation`, `CompareErrorCode`) in `packages/comparator/src/types.ts`
- [ ] T009 Implement input validation (`skus` count 2-5, `use_case` enum) in `packages/comparator/src/validate.ts`
- [ ] T010 [P] Add unit tests for input validation in `packages/comparator/tests/validate.test.ts`

**Checkpoint**: Foundation ready — catalog can lookup by SKU, comparator types and validation defined and tested

---

## Phase 3: User Story 1 - Compare Multiple Components Side-by-Side (Priority: P1) 🎯 MVP

**Goal**: Shopper cung cấp 2-5 SKU cùng category và nhận comparison table với 9 spec fields side-by-side.

**Independent Test**: Gọi `compareComponents({ skus: ["cpu-001", "cpu-002"] })` với mock catalog → trả về table có 2 rows, đủ 9 fields, thứ tự giữ nguyên.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T011 [P] [US1] Write unit test for 2-SKU comparison table fields in `packages/comparator/tests/compare.test.ts`
- [ ] T012 [P] [US1] Write unit test for 3-5 SKU comparison table in `packages/comparator/tests/compare.test.ts`
- [ ] T013 [P] [US1] Write unit test for missing spec field placeholders in `packages/comparator/tests/compare.test.ts`
- [ ] T014 [P] [US1] Write unit test for category mismatch error (`C004`) in `packages/comparator/tests/compare.test.ts`
- [ ] T015 [P] [US1] Write unit test for unknown SKU error (`C003`) in `packages/comparator/tests/compare.test.ts`

### Implementation for User Story 1

- [ ] T016 [P] [US1] Create catalog adapter to call `search_components({ sku })` in `packages/comparator/src/catalog-adapter.ts`
- [ ] T017 [US1] Implement deterministic comparison table generation in `packages/comparator/src/compare.ts`
- [ ] T018 [US1] Map catalog fields to comparison row fields (price, stock, promo, socket, ram_gen, tdp, wattage, clearance, form_factor) in `packages/comparator/src/compare.ts`
- [ ] T019 [US1] Add missing-field placeholder handling (`"—"`) in `packages/comparator/src/compare.ts`
- [ ] T020 [US1] Add category homogeneous validation (`C004`) in `packages/comparator/src/compare.ts`
- [ ] T021 [US1] Export `compareComponents` from barrel `packages/comparator/src/index.ts`
- [ ] T022 [US1] Run `npm test` in `packages/comparator` and verify all compare/validate tests pass

**Checkpoint**: User Story 1 fully functional — 2-5 SKU comparison table deterministic và testable independently

---

## Phase 4: User Story 2 - Receive Best-Fit Recommendation by Use Case (Priority: P2)

**Goal**: Sau khi có comparison table, shopper chọn use case (gaming/productivity/budget) và nhận deterministic best-fit recommendation với lý do cho LLM layer.

**Independent Test**: Gọi `selectBestFit(table, "gaming")` với 3 CPU → trả về winner SKU là CPU có tdp cao nhất trong stock; gọi `selectBestFit(table, "budget")` với cùng table → winner là CPU rẻ nhất.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T023 [P] [US2] Write unit test for gaming best-fit winner in `packages/comparator/tests/score.test.ts`
- [ ] T024 [P] [US2] Write unit test for productivity best-fit winner in `packages/comparator/tests/score.test.ts`
- [ ] T025 [P] [US2] Write unit test for budget best-fit winner in `packages/comparator/tests/score.test.ts`
- [ ] T026 [P] [US2] Write unit test for out-of-stock tie-breaker in `packages/comparator/tests/score.test.ts`

### Implementation for User Story 2

- [ ] T027 [P] [US2] Implement generation rank helper (`DDR5=2, DDR4=1`) in `packages/comparator/src/score.ts`
- [ ] T028 [P] [US2] Implement promo value parser in `packages/comparator/src/score.ts`
- [ ] T029 [P] [US2] Implement performance proxy selector per component type in `packages/comparator/src/score.ts`
- [ ] T030 [US2] Implement deterministic use-case scoring rules (gaming/productivity/budget) in `packages/comparator/src/score.ts`
- [ ] T031 [US2] Implement `selectBestFit(table, use_case)` in `packages/comparator/src/index.ts`
- [ ] T032 [US2] Wire `compareComponents` to include `recommendation` when `use_case` provided in `packages/comparator/src/index.ts`
- [ ] T033 [US2] Run `npm test` in `packages/comparator` and verify all score tests pass

**Checkpoint**: User Story 2 fully functional — deterministic best-fit recommendation cho 3 use cases

---

## Phase 5: OpenClaw Tool Plugin Integration

**Purpose**: Expose `compare_components` tool qua OpenClaw gateway

- [ ] T034 [P] Add `compare_components` TypeBox input/output schemas in `packages/openclaw-tools/src/schemas.ts`
- [ ] T035 [P] Implement `compare-components.ts` tool wrapper in `packages/openclaw-tools/src/tools/compare-components.ts`
- [ ] T036 Register `compare_components` tool in `packages/openclaw-tools/src/index.ts`
- [ ] T037 Add tool plugin unit test for `compare_components` in `packages/openclaw-tools/tests/compare-components-tool.test.ts`
- [ ] T038 Run `npm test` in `packages/openclaw-tools` and verify tool registration test passes

**Checkpoint**: `compare_components` tool discoverable và dispatchable qua OpenClaw gateway

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Smoke tests, docs, and quality gate validation

- [ ] T039 [P] Add smoke test script `packages/comparator/scripts/smoke.ts` demonstrating 3-CPU gaming comparison
- [ ] T040 [P] Update `specs/007-compare-components/quickstart.md` with actual test counts and commands
- [ ] T041 [P] Update `AGENTS.md` Active Technologies and Recent Changes if package structure diverged from plan
- [ ] T042 Run end-to-end WebChat test: "So sánh CPU cpu-001, cpu-002, cpu-003 cho gaming"
- [ ] T043 Run full `npm test` across `packages/comparator` and `packages/openclaw-tools`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — MVP target
- **Phase 4 (US2)**: Depends on Phase 2 and US1 (uses comparison table)
- **Phase 5 (Tool Integration)**: Depends on US1 + US2 (needs full `ComparisonResult`)
- **Phase 6 (Polish)**: Depends on Phase 5

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2. No dependencies on US2. Independently testable.
- **User Story 2 (P2)**: Can start after Phase 2 + US1 (needs `ComparisonTable`). Independently testable với mock table.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types before compare/score logic
- Core compare/score before barrel export
- Story complete before moving to next phase

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tests marked [P] can run in parallel with type definitions
- US1 test tasks marked [P] can run in parallel
- US2 test tasks marked [P] can run in parallel
- Tool schema and tool wrapper tasks marked [P] can run in parallel
- Smoke test and docs updates marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Write unit test for 2-SKU comparison table fields in packages/comparator/tests/compare.test.ts"
Task: "Write unit test for 3-5 SKU comparison table in packages/comparator/tests/compare.test.ts"
Task: "Write unit test for missing spec field placeholders in packages/comparator/tests/compare.test.ts"
Task: "Write unit test for category mismatch error (C004) in packages/comparator/tests/compare.test.ts"
Task: "Write unit test for unknown SKU error (C003) in packages/comparator/tests/compare.test.ts"

# Launch independent implementation tasks together:
Task: "Create catalog adapter to call search_components({ sku }) in packages/comparator/src/catalog-adapter.ts"
Task: "Add missing-field placeholder handling in packages/comparator/src/compare.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run `npm test` in `packages/comparator`
5. Demo comparison table capability if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Test independently → Deploy/Demo (core comparison table)
3. US2 → Test independently → Deploy/Demo (best-fit recommendation)
4. Tool plugin integration → Runtime verify → Deploy/Demo
5. Each increment adds value without breaking previous increments

### Parallel Team Strategy

With multiple developers:

1. Team completes Phase 1 + Phase 2 together
2. Once Foundational done:
   - Developer A: US1 (compare table)
   - Developer B: US2 (scoring)
3. After US1+US2:
   - Developer C: Tool plugin integration
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
