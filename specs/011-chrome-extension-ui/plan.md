# Implementation Plan: Chrome Extension DOM Demo

**Branch**: `008-chrome-extension-ui` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

## Summary

Mở rộng BuildMate Chrome Extension để chạy đúng tại `https://phongvu.vn/buildpc`: chatbot panel tự mount, theo dõi Build PC read-only và thực hiện demo chọn VGA đầu tiên sau explicit user confirmation. Thiết kế kèm Gateway-native bridge contract: OpenClaw plugin gọi paired extension relay như một node, relay chỉ chuyển command allowlisted xuống panel. Live bridge không nằm trong demo code cho đến khi Gateway, pairing và plugin tool được cấu hình.

## Technical Context

**Language/Version**: JavaScript ES2022, Chrome Manifest V3, Node.js 26 cho test  
**Primary Dependencies**: Không runtime dependency; Chrome Extensions APIs + DOM platform APIs  
**Storage**: N/A; action/tracker state ephemeral theo tab. Gateway owns all session/memory.  
**Testing**: `node:test` cho URL/action/command/state helpers; manual smoke trên Phong Vu; fixture DOM test cho selector flow khi có fixture  
**Target Platform**: Chrome desktop, canonical non-www Phong Vu Build PC  
**Project Type**: Chrome Extension channel UI + future OpenClaw node relay contract  
**Performance Goals**: UI tracker update dưới 2 giây; demo action complete/fail cụ thể dưới 10 giây  
**Constraints**: Exact URL gate; semantic selectors only; no checkout/payment/navigation/multi-tab; all DOM mutation requires panel confirmation; no session store, model call or WebChat-protocol reverse engineering  
**Scale/Scope**: Một category VGA demo, read-only snapshot, mocked command adapter; no live Gateway transport yet

## Constitution Check

| # | Nguyên tắc | Trạng thái | Evidence |
|---|---|---|---|
| I | OpenClaw owns session/memory | PASS | Extension only has tab-local action/tracker state; relay has no chat/session store. |
| II | Compiler deterministic trust layer | PASS | Demo chooses a first displayed product; it never makes compatibility decisions. |
| III | Model provider config | PASS | Extension has no model call; agent invokes a typed plugin tool only after Gateway integration. |
| IV | WebChat primary | PASS with stretch | Extension is a user-directed stretch surface; bridge uses Gateway node protocol, not a replacement WebChat channel. |
| V | Vietnamese docs + English terms | PASS | Docs/UI are Vietnamese with technical terms retained. |

**Gate result**: PASS. User explicitly prioritised this stretch demo. The live node relay is deferred until secure Gateway pairing exists.

## Research Decisions

1. **Exact mount**: Static content script uses only non-www `/buildpc`; a runtime predicate rechecks protocol, host and pathname before mount and before any click.
2. **DOM action**: A Page Object uses text/aria/role/data selectors, native bubbling pointer/mouse/click events, and waits for product content rather than modal shell. It emits a typed result, never checkout.
3. **Tracking**: A debounced MutationObserver reads a normalized snapshot, ignores extension-owned DOM, and reports `unavailable` instead of guessing.
4. **OpenClaw bridge**: Extension relay is a paired Gateway node. A stateless tool plugin invokes `buildmate.ui.v1` through `api.runtime.nodes.invoke`; relay validates a versioned envelope and forwards only to the content script.
5. **User control**: `status`/`suggest` commands update panel; `request-add` only creates a confirm card. Agent-supplied selectors, URLs and JavaScript are rejected.

## Project Structure

```text
apps/chrome-extension/
├── manifest.json
├── content-script.js
├── panel.js
├── page-actions.js          # semantic selector + add-demo flow
├── build-tracker.js         # read-only MutationObserver snapshot
├── bridge-adapter.js        # mocked command contract; no live WS
├── shared/
│   ├── eligibility.js
│   ├── command-policy.js
│   └── panel-state.js
└── tests/
    └── panel-state.test.js

packages/openclaw-tools/     # future only: buildmate_request_ui tool
```

## Bridge Boundary

```text
OpenClaw agent
  -> buildmate_request_ui tool plugin (stateless)
  -> Gateway node.invoke: buildmate.ui.v1
  -> paired Extension Relay (future service worker/native companion)
  -> chrome.runtime message
  -> content script/panel
  -> user Confirm
  -> fixed semantic DOM action
```

The relay must use Gateway pairing/device credentials and command allowlists. It must not expose tokens to the page DOM, accept arbitrary selector/JS payloads, or persist conversations. A direct extension WebSocket is not implemented until its Gateway origin/pairing requirements are verified.

## Boundary Review: Extension DOM Demo

| Component | Layer | Nguyên tắc | Pure fn? | Unit test? | Violation |
|---|---|---|---|---|---|
| `page-actions.js` | Channel / Chrome Extension | #1, #4 | No — user-confirmed external DOM action | Manual smoke | — |
| `build-tracker.js` | Channel / Chrome Extension | #1, #2 | Parser helpers only | Snapshot helper tests | Read-only; no compatibility verdict. |
| `bridge-adapter.js` | Channel / future node relay edge | #1, #3 | Command policy is pure | Yes | Mock only; no Gateway/session implementation. |
| future `buildmate_request_ui` | Tool plugin | #1, #2 | Envelope validation yes | Required before live bridge | Stateless node invocation only. |
| Build Compiler | Tool plugin / Compiler | #2 | Yes | Existing feature responsibility | Not touched. |

**Verdict: APPROVED.** The extension stays a stretch channel surface. OpenClaw retains sessions, memory, routing and tool dispatch; the extension only receives typed requests and requires in-page confirmation before a fixed DOM action.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Extension DOM demo is a stretch surface | User requested an in-page demo before server integration | Keeps scope bounded: one confirmed VGA action and no bridge transport. |
