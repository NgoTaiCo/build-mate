> ---
> description: "Task list for 008-guide-checkout implementation"
> ---

# Tasks: Checkout Guidance Tool — `guide_checkout`

**Feature**: `008-guide-checkout`  
**Input**: Design documents from `/specs/008-guide-checkout/`  
**Prerequisites**: `plan.md`, `spec.md`, `data-model.md`, `contracts/guide-checkout-contract.md`, `research.md`, `quickstart.md`

**Tests**: This task list includes unit-test tasks because `quickstart.md` / Constitution Quality Gate requires `npm test` xanh with ~5-7 tests.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format Notes

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks).
- **[USx]**: Maps task to User Story from `spec.md`.
- All descriptions include exact file paths.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure the OpenClaw tool plugin package is ready for the new tool.

- [ ] T001 Ensure `packages/openclaw-tools/package.json` exists and declares workspace dependencies on `@buildmate/compiler`, `@buildmate/catalog`, `openclaw/plugin-sdk`, and `@sinclair/typebox`
- [ ] T002 [P] Ensure `packages/openclaw-tools/tsconfig.json` uses strict TypeScript settings compatible with NodeNext module resolution
- [ ] T003 [P] Run `npm install` from repo root to resolve workspace dependencies

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Plugin registration plumbing that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Update `packages/openclaw-tools/openclaw.plugin.json` to add `"guide_checkout"` to `contracts.tools`
- [ ] T005 Update `packages/openclaw-tools/src/schemas.ts` with `GuideCheckoutInputSchema` (TypeBox) accepting `{ build: BuildComponent[] }`
- [ ] T006 Update `packages/openclaw-tools/src/index.ts` with the import and registration skeleton for `guide_checkout`

**Checkpoint**: Plugin manifest and input schema are in place; tool registration compiles.

---

## Phase 3: User Story 1 — Order Summary & Checkout Guide (Priority: P1) 🎯 MVP

**Goal**: Given a compiled+repaired build, produce a complete `OrderSummary` (component list, total price, stock status, applied promotions) and a `CheckoutGuide` (URL + steps).

**Independent Test**: Invoke `guide_checkout` with a 5-component build and verify the returned JSON contains all components, correct total price, stock statuses, promotions, and checkout navigation.

### Tests for User Story 1

- [ ] T007 [P] [US1] Create `packages/openclaw-tools/tests/summary.test.ts` with test cases: happy-path total, promo discount applied, stockReady true
- [ ] T008 [P] [US1] Create `packages/openclaw-tools/tests/guide.test.ts` with test cases: URL present, fallback steps when URL missing

### Implementation for User Story 1

- [ ] T009 [P] [US1] Create `packages/openclaw-tools/src/checkout/types.ts` defining `LineItem`, `OrderSummary`, and `CheckoutGuide`
- [ ] T010 [P] [US1] Create `packages/openclaw-tools/src/checkout/guide.ts` implementing `buildCheckoutGuide(config)` returning URL, steps, and fallback
- [ ] T011 [US1] Create `packages/openclaw-tools/src/checkout/summary.ts` implementing `createOrderSummary(build, catalogLookup, config)` (depends on T009, T010)
- [ ] T012 [US1] Create `packages/openclaw-tools/src/tools/guide-checkout.ts` wrapping `guideCheckout` with tool-plugin execute handler and returning JSON text
- [ ] T013 [US1] Wire `guide_checkout` registration in `packages/openclaw-tools/src/index.ts` (depends on T006, T012)

**Checkpoint**: User Story 1 is fully functional and independently testable via `npm test` and OpenClaw tool invocation.

---

## Phase 4: User Story 2 — Stock & Price Warnings (Priority: P2)

**Goal**: Highlight out-of-stock or price-missing components and advise the shopper without crashing.

**Independent Test**: Pass a build with one `out_of_stock` component and verify the response flags that item, sets `stockReady = false`, and includes a warning.

### Tests for User Story 2

- [ ] T014 [P] [US2] Create `packages/openclaw-tools/tests/summary-warnings.test.ts` covering: one out-of-stock item, all out-of-stock items, missing price, missing stock_status, promotion label without discount value

### Implementation for User Story 2

- [ ] T015 [US2] Extend `packages/openclaw-tools/src/checkout/summary.ts` to normalize stock status values (`in_stock`, `out_of_stock`, `unknown`) and emit per-line warnings
- [ ] T016 [US2] Extend `packages/openclaw-tools/src/checkout/summary.ts` to handle missing `price` or incomplete `promotion` gracefully (price = 0, discount = 0, warning appended)
- [ ] T017 [US2] Update `packages/openclaw-tools/src/checkout/guide.ts` to prepend a warning note in `steps` when `stockReady` is false

**Checkpoint**: User Stories 1 and 2 both work independently; edge cases return warnings instead of failing.

---

## Phase 5: User Story 3 — Natural-Language Rendering (Priority: P3)

**Goal**: The OpenClaw agent renders the structured `OrderSummary` + `CheckoutGuide` as friendly, conversational prose.

**Independent Test**: Send a WebChat message requesting checkout guidance and verify the assistant replies with a human-readable summary, not raw JSON.

### Implementation for User Story 3

- [ ] T018 [US3] Create `packages/openclaw-tools/src/prompts/guide-checkout-render.md` with instructions for the agent on how to convert `OrderSummary` + `CheckoutGuide` into natural-language Vietnamese prose
- [ ] T019 [US3] Update `packages/openclaw-tools/TOOLS.md` (or `AGENTS.md`) to reference the rendering instructions so the agent knows how to present `guide_checkout` results
- [ ] T020 [US3] Manually verify via WebChat that a `guide_checkout` result is rendered as readable text including component names, total price, warnings, and checkout steps

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gate, runtime verification, and documentation finalization.

- [ ] T021 Run `npm test` in `packages/openclaw-tools` until all tests pass
- [ ] T022 Run `npm run build` in `packages/openclaw-tools` and fix any TypeScript errors
- [ ] T023 Run `openclaw plugins inspect buildmate-tools --runtime --json` and confirm `guide_checkout` appears in `contracts.tools`
- [ ] T024 [P] Review `packages/openclaw-tools/src/tools/guide-checkout.ts` to ensure no payment/order/address/DOM code exists
- [ ] T025 [P] Update `specs/008-guide-checkout/quickstart.md` if any test or install commands changed during implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — blocks all user stories.
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion.
  - Execute in priority order (P1 → P2 → P3) or in parallel if team capacity allows.
- **Polish (Phase 6)**: Depends on all implemented user stories.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational phase. No dependencies on other stories.
- **User Story 2 (P2)**: Can start after Foundational phase and after `OrderSummary` logic from US1 exists; independently testable.
- **User Story 3 (P3)**: Can start after US1 delivers structured JSON output; independently testable via WebChat prose rendering.

### Within Each User Story

- Models (`types.ts`) before services (`summary.ts`, `guide.ts`).
- Services before tool wrapper (`guide-checkout.ts`).
- Tool wrapper before registration in `index.ts`.
- Tests verify behavior after implementation.

### Parallel Opportunities

- Setup tasks T002 and T003 can run in parallel.
- Foundational tasks T004, T005, and T006 can run in parallel (different files).
- US1 type/task tests T007 and T008 can run in parallel.
- US1 implementation tasks T009 and T010 can run in parallel.
- US2 tests T014 can run in parallel with US2 implementation tasks T015-T017 after US1 completes.
- US3 tasks T018 and T019 can run in parallel.
- Polish tasks T024 and T025 can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Run US1 unit tests after implementation:
packages/openclaw-tools/tests/summary.test.ts
packages/openclaw-tools/tests/guide.test.ts

# Implement US1 core files in parallel where possible:
packages/openclaw-tools/src/checkout/types.ts
packages/openclaw-tools/src/checkout/guide.ts
packages/openclaw-tools/src/checkout/summary.ts
packages/openclaw-tools/src/tools/guide-checkout.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1 (order summary + checkout guide + tests).
4. **STOP and VALIDATE**: Run `npm test` and OpenClaw tool inspect.
5. Demo if ready.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add User Story 1 → test independently → MVP checkpoint.
3. Add User Story 2 → test edge-case warnings independently.
4. Add User Story 3 → verify natural-language rendering via WebChat.
5. Run Polish phase (quality gate + runtime verification).

### Parallel Team Strategy

With multiple developers:

- Developer A: Phase 1 + Phase 2 (plugin plumbing).
- Developer B: Phase 3 US1 (summary/guide logic + tests).
- Developer C: Phase 4 US2 (warnings + tests) once US1 types land.
- Developer D: Phase 5 US3 (agent prose instructions + WebChat verify).

---

## Notes

- [P] tasks = different files, no dependencies.
- [USx] label maps task to the user story for traceability.
- Each user story is independently completable and testable.
- The tool must remain deterministic: no LLM, payment gateway, order API, or DOM automation inside `guide_checkout`.
- Stop at any checkpoint to validate the story independently.
