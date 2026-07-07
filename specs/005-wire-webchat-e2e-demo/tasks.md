---
description: "Task list for 005-wire-webchat-e2e-demo"
---

# Tasks: Wire WebChat end-to-end demo

**Input**: Design documents from `/specs/005-wire-webchat-e2e-demo/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/tool-contracts.md`, `quickstart.md`

**Tests**: Tests are included for the Compiler because the Constitution Quality Gate requires `npm test` green and every compatibility rule must have a unit test. Other layers get contract/integration tests only where they add demo reliability.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create monorepo root `package.json` with workspaces and `npm test` script at `package.json`
- [ ] T002 [P] Create root `tsconfig.json` extending a shared base config at `tsconfig.json`
- [ ] T003 [P] Create shared `tsconfig.base.json` for all packages at `tsconfig.base.json`
- [ ] T004 [P] Add dev dependencies `typescript`, `tsx`, `@types/node` to root `package.json`
- [ ] T005 [P] Update `.gitignore` to exclude `node_modules/`, `dist/`, `*.log`, and OpenClaw state at `.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Compiler + Catalog infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Create `@buildmate/compiler` package structure at `packages/@buildmate/compiler/package.json`, `tsconfig.json`, `src/index.ts`, `src/types.ts`
- [ ] T007 [P] Create `@buildmate/catalog` package structure at `packages/@buildmate/catalog/package.json`, `tsconfig.json`, `src/index.ts`
- [ ] T008 Define shared types (`Build`, `BuildComponent`, `CompatibilityError`, `Component`, `UserNeed`) in `packages/@buildmate/compiler/src/types.ts`
- [ ] T009 [P] Create mock catalog dataset with ~50 components at `packages/@buildmate/catalog/src/data/components.json`
- [ ] T010 Implement catalog loader and in-memory search at `packages/@buildmate/catalog/src/search.ts`
- [ ] T011 Implement `search_components` adapter function at `packages/@buildmate/catalog/src/index.ts`
- [ ] T012 Implement Compiler rule E001 SOCKET_MISMATCH at `packages/@buildmate/compiler/src/rules/socket.ts`
- [ ] T013 [P] Implement Compiler rule E002 POWER_INSUFFICIENT at `packages/@buildmate/compiler/src/rules/psu-wattage.ts`
- [ ] T014 Implement `detect_errors` aggregator at `packages/@buildmate/compiler/src/index.ts`
- [ ] T015 Implement `compile_build` at `packages/@buildmate/compiler/src/index.ts`
- [ ] T016 [P] Add unit tests for E001 rule at `packages/@buildmate/compiler/tests/rules/socket.test.ts`
- [ ] T017 [P] Add unit tests for E002 rule at `packages/@buildmate/compiler/tests/rules/psu-wattage.test.ts`
- [ ] T018 Add unit tests for `compile_build` and `detect_errors` at `packages/@buildmate/compiler/tests/index.test.ts`
- [ ] T019 Wire `npm test` scripts at root and package level to run `tsx --test` at `package.json`
- [ ] T020 Run `npm test` and ensure all compiler tests pass

**Checkpoint**: Compiler and Catalog are ready; `npm test` is green

---

## Phase 3: User Story 1 - Khách mô tả nhu cầu và nhận cấu hình đã biên dịch (Priority: P1) - MVP

**Goal**: Khách hàng mô tả nhu cầu trong WebChat và nhận cấu hình PC đã được tìm kiếm, biên dịch, và stream về.

**Independent Test**: Mở WebChat, gửi "Tôi muốn build PC gaming khoảng 25 triệu", xác nhận nhận được cấu hình hợp lệ với danh sách linh kiện và tổng giá.

### Tests for User Story 1

- [ ] T021 [P] [US1] Add contract test for `search_components` at `tests/contract/search-components.test.ts`
- [ ] T022 [P] [US1] Add contract test for `compile_build` at `tests/contract/compile-build.test.ts`

### Implementation for User Story 1

- [ ] T023 Create `@buildmate/openclaw-tools` package structure at `packages/@buildmate/openclaw-tools/package.json`, `openclaw.plugin.json`, `src/index.ts`
- [ ] T024 [P] [US1] Define TypeBox schemas for `search_components` and `compile_build` at `packages/@buildmate/openclaw-tools/src/schemas.ts`
- [ ] T025 [US1] Register `search_components` tool in the OpenClaw plugin at `packages/@buildmate/openclaw-tools/src/index.ts`
- [ ] T026 [US1] Register `compile_build` tool in the OpenClaw plugin at `packages/@buildmate/openclaw-tools/src/index.ts`
- [ ] T027 [US1] Add agent skill / prompt guidance so the agent knows to call search then compile at `packages/@buildmate/openclaw-tools/SKILL.md`
- [ ] T028 [US1] Install the plugin locally with `openclaw plugins install --link ./packages/@buildmate/openclaw-tools`
- [ ] T029 [US1] Verify plugin runtime with `openclaw plugins inspect buildmate-tools --runtime --json`
- [ ] T030 [US1] Rehearse S1 flow in WebChat and capture the resulting build

**Checkpoint**: User Story 1 is fully functional and testable independently

---

## Phase 4: User Story 2 - Khách cố tình gửi cấu hình lỗi và BuildMate sửa chữa (Priority: P1)

**Goal**: Khách hàng gửi cấu hình lỗi; BuildMate phát hiện E001/E002, lập kế hoạch sửa, tự động áp dụng linh kiện đề xuất, và trình bày cấu hình đã sửa.

**Independent Test**: Trong WebChat, gửi cấu hình gồm CPU i5-12400F + mainboard B650 AM5 + PSU 400W; xác nhận nhận được E001/E002, đề xuất sửa, và cấu hình fixed.

### Tests for User Story 2

- [ ] T031 [P] [US2] Add unit tests for `repair_build` at `packages/@buildmate/compiler/tests/repair.test.ts`
- [ ] T032 [P] [US2] Add contract test for `detect_errors` and `repair_build` at `tests/contract/repair.test.ts`
- [ ] T033 [P] [US2] Add contract test for `add_to_build` at `tests/contract/add-to-build.test.ts`

### Implementation for User Story 2

- [ ] T034 [P] [US2] Implement `repair_build` planner at `packages/@buildmate/compiler/src/index.ts`
- [ ] T035 [US2] Register `detect_errors` tool in the OpenClaw plugin at `packages/@buildmate/openclaw-tools/src/index.ts`
- [ ] T036 [US2] Register `repair_build` tool in the OpenClaw plugin at `packages/@buildmate/openclaw-tools/src/index.ts`
- [ ] T037 [US2] Create `@buildmate/dom-tools` package structure at `packages/@buildmate/dom-tools/package.json`, `src/index.ts`
- [ ] T038 [P] [US2] Implement self-hosted mock build-PC page fallback at `packages/@buildmate/dom-tools/src/mock-page.ts`
- [ ] T039 [P] [US2] Implement Playwright-based `add_to_build` at `packages/@buildmate/dom-tools/src/browser-automation.ts`
- [ ] T040 [US2] Implement `read_current_build` DOM tool at `packages/@buildmate/dom-tools/src/browser-automation.ts`
- [ ] T041 [US2] Register `add_to_build` and `read_current_build` tools in the plugin at `packages/@buildmate/openclaw-tools/src/index.ts`
- [ ] T042 [US2] Update agent skill / prompt guidance for repair flow at `packages/@buildmate/openclaw-tools/SKILL.md`
- [ ] T043 [US2] Rehearse S3 flow in WebChat and verify E001/E002 are returned and fixed

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - Đội demo diễn tập toàn bộ hành trình (Priority: P2)

**Goal**: Đội demo chạy ít nhất một lần toàn bộ S1 → S3 và ghi nhận kết quả.

**Independent Test**: Chạy `node scripts/rehearsal.mjs` và thấy output `passed: true` cho hành trình S1 → S3.

- [ ] T044 [US3] Create rehearsal runner script at `scripts/rehearsal.mjs`
- [ ] T045 [US3] Define S1 and S3 test scenarios in `scripts/rehearsal.mjs`
- [ ] T046 [US3] Run full S1 → S3 rehearsal and record `DemoRun` result
- [ ] T047 [US3] Fix any blocker and re-run until at least one rehearsal passes

**Checkpoint**: At least one full demo rehearsal has passed

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T048 [P] Update `docs/setup.md` with any deviations discovered during implementation at `docs/setup.md`
- [ ] T049 [P] Update `AGENTS.md` Active Technologies and Recent Changes with final stack at `AGENTS.md`
- [ ] T050 Run `npm test` across all packages and ensure green gate
- [ ] T051 [P] Run typecheck / lint across all packages
- [ ] T052 Validate `quickstart.md` end-to-end on a clean environment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Setup completion - BLOCKS all user stories
- **Phase 3+ (User Stories)**: All depend on Foundational phase completion
  - US1 is the MVP and should be completed first
  - US2 can start after foundational phase and overlaps with US1 plugin work
  - US3 depends on US1 and US2 being functional
- **Phase 6 (Polish)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2. No dependencies on other stories.
- **User Story 2 (P1)**: Can start after Phase 2 and after the OpenClaw plugin package skeleton exists (T023). Should be independently testable.
- **User Story 3 (P2)**: Depends on US1 and US2 being functional.

### Within Each User Story

- Compiler unit tests should be written alongside each rule
- Models/types before tool registration
- Tool registration before plugin integration
- Plugin integration before WebChat rehearsal

### Parallel Opportunities

- All Phase 1 tasks marked [P] can run in parallel
- All Phase 2 tasks marked [P] can run in parallel (within the phase)
- US1 and US2 can be developed in parallel once the plugin package skeleton is ready
- Tests within a story marked [P] can run in parallel
- DOM mock page and Playwright automation can be developed in parallel

---

## Parallel Example: User Story 1

```bash
# Run US1 contract tests in parallel:
Task: "T021 Add contract test for search_components"
Task: "T022 Add contract test for compile_build"

# Implement US1 models/schemas in parallel:
Task: "T023 Create @buildmate/openclaw-tools package structure"
Task: "T024 Define TypeBox schemas for search_components and compile_build"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (Compiler + Catalog + green tests)
3. Complete Phase 3: User Story 1 (search + compile + WebChat plugin)
4. STOP and VALIDATE: Test User Story 1 independently in WebChat
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP)
3. Add User Story 2 → Test independently → Repair differentiator ready
4. Add User Story 3 → Run rehearsal → Demo-ready
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (plugin + WebChat S1)
   - Developer B: User Story 2 (repair + DOM tools)
   - Developer C: User Story 3 (rehearsal script + docs)
3. Stories integrate via the shared OpenClaw plugin package

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify compiler unit tests fail before implementing each rule
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
