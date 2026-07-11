---
description: "Task list for Build Compiler Deterministic Core feature implementation"
---

# Tasks: Build Compiler Deterministic Core

**Input**: Design documents from `/specs/001-build-compiler-core/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md — all available.
**Branch**: `001-build-compiler-core`

**Tests**: INCLUDED — spec FR-012 explicitly mandates ≥15 unit tests (5 rules × ≥3 cases) as Constitution Quality Gate (`npm test` must be green before demo, ADR-0003 §3). Tests written TDD-style (fail first, then implement).

**Organization**: Tasks grouped by user story. US1 = detect compatibility errors (P1, MVP). US2 = repair plan generator (P2). US3 = PSU warning + completeness (P3). Each story independently testable.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no file-write dependencies on incomplete tasks in same phase)
- **[Story]**: Which user story (US1, US2, US3) — setup/foundational/polish have NO story label
- All paths relative to repo root `D:\Projects\build_mate_pv\`

## Path Conventions

- Single library package: `packages/compiler/src/`, `packages/compiler/tests/` (per plan.md Project Structure)
- Public API barrel: `packages/compiler/src/index.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — `packages/compiler/` self-contained package (ADR-0001 §4.4)

- [X] T001 Create packages/compiler/package.json with name `@buildmate/compiler`, scripts `test` (node --test via tsx), `typecheck` (tsc --noEmit), dev deps typescript/tsx/@types/node in packages/compiler/package.json
- [X] T002 [P] Create packages/compiler/tsconfig.json with strict mode, target ES2023, module NodeNext, outDir dist in packages/compiler/tsconfig.json

**Checkpoint**: Package skeleton ready. `cd packages/compiler && npm install` should succeed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type + code definitions that ALL user stories depend on. MUST complete before any rule/repair/test implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Define ErrorCode constants + names in packages/compiler/src/codes.ts — stable codes E001 SOCKET_MISMATCH, E002 RAM_GEN_MISMATCH, E003 MISSING_COMPONENT, E004 COOLER_CLEARANCE_MISMATCH, E005 FORM_FACTOR_MISMATCH, E006 MISSING_ATTRIBUTE, W001 PSU_TIGHT (per data-model.md §6, research.md §7)
- [X] T004 [P] Define TypeScript types in packages/compiler/src/types.ts — Build, Component discriminated union of 7 types (CPU/Mainboard/RAM/PSU/Cooler/Case/Storage + GPU optional), CompilerError, RepairPlan, Fix, Change, CompilerResult, ErrorCode (per data-model.md §1-§5). PSU type MUST NOT have `tdp` or `efficiency_rating` fields (research.md §11, §12). Storage type has only `type`+`id`+optional `tdp` (research.md §9).

**Checkpoint**: Foundation ready — codes + types compile (`npx tsc --noEmit` passes on these 2 files). User story implementation can now begin.

---

## Phase 3: User Story 1 — Detect Compatibility Errors (Priority: P1) 🎯 MVP

**Goal**: `detectErrors(build)` returns ALL compatibility errors (E001-E006) for a build — socket, RAM gen, missing component (7 types), cooler clearance, form-factor, missing attribute. No short-circuit; deterministic order.

**Independent Test**: Build with CPU LGA1700 + mainboard AM5 → returns E001. Build with E001+E002 → returns both. Valid build (all 7 required types, all compat OK) → returns `[]`. Test runs standalone via `npm test` — no OpenClaw/chat runtime (FR-011, SC-003).

### Tests for User Story 1 (TDD — write first, must FAIL before implementation)

- [X] T005 [P] [US1] Write socket rule tests (≥3 cases: pass / fail E001 / boundary) in packages/compiler/tests/socket.test.ts
- [X] T006 [P] [US1] Write ram-gen rule tests (≥3 cases: pass / fail E002 / multi-stick) in packages/compiler/tests/ram-gen.test.ts
- [X] T007 [P] [US1] Write missing-component rule tests (≥4 cases: each-of-7-types-missing / all-7-present / empty-build / non-required-type-present) in packages/compiler/tests/missing.test.ts
- [X] T008 [P] [US1] Write cooler clearance rule tests (≥3 cases: pass / fail E004 / boundary height===max) in packages/compiler/tests/cooler.test.ts
- [X] T009 [P] [US1] Write form-factor rule tests (≥3 cases: pass / fail E005 mainboard / fail E005 PSU) in packages/compiler/tests/form-factor.test.ts
- [X] T010 [US1] Write validate orchestration tests (multi-error simultaneous / empty-build all-E003 / missing-attribute E006 edge / deterministic order) in packages/compiler/tests/validate.test.ts

### Implementation for User Story 1

- [X] T011 [P] [US1] Implement check-attr helper (returns E006 MISSING_ATTRIBUTE error when a required attribute is absent on a component; pure function, no crash) in packages/compiler/src/rules/check-attr.ts
- [X] T012 [P] [US1] Implement socket rule E001 (compare cpu.socket vs mainboard.socket; use check-attr for missing fields) in packages/compiler/src/rules/socket.ts
- [X] T013 [P] [US1] Implement ram-gen rule E002 (check every RAM stick generation ∈ cpu.ram_gen_supported AND ∈ mainboard.ram_gen_supported; use check-attr) in packages/compiler/src/rules/ram-gen.ts
- [X] T014 [P] [US1] Implement missing-component rule E003 (check ≥1 of each 7 required types: cpu, mainboard, ram, psu, cooler, case, storage; return E003 per missing type with `component_refs: ["type:<missing>"]`) in packages/compiler/src/rules/missing.ts
- [X] T015 [P] [US1] Implement cooler clearance rule E004 (cooler.height > case.max_cooler_height → E004; boundary height===max → pass; use check-attr) in packages/compiler/src/rules/cooler.ts
- [X] T016 [P] [US1] Implement form-factor rule E005 (mainboard.form_factor ∈ case.supported_mb_form_factors AND psu.form_factor ∈ case.supported_psu_form_factors; use check-attr) in packages/compiler/src/rules/form-factor.ts
- [X] T017 [US1] Implement validate.ts orchestration (rule order: E003 missing → E006 missing-attr → 5 compat rules; NO short-circuit; deterministic output order; collect all errors) in packages/compiler/src/validate.ts
- [X] T018 [US1] Implement detectErrors function + barrel export in packages/compiler/src/index.ts (delegates to validate.ts; export detectErrors)

**Checkpoint**: `npm test` passes for socket/ram-gen/missing/cooler/form-factor/validate suites (≥15 tests green). `detectErrors(build)` returns E001-E006 correctly. US1 independently testable — MVP deliverable.

---

## Phase 4: User Story 2 — Repair Plan Generator (Priority: P2)

**Goal**: `repairBuild(build, errors)` returns constraint-based `RepairPlan[]` (1:1 with errors) — each error gets ≥1 alternative fix with `component_ref` + `attribute` + `target_value`. Round-trip: apply fix → re-validate → error gone.

**Independent Test**: Given synthetic `errors=[E001...]` (no need for US1 detect), `repairBuild` returns plan with ≥1 fix per error. Apply fix → `detectErrors` re-validate → original error disappears (SC-002). Tests construct errors array directly — US2 testable without US3.

### Tests for User Story 2 (TDD)

- [X] T019 [P] [US2] Write repair plan tests (round-trip for E001-E006: construct errors → repairBuild → apply 1 fix/error → re-detect → original error gone; 1:1 mapping; ≥1 fix per error; constraint-based target_value not SKU) in packages/compiler/tests/repair.test.ts

### Implementation for User Story 2

- [X] T020 [US2] Implement repair.ts (map each error code E001-E006 → ≥1 alternative Fix with constraint-based Changes per data-model.md §4 + contracts/compiler-api.md §3; E001 → 2 fixes [change cpu.socket OR change mainboard.socket]; E003 → 1 fix [add missing type]; E006 → 1 fix [add missing attribute]; round-trip invariant) in packages/compiler/src/repair.ts
- [X] T021 [US2] Implement repairBuild function + barrel export in packages/compiler/src/index.ts (signature: `repairBuild(build, errors): RepairPlan[]`; export repairBuild)

**Checkpoint**: `npm test` passes repair suite. `repairBuild(build, errors)` returns 1:1 plan. US1 + US2 both independently functional.

---

## Phase 5: User Story 3 — PSU Warning & Build Completeness (Priority: P3)

**Goal**: Add `W001 PSU_TIGHT` warning rule — PSU wattage < (TDP total excluding PSU) × 1.2 → W001 (warning, not blocking). Distinguishes error (E003 blocking) vs warning (W001 advisory). TDP sum excludes PSU (research.md §11).

**Independent Test**: Build PSU 550W, TDP total excl. PSU 500W → W001 (500×1.2=600 > 550). Build PSU 750W, TDP 500W → no W001. Build with malformed PSU `tdp:50` field → PSU tdp EXCLUDED from sum, no false W001 (research.md §11, clarification Q5). Boundary: PSU wattage === TDP×1.2 → pass (no W001).

### Tests for User Story 3 (TDD)

- [X] T022 [P] [US3] Write psu rule tests (≥3 cases: pass / W001 warn / boundary wattage===TDP×1.2 / PSU-tdp-excluded malformed case) in packages/compiler/tests/psu.test.ts

### Implementation for User Story 3

- [X] T023 [US3] Implement psu rule W001 (compute tdp_total = sum of all components where `type !== "psu" && typeof tdp === "number" && tdp > 0`; if `psu.wattage < tdp_total * 1.2` → W001 warning with severity "warning"; boundary `===` → pass; use check-attr for missing psu.wattage) in packages/compiler/src/rules/psu.ts
- [X] T024 [US3] Integrate psu rule into validate.ts orchestration (add W001 to output after 5 compat rules; W001 is warning not error — does not block; preserve deterministic order) in packages/compiler/src/validate.ts
- [X] T025 [US3] Extend repair.ts to handle W001 fix (1 fix: increase `psu.wattage` to `target_value: ceil(tdp_total * 1.2)`; strategy replace_component; note: efficiency rating NOT consulted per research.md §12) in packages/compiler/src/repair.ts

**Checkpoint**: `npm test` passes psu suite. All 7 error/warning codes (E001-E006, W001) handled by detect + repair. US1+US2+US3 all independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize `compileBuild` entry point, smoke test, and Constitution Quality Gate validation.

- [X] T026 Implement compileBuild function (compose detectErrors + repairBuild + is_valid; `compileBuild(build) = { errors: detectErrors(build), repair_plan: repairBuild(build, detectErrors(build)), is_valid: !detectErrors(build).some(e => e.severity === "error") }`) + barrel export in packages/compiler/src/index.ts
- [X] T027 [P] Complete smoke test script (3 scenarios: full 7-type build with E001 / missing-storage triggers E003 / PSU-tdp-exclusion verify) in packages/compiler/scripts/smoke.ts per quickstart.md
- [X] T028 [P] Write packages/compiler/README.md (public API: compileBuild/detectErrors/repairBuild signatures, error code catalog table E001-E006/W001, usage example, `npm test` gate)
- [X] T029 Run quickstart.md validation — Constitution Quality Gate: `cd packages/compiler && npm install && npm test && npm run typecheck && npx tsx scripts/smoke.ts` — ALL must pass (≥15 tests green, 0 typecheck errors, smoke output matches expected)
- [X] T030 Verify FR-013 out-of-scope compliance (no RGB/aesthetic/price/monitor-performance/PSU-rating logic anywhere in src/; no Monitor entity, no efficiency_rating field on PSU, no storage capacity check — grep + code review)

**Checkpoint**: Constitution Quality Gate `npm test` GREEN. Compiler core ready for wire-up (feature sau, HOUR 8-10 ADR-0003).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. T001 before T002 (package.json needed for install).
- **Foundational (Phase 2)**: Depends on Setup. T003 + T004 parallel. BLOCKS all user stories.
- **US1 (Phase 3)**: Depends on Foundational. Tests T005-T010 parallel (different files). Impl T011-T016 parallel (different rule files, share check-attr + types). T017 validate depends on all rules (T011-T016). T018 detectErrors depends on T017.
- **US2 (Phase 4)**: Depends on Foundational + US1 validate (T017) for round-trip test. T019 test parallel. T020 repair depends on codes/types (foundational). T021 repairBuild depends on T020.
- **US3 (Phase 5)**: Depends on Foundational + US1 validate (T017) + US2 repair (T020) for integration. T022 test parallel. T023 psu rule depends on codes/types/check-attr. T024 integrate-into-validate depends on T023 + T017. T025 extend-repair depends on T020 + T023.
- **Polish (Phase 6)**: T026 compileBuild depends on T018 + T021. T027 smoke depends on T026. T028 README [P]. T029 gate depends on ALL prior. T030 compliance check [P] after all impl.

### User Story Dependencies

- **US1 (P1) — MVP**: Can start after Foundational (Phase 2). No dependency on other stories. DELIVERS standalone detect functionality.
- **US2 (P2)**: Can start after Foundational. US2 repair test (round-trip) benefits from US1 detect but can construct synthetic errors for independent test. Implement in parallel with US1 if team capacity allows; otherwise after US1.
- **US3 (P3)**: Depends on US1 validate.ts (T017) for integration + US2 repair.ts (T020) for W001 fix extension. Implement after US1+US2.

### Within Each User Story

- Tests (TDD) MUST be written and FAIL before implementation
- Helper (check-attr) before rules that use it
- Rules before orchestration (validate.ts)
- Orchestration before public API export (index.ts)
- Repair mapping before repairBuild export

### Parallel Opportunities

- **Phase 1**: T002 [P] (after T001)
- **Phase 2**: T003, T004 [P] — codes + types independent files
- **Phase 3 US1**: T005-T010 [P] all 6 test files in parallel; T011-T016 [P] all 6 impl files in parallel (after T004 foundational)
- **Phase 4 US2**: T019 [P] test file independent
- **Phase 5 US3**: T022 [P] test file independent
- **Phase 6**: T027, T028 [P] smoke + README independent; T030 [P] compliance check
- **Cross-story**: Once Foundational complete, US1 (Phase 3) and US2 (Phase 4, repair mapping) can proceed in parallel by different developers — US2 repair test uses synthetic errors, not US1 detect output.

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (TDD — will fail first):
Task: "T005 socket.test.ts"
Task: "T006 ram-gen.test.ts"
Task: "T007 missing.test.ts"
Task: "T008 cooler.test.ts"
Task: "T009 form-factor.test.ts"
Task: "T010 validate.test.ts"

# After Foundational (T003+T004) complete, launch all US1 rule implementations together:
Task: "T011 check-attr.ts"
Task: "T012 socket.ts"
Task: "T013 ram-gen.ts"
Task: "T014 missing.ts"
Task: "T015 cooler.ts"
Task: "T016 form-factor.ts"

# Then sequential:
Task: "T017 validate.ts (orchestration)"
Task: "T018 index.ts (detectErrors export)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only) — RECOMMENDED for hackathon time-box

1. Complete Phase 1: Setup (T001-T002) — 30 min
2. Complete Phase 2: Foundational (T003-T004) — 30 min
3. Complete Phase 3: US1 detect (T005-T018) — 3h (HOUR 3-6 slot ADR-0003 §3)
4. **STOP and VALIDATE**: `npm test` green for 6 US1 suites (≥15 tests). `detectErrors` returns E001-E006.
5. Demo S3 partial (detect errors → display) — already valuable.

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 detect → Test independently → MVP demo (detect + display errors)
3. US2 repair → Test independently → S3 full demo (detect → repair → apply)
4. US3 PSU warning → Test independently → S3 + W001 advisory demo
5. Polish → compileBuild entry point + smoke + Constitution Gate `npm test` GREEN

### Parallel Team Strategy

With 2 developers (hackathon):

1. Team completes Setup + Foundational together (1h)
2. Once Foundational done:
   - Developer A: US1 (Phase 3) — all detect rules + validate + tests
   - Developer B: US2 (Phase 4) — repair mapping + tests (synthetic errors, no US1 dep)
3. Sync after US1+US2: US3 (Phase 5) — PSU warning (1 dev, 30 min)
4. Polish together: compileBuild + smoke + gate validation (30 min)

---

## Notes

- [P] tasks = different files, no file-write dependencies on incomplete tasks in same phase
- [Story] label maps task to specific user story for traceability (US1/US2/US3)
- Each user story independently completable and testable (spec mandate)
- Tests written TDD (fail first) — FR-012 mandates ≥15 tests as Constitution Quality Gate
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Constitution Quality Gate** (T029): `npm test` MUST be green before demo (ADR-0003 §3)
- **Out-of-scope enforcement** (T030): no Monitor entity, no PSU `efficiency_rating`, no storage `capacity` check, no RGB/aesthetic/price/monitor-performance logic (FR-013, research.md §9-§12)
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
