---
description: "Task list for DOM Build Tools implementation"
---

# Tasks: DOM Build Tools

**Input**: Design documents from `/specs/004-dom-build-tools/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dom-tool-contracts.md, quickstart.md

**Tests**: Test tasks are included because the Constitution Quality Gate requires `npm test` xanh trước demo. Tests validate pure helpers deterministically and DOM tools via mock-page integration.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency readiness

- [ ] T001 Add `packages/openclaw-tools` to root `package.json` workspaces array
- [ ] T002 Install Playwright Chromium browsers via `npx playwright install chromium`
- [ ] T003 [P] Verify `@buildmate/compiler` and `@buildmate/catalog` workspace packages exist and build successfully

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core DOM automation infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create directory structure under `packages/openclaw-tools/` (`src/dom/`, `src/tools/`, `mock-build-pc/`, `mock-build-pc/public/`, `tests/`)
- [ ] T005 [P] Create/update `packages/openclaw-tools/tsconfig.json` (strict, ES2023, NodeNext)
- [ ] T006 [P] Update `packages/openclaw-tools/package.json` with Playwright dependency and `mock:build-pc` test script
- [ ] T007 [P] Update `packages/openclaw-tools/openclaw.plugin.json` manifest to register all 6 tools
- [ ] T008 [P] Create `packages/openclaw-tools/src/schemas.ts` with TypeBox schemas for `add_to_build` and `read_current_build`
- [ ] T009 [P] Create `packages/openclaw-tools/src/dom/page-object.ts` with semantic selectors for `phongvu.vn/buildpc` and mock page
- [ ] T010 [P] Create `packages/openclaw-tools/src/dom/parser.ts` with pure DOM parsing helpers for `BuildState`, price, and category labels
- [ ] T011 Create `packages/openclaw-tools/src/dom/browser-driver.ts` with Playwright context lifecycle (launch, navigate, close)
- [ ] T012 Create `packages/openclaw-tools/src/dom/fallback-detector.ts` to detect login wall, captcha, timeout, and unreachable page

**Checkpoint**: Foundation ready — page objects, parser, browser driver, fallback detector, and schemas are in place. User story implementation can now begin.

---

## Phase 3: User Story 1 - Add a Component to the Active Build (Priority: P1) 🎯 MVP

**Goal**: Agent can add a component to the active PC build by SKU through browser automation on the live or mock build-PC page.

**Independent Test**: Invoke `add_to_build` with a known SKU on the mock page and verify the returned `build_state` (via `read_current_build`) contains the added SKU.

### Tests for User Story 1

- [ ] T013 [P] [US1] Add unit tests for SKU matcher and category resolver in `packages/openclaw-tools/tests/dom-helpers.test.ts`
- [ ] T014 [P] [US1] Add integration test for `add_to_build` on mock page in `packages/openclaw-tools/tests/add-to-build-mock.test.ts`

### Implementation for User Story 1

- [ ] T015 [US1] Implement add-by-SKU automation flow in `packages/openclaw-tools/src/dom/build-actions.ts`
- [ ] T016 [US1] Create `packages/openclaw-tools/src/tools/add-to-build.ts` tool wrapper
- [ ] T017 [US1] Wire `add_to_build` tool into `packages/openclaw-tools/src/index.ts` plugin registration

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently on the mock page.

---

## Phase 4: User Story 2 - Read the Current Build State (Priority: P1)

**Goal**: Agent can read the current state of the active PC build from the live or mock build-PC page.

**Independent Test**: Invoke `read_current_build` on a mock page that already contains selected components and verify the returned `build_state` lists all components, categories, and totals accurately.

### Tests for User Story 2

- [ ] T018 [P] [US2] Add unit tests for build-state parser with fixture HTML in `packages/openclaw-tools/tests/dom-helpers.test.ts`
- [ ] T019 [P] [US2] Add integration test for `read_current_build` on mock page in `packages/openclaw-tools/tests/read-current-build-mock.test.ts`

### Implementation for User Story 2

- [ ] T020 [US2] Implement read-build-state automation flow in `packages/openclaw-tools/src/dom/build-actions.ts`
- [ ] T021 [US2] Create `packages/openclaw-tools/src/tools/read-current-build.ts` tool wrapper
- [ ] T022 [US2] Wire `read_current_build` tool into `packages/openclaw-tools/src/index.ts` plugin registration

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently on the mock page.

---

## Phase 5: User Story 3 - Continue Operating When the Live Site Cannot Be Driven (Priority: P2)

**Goal**: When `phongvu.vn/buildpc` is undrivable, the system detects failure, suggests fallback, and the self-hosted mock build-PC page supports full `add_to_build` and `read_current_build` behavior.

**Independent Test**: Invoke `add_to_build` with `target: "auto"` while the live site is unreachable (or simulate failure) and verify the response contains `fallback_suggested: true`; then invoke with `target: "mock"` and verify success.

### Tests for User Story 3

- [ ] T023 [P] [US3] Add unit tests for `FallbackDetector` with login/captcha/timeout fixtures in `packages/openclaw-tools/tests/fallback-detector.test.ts`
- [ ] T024 [P] [US3] Add integration test for `target: "auto"` fallback suggestion in `packages/openclaw-tools/tests/fallback-auto.test.ts`

### Implementation for User Story 3

- [ ] T025 [US3] Create `packages/openclaw-tools/mock-build-pc/server.ts` minimal HTTP server with `/`, `/api/catalog`, and `/api/reset` routes
- [ ] T026 [P] [US3] Create `packages/openclaw-tools/mock-build-pc/public/index.html` and `app.js` mirroring `phongvu.vn/buildpc` layout
- [ ] T027 [P] [US3] Create `packages/openclaw-tools/mock-build-pc/public/catalog.json` derived from `@buildmate/catalog` full replica
- [ ] T028 [US3] Integrate `live`/`mock`/`auto` target resolution into `packages/openclaw-tools/src/tools/add-to-build.ts` and `packages/openclaw-tools/src/tools/read-current-build.ts`

**Checkpoint**: All user stories should now be independently functional, including fallback to the mock page.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gate verification, runtime verification, and cross-cutting improvements

- [ ] T029 [P] Update `packages/openclaw-tools/tests/plugin-registration.test.ts` to assert all 6 tools are registered
- [ ] T030 [P] Run `npm test` in `packages/openclaw-tools` and fix all failures
- [ ] T031 Install plugin via `openclaw plugins install --link ./packages/openclaw-tools` from repo root
- [ ] T032 Restart OpenClaw gateway and verify runtime with `openclaw plugins inspect buildmate-tools --runtime --json`
- [ ] T033 Run WebChat end-to-end test per `specs/004-dom-build-tools/quickstart.md`
- [ ] T034 Run `boundary-architect` skill review to verify DOM tool layer boundaries
- [ ] T035 Update `AGENTS.md` Active Technologies / Recent Changes if any divergence remains

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) — shares `parser.ts` and `page-object.ts` with US1, but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) — depends on US1 and US2 automation primitives, but mock page and fallback detector are independently testable

### Within Each User Story

- Tests validate the implementation; pure helper tests can be written alongside the helper
- Foundational models/helpers before tool wrappers
- Tool wrappers before plugin registration wiring
- Core implementation before integration tests
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models/helpers within a story marked [P] can run in parallel
- Mock page HTML/JS and catalog.json can be developed in parallel

---

## Parallel Example: User Story 1

```bash
# In packages/openclaw-tools:
# Launch tests for User Story 1 together:
Task: "Add unit tests for SKU matcher and category resolver in tests/dom-helpers.test.ts"
Task: "Add integration test for add_to_build on mock page in tests/add-to-build-mock.test.ts"

# Launch foundational helpers together (after schemas/page-object exist):
Task: "Implement add-by-SKU automation flow in src/dom/build-actions.ts"
Task: "Create src/tools/add-to-build.ts tool wrapper"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test `add_to_build` independently on the mock page
5. Demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Demo (MVP!)
3. Add User Story 2 → Test independently → Demo
4. Add User Story 3 → Test independently → Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (`add_to_build`)
   - Developer B: User Story 2 (`read_current_build`)
   - Developer C: User Story 3 (mock page + fallback detector)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests pass after implementing each story
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
