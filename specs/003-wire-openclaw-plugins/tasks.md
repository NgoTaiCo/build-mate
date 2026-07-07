---
description: "Task list for Wire Compiler and Catalog as OpenClaw Tool Plugins"
---

# Tasks: Wire Compiler and Catalog as OpenClaw Tool Plugins

**Input**: Design documents from `/specs/003-wire-openclaw-plugins/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md — all available.
**Branch**: `003-wire-openclaw-plugins`

**Tests**: INCLUDED — Constitution Quality Gate requires `npm test` green before demo (ADR-0003 §3, plan.md). Quickstart.md lists ~13 plugin unit tests covering tool registration, delegation, and error handling. Tests verify the plugin is thin and deterministic.

**Organization**: Tasks grouped by user story. US1 = compile/detect build (P1, MVP). US2 = repair build (P1). US3 = search components (P1). US4 = plugin loads after gateway restart (P2). Each story independently testable.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no file-write dependencies on incomplete tasks in same phase)
- **[Story]**: Which user story (US1, US2, US3, US4) — setup/foundational/polish have NO story label
- All paths relative to repo root `D:\Projects\build_mate_pv\`

## Path Conventions

- Single OpenClaw tool plugin package: `packages/openclaw-tools/src/`, `packages/openclaw-tools/tests/` (per plan.md Project Structure)
- Public plugin entry: `packages/openclaw-tools/src/index.ts`
- Plugin manifest: `packages/openclaw-tools/openclaw.plugin.json`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the `packages/openclaw-tools/` package and root workspace config.

- [ ] T001 Create/update root `package.json` with npm workspaces including `packages/compiler`, `packages/catalog`, `packages/openclaw-tools` in `package.json`
- [ ] T002 Create `packages/openclaw-tools/package.json` with name `@buildmate/openclaw-tools`, `openclaw.extensions`, `scripts.test` (node --test via tsx), `scripts.typecheck` (tsc --noEmit), deps on `@buildmate/compiler`/`@buildmate/catalog`, dev deps `typescript`/`tsx`/`@types/node`/`@sinclair/typebox` in `packages/openclaw-tools/package.json`
- [ ] T003 [P] Create `packages/openclaw-tools/tsconfig.json` with strict mode, target ES2023, module NodeNext, outDir `dist` in `packages/openclaw-tools/tsconfig.json`

**Checkpoint**: `npm install` from repo root succeeds and resolves workspace links.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Plugin manifest, shared schemas, and serialization helper that ALL tools depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Create `packages/openclaw-tools/openclaw.plugin.json` with id `buildmate-tools`, name `BuildMate Tools`, `contracts.tools` listing `compile_build`, `detect_errors`, `repair_build`, `search_components`, and `activation.onStartup: true` in `packages/openclaw-tools/openclaw.plugin.json`
- [ ] T005 Create `packages/openclaw-tools/src/schemas.ts` with TypeBox schemas for `Build`, `CompilerError`, and `SearchCriteria` reusing types from `@buildmate/compiler` and `@buildmate/catalog` in `packages/openclaw-tools/src/schemas.ts`
- [ ] T006 Create `packages/openclaw-tools/src/serialize.ts` with pure helper `serializeResult(result)` → `{ content: [{ type: "text", text: JSON.stringify(result) }] }` and `serializeError(toolName, err)` → error envelope in `packages/openclaw-tools/src/serialize.ts`

**Checkpoint**: Foundation compiles (`npx tsc --noEmit` passes on these files). User story implementation can now begin.

---

## Phase 3: User Story 1 — Agent Validates a Build via the Compiler Tool (Priority: P1) 🎯 MVP

**Goal**: Expose `compile_build` and `detect_errors` as OpenClaw tools that delegate to `@buildmate/compiler`. Agent can validate a build and receive deterministic error codes.

**Independent Test**: Invoke `compile_build` with CPU LGA1700 + mainboard AM5 build → response contains `E001 SOCKET_MISMATCH` and `is_valid: false`. Invoke `detect_errors` with same build → response contains `E001`. Both tools return deterministic JSON output.

### Tests for User Story 1 (TDD — write first, must FAIL before implementation)

- [ ] T007 [P] [US1] Write `compile_build` tool test (valid build returns `is_valid: true`; invalid build returns `E001`; output is JSON content message) in `packages/openclaw-tools/tests/compile-build-tool.test.ts`
- [ ] T008 [P] [US1] Write `detect_errors` tool test (invalid build returns `E001`; valid build returns `[]`; output is JSON content message) in `packages/openclaw-tools/tests/detect-errors-tool.test.ts`

### Implementation for User Story 1

- [ ] T009 [US1] Implement `compile_build` tool wrapper in `packages/openclaw-tools/src/tools/compile-build.ts` — schema `{ build: BuildSchema }`, execute calls `compileBuild(params.build)`, returns serialized `CompilerResult`
- [ ] T010 [US1] Implement `detect_errors` tool wrapper in `packages/openclaw-tools/src/tools/detect-errors.ts` — schema `{ build: BuildSchema }`, execute calls `detectErrors(params.build)`, returns serialized `CompilerError[]`

**Checkpoint**: `npm test` passes US1 tool tests. `compile_build` and `detect_errors` dispatch correctly with deterministic output. US1 independently testable — MVP deliverable.

---

## Phase 4: User Story 2 — Agent Repairs a Build via the Repair Tool (Priority: P1)

**Goal**: Expose `repair_build` as an OpenClaw tool that delegates to `@buildmate/compiler.repairBuild`. Agent can turn detected errors into concrete constraint-based fixes.

**Independent Test**: Invoke `repair_build` with build containing `E001 SOCKET_MISMATCH` → response contains at least one fix specifying target socket value; applying fix + re-detecting makes `E001` disappear.

### Tests for User Story 2 (TDD)

- [ ] T011 [P] [US2] Write `repair_build` tool test (E001 error → repair plan with socket fix; multiple errors → fix per error; output is JSON content message) in `packages/openclaw-tools/tests/repair-build-tool.test.ts`

### Implementation for User Story 2

- [ ] T012 [US2] Implement `repair_build` tool wrapper in `packages/openclaw-tools/src/tools/repair-build.ts` — schema `{ build: BuildSchema, errors: CompilerErrorArraySchema }`, execute calls `repairBuild(params.build, params.errors)`, returns serialized `RepairPlan[]`

**Checkpoint**: `npm test` passes US2 tool test. `repair_build` returns 1:1 repair plan. US1 + US2 both independently functional.

---

## Phase 5: User Story 3 — Agent Searches Components via the Catalog Tool (Priority: P1)

**Goal**: Expose `search_components` as an OpenClaw tool that delegates to `@buildmate/catalog.searchComponents`. Agent can find compatible parts by criteria.

**Independent Test**: Invoke `search_components` with `{ type: "cpu", socket: "AM5", stock_status: "in_stock" }` → response contains only AM5 CPUs in stock; empty criteria → returns components; multi-criteria applies AND logic.

### Tests for User Story 3 (TDD)

- [ ] T013 [P] [US3] Write `search_components` tool test (AM5 in-stock CPU criteria returns matching components; empty result handled; output is JSON content message) in `packages/openclaw-tools/tests/search-components-tool.test.ts`

### Implementation for User Story 3

- [ ] T014 [US3] Implement `search_components` tool wrapper in `packages/openclaw-tools/src/tools/search-components.ts` — schema `{ criteria: SearchCriteriaSchema }`, execute calls `searchComponents(params.criteria)`, returns serialized `CatalogResult`

**Checkpoint**: `npm test` passes US3 tool test. `search_components` delegates to catalog. US1+US2+US3 all independently functional.

---

## Phase 6: User Story 4 — Plugin Loads Correctly After Gateway Restart (Priority: P2)

**Goal**: Register all 4 tools in the OpenClaw plugin entry, install with `--link`, restart gateway, and verify all tools are discoverable and dispatch correctly at runtime.

**Independent Test**: After `openclaw plugins install --link ./packages/openclaw-tools` and `openclaw gateway restart`, `openclaw plugins inspect buildmate-tools --runtime --json` lists all 4 tools, and representative invocations per tool return expected result types.

### Tests for User Story 4

- [ ] T015 [P] [US4] Write plugin registration test (default export registers exactly 4 tools with correct names; no extra tools) in `packages/openclaw-tools/tests/plugin-registration.test.ts`
- [ ] T016 [P] [US4] Write error-handling test (unexpected exception in execute is caught and returned as `ToolErrorOutput` JSON, not thrown) in `packages/openclaw-tools/tests/error-handling.test.ts`

### Implementation for User Story 4

- [ ] T017 [US4] Implement plugin entry in `packages/openclaw-tools/src/index.ts` using `definePluginEntry`, registering `compile_build`, `detect_errors`, `repair_build`, `search_components` tools
- [ ] T018 [US4] Install plugin into OpenClaw via `openclaw plugins install --link ./packages/openclaw-tools`
- [ ] T019 [US4] Restart OpenClaw gateway via `openclaw gateway restart`
- [ ] T020 [US4] Verify runtime via `openclaw plugins inspect buildmate-tools --runtime --json` and end-to-end invocation of all 4 tools through WebChat

**Checkpoint**: All 4 tools discoverable after restart; runtime verification passes. US1-US4 all functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finalize package, run quality gate, document, and enforce boundaries.

- [ ] T021 [P] Run `npm test` in `packages/openclaw-tools` — all ~13 tests must pass (Constitution Quality Gate)
- [ ] T022 [P] Run `npm run typecheck` in `packages/openclaw-tools` — zero TypeScript errors
- [ ] T023 [P] Execute end-to-end WebChat validation per `quickstart.md` for all 4 tools
- [ ] T024 Write `packages/openclaw-tools/README.md` with install (`openclaw plugins install --link`), verify (`openclaw plugins inspect buildmate-tools --runtime --json`), and tool usage notes in `packages/openclaw-tools/README.md`
- [ ] T025 Verify plugin boundary compliance (grep `packages/openclaw-tools/src` for no error-code branching, no state, no LLM calls, no session storage; confirm only pure-function delegation + serialization) in `packages/openclaw-tools/src`

**Checkpoint**: Constitution Quality Gate `npm test` GREEN. Plugin ready for demo S1+S3 flow.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. T001 before T002/T003 (root config needed).
- **Foundational (Phase 2)**: Depends on Setup. T004, T005, T006 can run in parallel after workspace install. BLOCKS all user stories.
- **US1 (Phase 3)**: Depends on Foundational. Tests T007-T008 parallel. Impl T009-T010 parallel (after T005 schemas + T006 serialize).
- **US2 (Phase 4)**: Depends on Foundational + US1 not strictly required but natural after US1. T011 test parallel. T012 depends on T005 + T006.
- **US3 (Phase 5)**: Depends on Foundational. T013 test parallel. T014 depends on T005 + T006.
- **US4 (Phase 6)**: Depends on US1 + US2 + US3 (all tool implementations must exist to register). T015-T016 tests parallel. T017 plugin entry depends on T009-T010-T012-T014. T018-T020 runtime steps depend on T017.
- **Polish (Phase 7)**: Depends on all prior phases. T021-T025 after implementation complete.

### User Story Dependencies

- **US1 (P1) — MVP**: Can start after Foundational (Phase 2). No dependency on other stories. DELIVERS standalone compile/detect tools.
- **US2 (P1)**: Can start after Foundational. Natural sequence after US1 but testable with synthetic errors. DELIVERS repair tool.
- **US3 (P1)**: Can start after Foundational. Independent of US1/US2 data-wise (uses catalog). DELIVERS search tool.
- **US4 (P2)**: Requires all 4 tool implementations (US1-US3) so plugin entry can register them. DELIVERS runtime load + verification.

### Within Each User Story

- Tests (TDD) MUST be written and FAIL before implementation
- Schemas + serialize helper (Foundational) before tool wrappers
- Tool wrappers before plugin entry registration
- Plugin entry before install/restart/runtime verify

### Parallel Opportunities

- **Phase 1**: T002, T003 [P] (after T001)
- **Phase 2**: T004, T005, T006 [P] — manifest, schemas, serializer independent
- **Phase 3 US1**: T007, T008 [P] test files parallel; T009, T010 [P] impl files parallel
- **Phase 4 US2**: T011 [P] test independent; T012 parallel with US1 impl if foundational done
- **Phase 5 US3**: T013 [P] test independent; T014 parallel with US1/US2 impl if foundational done
- **Phase 6 US4**: T015, T016 [P] test files parallel; T017 depends on all tool impls; T018-T020 sequential runtime steps
- **Phase 7**: T021, T022, T023, T024 [P]; T025 boundary review after all code
- **Cross-story**: Once Foundational complete, US1 (compile/detect), US2 (repair), and US3 (search) tool wrappers can be implemented in parallel by different developers — each tool is a separate file.

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (TDD — will fail first):
Task: "T007 compile-build-tool.test.ts"
Task: "T008 detect-errors-tool.test.ts"

# After Foundational (T004-T006) complete, launch US1 tool implementations together:
Task: "T009 compile-build.ts"
Task: "T010 detect-errors.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only) — RECOMMENDED for hackathon time-box

1. Complete Phase 1: Setup (T001-T003) — 15 min
2. Complete Phase 2: Foundational (T004-T006) — 30 min
3. Complete Phase 3: US1 compile/detect tools (T007-T010) — 1h
4. **STOP and VALIDATE**: `npm test` green for US1 tool tests. Demo partial S1 (agent validates build).

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 compile/detect → Test independently → MVP demo (agent validates build)
3. US2 repair → Test independently → S3 detect→repair demo
4. US3 search → Test independently → S1 search→compile demo
5. US4 plugin load → Runtime verify → Full S1+S3 demo
6. Polish → `npm test` GREEN + README + boundary compliance

### Parallel Team Strategy

With 2-3 developers (hackathon):

1. Team completes Setup + Foundational together (45 min)
2. Once Foundational done:
   - Developer A: US1 (compile/detect tools + tests)
   - Developer B: US2 (repair tool + tests) + US3 (search tool + tests)
3. Sync after US1-US3: US4 plugin entry + install/restart/verify (1 dev, 30 min)
4. Polish together: README + quality gate + boundary review (30 min)

---

## Notes

- [P] tasks = different files, no file-write dependencies on incomplete tasks in same phase
- [Story] label maps task to specific user story for traceability (US1/US2/US3/US4)
- Each user story independently completable and testable (spec mandate)
- Tests written TDD (fail first) — required for Constitution Quality Gate
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Constitution Quality Gate** (T021): `npm test` MUST be green before demo (ADR-0003 §3)
- **Boundary enforcement** (T025): plugin must only wrap+dispatch; no compatibility logic, no state, no LLM calls, no SessionStore (Constitution Principles I & II)
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
