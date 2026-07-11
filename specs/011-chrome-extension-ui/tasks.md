---
description: "Task list for Chrome Extension DOM demo and OpenClaw bridge contract"
---

# Tasks: Chrome Extension DOM Demo

**Input**: Design artifacts in `/specs/008-chrome-extension-ui/`
**Tests**: `node:test` covers pure URL, action state, snapshot and command-policy behavior. Live Phong Vu interaction is manual smoke testing because its DOM is external and dynamic.

## Phase 1: Exact-page and foundational contract

- [X] T001 Update `apps/chrome-extension/manifest.json` and `shared/eligibility.js` so only the canonical non-www `/buildpc` page can mount the UI.
- [X] T002 Add exact-page and action-transition tests to `apps/chrome-extension/tests/panel-state.test.js`.
- [X] T003 [P] Create `apps/chrome-extension/shared/action-state.js` for cancellable typed demo-action transitions.
- [X] T004 [P] Create `apps/chrome-extension/shared/command-policy.js` for versioned, expired and allowlisted bridge command validation.
- [X] T005 [P] Create `apps/chrome-extension/shared/snapshot.js` for normalized read-only snapshot comparison.

## Phase 2: User Story 1 - Exact BuildMate surface (P1)

**Independent Test**: Only `https://phongvu.vn/buildpc` mounts launcher/panel.

- [X] T006 [US1] Update `apps/chrome-extension/content-script.js` with defense-in-depth exact-route gate before mount and every action.
- [X] T007 [US1] Update `apps/chrome-extension/popup.js` so unsupported tabs do not attempt to message a content script.

## Phase 3: User Story 2 - User-confirmed VGA demo (P1)

**Independent Test**: User confirms `Thêm VGA demo`; extension returns a success/unverified/typed failure without checkout.

- [X] T008 [P] [US2] Create `apps/chrome-extension/page-actions.js` with semantic page-object helpers, native event sequence, waits, cancellation and verification.
- [X] T009 [US2] Extend `apps/chrome-extension/panel.js` with an accessible confirmation action card and typed demo-action result UI.
- [X] T010 [US2] Wire `page-actions.js` through `apps/chrome-extension/content-script.js` with one in-flight action, route rechecks and result propagation.

## Phase 4: User Story 3 - Read-only build tracking (P1)

**Independent Test**: Build list mutation produces a normalized snapshot in panel within two seconds or a safe unavailable status.

- [X] T011 [US3] Create `apps/chrome-extension/build-tracker.js` with debounced MutationObserver, extension-host filtering and semantic snapshot parsing.
- [X] T012 [US3] Extend `apps/chrome-extension/panel.js` to render build snapshot/unavailable state without treating it as compatibility advice.
- [X] T013 [US3] Wire tracker lifecycle into `apps/chrome-extension/content-script.js`.

## Phase 5: User Story 4 - Mocked OpenClaw command adapter (P2)

**Independent Test**: A valid status/suggestion updates panel; an add request creates confirmation only; stale/unknown command is rejected.

- [X] T014 [US4] Create `apps/chrome-extension/bridge-adapter.js` that validates mock node command envelopes and relays allowed UI events through `chrome.runtime`.
- [X] T015 [US4] Extend `apps/chrome-extension/content-script.js` and `panel.js` to render allowlisted bridge status/suggestion/request-add commands without auto-clicking page DOM.
- [X] T016 [US4] Document the future paired node invocation contract in `specs/008-chrome-extension-ui/contracts/extension-dom-bridge-contract.md` and `specs/008-chrome-extension-ui/quickstart.md`.

## Phase 6: Validation and boundary review

- [X] T017 Run `npm test`, JavaScript syntax checks and manifest static checks.
- [ ] T018 Run manual Chrome smoke test from `specs/008-chrome-extension-ui/quickstart.md`; record real DOM selector result and failures.
- [X] T019 Run `boundary-architect` review and update `specs/008-chrome-extension-ui/plan.md` if bridge boundaries drift.
- [X] T020 Update `README.md` and `AGENTS.md` to distinguish DOM demo from future paired OpenClaw relay.

## Dependencies

- T001–T005 block all stories.
- US2 and US3 can be developed after foundation but touch `content-script.js`/`panel.js` sequentially.
- US4 depends on exact gate and action confirmation from US2.
- Live bridge transport is explicitly not a task until Gateway/node pairing prerequisites are available.
