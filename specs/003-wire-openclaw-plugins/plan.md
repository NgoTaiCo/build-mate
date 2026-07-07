# Implementation Plan: Wire Compiler and Catalog as OpenClaw Tool Plugins

**Branch**: `003-wire-openclaw-plugins` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-wire-openclaw-plugins/spec.md`

## Summary

Tạo OpenClaw tool plugin (`@buildmate/openclaw-tools`) đăng ký 4 tools — `compile_build`, `detect_errors`, `repair_build`, `search_components` — bằng cách wrap và dispatch sang `@buildmate/compiler` (001) và `@buildmate/catalog` (002). Plugin không chứa business logic, không state, không LLM call, không session store. Cài đặt local qua `openclaw plugins install --link ./packages/openclaw-tools`, restart gateway, verify bằng `openclaw plugins inspect buildmate-tools --runtime --json` và end-to-end invocation qua WebChat. Feature này nằm trong slot HOUR 8-10 của 1-day hackathon plan (ADR-0003 §3).

## Technical Context

**Language/Version**: TypeScript 5.x trên Node.js 22.17 LTS
**Primary Dependencies**: `openclaw/plugin-sdk` (OpenClaw tool plugin API), `@buildmate/compiler` (workspace/local), `@buildmate/catalog` (workspace/local), `@sinclair/typebox` (parameter schemas)
**Storage**: N/A — plugin stateless, không persist; OpenClaw owns session/memory (Constitution Principle I)
**Testing**: `node:test` (Node built-in) + `node:assert/strict` — same convention as 001/002
**Target Platform**: OpenClaw Gateway trên Node 22+; server-side in-process tool execution
**Project Type**: OpenClaw tool plugin package
**Performance Goals**: Tool dispatch <50ms per call (in-process pure function call, no network)
**Constraints**: Compiler logic MUST remain pure (plugin chỉ wrap+dispatch); no SessionStore, no external orchestrator; hackathon time-box HOUR 8-10; tool names fixed (`compile_build`, `detect_errors`, `repair_build`, `search_components`)
**Scale/Scope**: 1 plugin package, 4 tools, ~13 unit tests, local linked install, runtime verification

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| # | Nguyên tắc (Constitution) | Trạng thái | Ghi chú |
|---|---|---|---|
| I | OpenClaw owns session/memory | PASS | Plugin stateless, không tự xây SessionStore, không persist conversation state. OpenClaw gateway vẫn là nguồn sự thật cho session/routing. |
| II | Build Compiler = deterministic trust layer, pure functions, unit-testable, LLM không đoán compatibility, mỗi rule có unit test | PASS by design | Plugin chỉ dispatch; Compiler logic nằm nguyên trong `@buildmate/compiler` và vẫn pure. `repair_build` cũng dispatch về Compiler. `search_components` dispatch về Catalog. Không logic compatibility nào ở plugin layer. |
| III | Model = provider config, không thêm LangChain/LangGraph | PASS | Plugin không gọi model, không thêm orchestrator ngoài OpenClaw embedded agent runtime. |
| IV | WebChat = channel primary | PASS | Tool plugin channel-agnostic; WebChat là channel primary tiếp tục hoạt động qua OpenClaw gateway. Extension/DOM exec out of scope. |
| V | Docs tiếng Việt + English thuật ngữ, ADR format, không emoji | PASS | Plan docs theo convention. |

| Constraint | Trạng thái | Ghi chú |
|---|---|---|
| Hackathon time-box (HOUR 8-10 = Wire plugin) | PASS | Đúng slot ADR-0003 §3. |
| MVP = S1+S3, S3 KHÔNG cắt | PASS | 4 tools cover S1 (`search_components` → `compile_build`) và S3 (`detect_errors` → `repair_build`). |
| Quality Gate: `npm test` xanh trước demo | PASS by design | Plan output ~13 unit test standalone cho plugin delegation. Compiler/Catalog tests từ 001/002 vẫn xanh. |
| boundary-architect: Tool plugin layer wrap+dispatch | PASS | `packages/openclaw-tools/` tách biệt, chỉ import `@buildmate/compiler` / `@buildmate/catalog`, không trộn logic. |
| ADR-0003 §2.3 scope (OUT: Extension, payment, P2/P3/P4) | PASS | `add_to_build` và `guide_checkout` explicit out-of-scope trong spec và contracts. |

**Gate result (pre-Phase 0)**: PASS — không violation. Không cần Complexity Tracking.

### Post-Phase 1 re-check (sau khi design xong + research clarified)

| # | Nguyên tắc | Re-check | Evidence |
|---|---|---|---|
| I | OpenClaw owns session/memory | PASS | `data-model.md` §7 invariant: "Stateless: plugin holds no mutable state; no session storage; no cache." `contracts/tool-plugin-contracts.md` §6 non-goals: "Building a custom session store, orchestrator, or gateway replacement." |
| II | Deterministic trust layer, pure, no LLM | PASS | `research.md` §8: plugin chỉ wrap+dispatch, không logic compatibility. `contracts` §1-§4: mỗi tool delegates trực tiếp đến pure function. `data-model.md` §4.2: output là JSON của kết quả pure function. `contracts` §8 non-goals: "Calling model APIs or using LLM to interpret compatibility." |
| III | Model = provider config | PASS | `contracts` §8 non-goals: no LangChain/LangGraph, no model API calls. Plugin depends only on OpenClaw SDK + compiler/catalog packages. |
| IV | WebChat primary | PASS | Tool plugin channel-agnostic. `contracts` không mention channel cụ thể. `add_to_build` DOM exec deferred. |
| V | Docs tiếng Việt + English thuật ngữ | PASS | All artifacts (plan/research/data-model/contracts/quickstart) follow convention. |
| Hackathon | time-box HOUR 8-10 | PASS | `quickstart.md` maps to HOUR 8-10 install/restart/verify flow. |
| Quality Gate | `npm test` xanh | PASS | `quickstart.md` lists ~13 plugin unit tests + references 001/002 gates. |
| boundary | Tool plugin layer | PASS | `packages/openclaw-tools/` separate; `data-model.md` §4: "No logic leakage — plugin does not interpret error codes...". |
| ADR-0003 §2.3 scope | OUT: Extension, payment, no scope creep | PASS | `contracts` §8 + `data-model.md` §8: `add_to_build`, `guide_checkout`, session store, orchestrator all OUT. |

**Gate result (post-Phase 1 + clarifications)**: PASS — design không drift. Không violation cần Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-wire-openclaw-plugins/
├── plan.md              # This file
├── research.md          # Phase 0 output (§R1-R8)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── tool-plugin-contracts.md
├── checklists/
│   └── requirements.md  # from /speckit.specify
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/
├── compiler/                    # 001-build-compiler-core (existing)
│   └── ...
├── catalog/                     # 002-mock-catalog-adapter (existing)
│   └── ...
└── openclaw-tools/              # 003-wire-openclaw-plugins (this feature)
    ├── package.json             # name: @buildmate/openclaw-tools, openclaw.extensions
    ├── openclaw.plugin.json     # plugin manifest
    ├── tsconfig.json            # strict, target ES2023, module NodeNext
    ├── src/
    │   ├── index.ts             # definePluginEntry + register 4 tools
    │   ├── schemas.ts           # TypeBox parameter schemas
    │   └── tools/
    │       ├── compile-build.ts      # wrap compileBuild
    │       ├── detect-errors.ts      # wrap detectErrors
    │       ├── repair-build.ts       # wrap repairBuild
    │       └── search-components.ts  # wrap searchComponents
    └── tests/
        ├── plugin-registration.test.ts
        ├── compile-build-tool.test.ts
        ├── detect-errors-tool.test.ts
        ├── repair-build-tool.test.ts
        ├── search-components-tool.test.ts
        └── error-handling.test.ts
```

**Structure Decision**: Single OpenClaw tool plugin package tại `packages/openclaw-tools/`. Lý do: ADR-0001 §3 đặt Tool Plugins là một layer riêng trên Compiler/Catalog. Tách package vật lý enforcement ranh giới: plugin chỉ import 001/002, không thêm logic. Root `package.json` workspaces bao gồm cả 3 packages.

## Complexity Tracking

> Không có Constitution violation → bảng trống, không ghi.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |
