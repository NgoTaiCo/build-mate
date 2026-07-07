# Implementation Plan: DOM Build Tools

**Branch**: `004-dom-build-tools` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-dom-build-tools/spec.md`

## Summary

Mở rộng OpenClaw tool plugin `@buildmate/openclaw-tools` với 2 tool DOM execution mới — `add_to_build(sku, target)` và `read_current_build(target)` — để agent có thể tương tác với trang `phongvu.vn/buildpc` server-side. Tool `add_to_build` tìm và click qua UI build PC để thêm linh kiện theo SKU; tool `read_current_build` parse trạng thái build hiện tại từ DOM. Khi trang thật không drive được (login wall, React/anti-bot, timeout, selector vỡ), hệ thống đề xuất fallback và chuyển sang self-hosted mock build-PC page sau khi user confirm. Feature nằm trong slot HOUR 10-12 của 1-day hackathon plan (ADR-0003 §3), nối tiếp sau `003-wire-openclaw-plugins`.

## Technical Context

**Language/Version**: TypeScript 5.x trên Node.js 22.17 LTS
**Primary Dependencies**: `openclaw/plugin-sdk` (OpenClaw tool plugin API), Playwright (server-side browser automation), `@buildmate/compiler` (workspace/local — optional pre-validation), `@buildmate/catalog` (workspace/local — mock page catalog source), `@sinclair/typebox` (parameter schemas)
**Storage**: N/A cho plugin state; mock build-PC page có thể đọc catalog data từ static JSON hoặc `@buildmate/catalog` export
**Testing**: `node:test` + `node:assert/strict` cho pure helpers; integration test chống mock build-PC page cho DOM tools (vì DOM tools có side effect, không deterministic)
**Target Platform**: OpenClaw Gateway trên Node 22+; server-side in-process tool execution; browser automation chạy trong cùng process gateway
**Project Type**: OpenClaw tool plugin package + static mock web page
**Performance Goals**: `add_to_build` hoàn thành trong vòng 30 giây kể từ khi agent confirm (SC-001); `read_current_build` trả kết quả trong vòng 10 giây; switch sang mock fallback trong vòng 10 giây sau user confirm (SC-004)
**Constraints**: KHÔNG được trigger checkout/payment/multi-tab; hackathon time-box HOUR 10-12; tool names fixed (`add_to_build`, `read_current_build`); plugin stateless; OpenClaw owns session/memory; Build Compiler vẫn là deterministic trust layer riêng biệt
**Scale/Scope**: 1 plugin package mở rộng thêm 2 tools, 1 self-hosted mock build-PC page, ~8-10 integration/unit tests, runtime verification qua WebChat

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| # | Nguyên tắc (Constitution) | Trạng thái | Ghi chú |
|---|---|---|---|
| I | OpenClaw owns session/memory | PASS | Plugin stateless, không tự xây SessionStore. Execution target (`live`/`mock`) được truyền qua tool params hoặc do agent layer quyết định; không lưu conversation state trong plugin. |
| II | Build Compiler = deterministic trust layer, pure functions, unit-testable, LLM không đoán compatibility | PASS by design | `add_to_build` là DOM execution tool, KHÔNG thuộc Compiler. Nếu cần validate trước khi add, plugin gọi `compile_build` / `detect_errors` từ `@buildmate/compiler` — vẫn deterministic. Compiler logic không bị leak vào DOM tool. |
| III | Model = provider config, không thêm LangChain/LangGraph | PASS | Plugin không gọi model, không thêm orchestrator ngoài OpenClaw embedded agent runtime. |
| IV | WebChat = channel primary | PASS | Tool plugin channel-agnostic. Chrome Extension overlay explicit out-of-scope; browser automation chạy server-side, không phụ thuộc extension client. |
| V | Docs tiếng Việt + English thuật ngữ, ADR format, không emoji | PASS | Plan docs theo convention. |

| Constraint | Trạng thái | Ghi chú |
|---|---|---|
| Hackathon time-box (HOUR 10-12 = DOM exec) | PASS | Đúng slot ADR-0003 §3. |
| MVP = S1+S3, S3 KHÔNG cắt | PASS | `add_to_build` là bước cuối của S3 repair flow (detect → repair → add). `read_current_build` hỗ trợ cả S1 review. |
| Quality Gate: `npm test` xanh trước demo | PASS by design | Pure helpers (selector parsers, SKU matchers, fallback detectors) có unit test. DOM tools có integration test chống mock page. Compiler tests từ 001 vẫn xanh. |
| boundary-architect: Tool plugin layer | PASS | `packages/openclaw-tools/` tách biệt; DOM tools chỉ import `@buildmate/catalog` (nếu cần) và browser automation lib, không trộn logic Compiler. |
| ADR-0003 §2.3 scope (OUT: Extension, payment, P2/P3/P4) | PASS | Extension overlay, checkout/payment, multi-tab explicit out-of-scope trong spec. |

**Gate result (pre-Phase 0)**: PASS — không violation. Không cần Complexity Tracking.

### Post-Phase 1 re-check (sau khi design xong + research clarified)

| # | Nguyên tắc | Re-check | Evidence |
|---|---|---|---|
| I | OpenClaw owns session/memory | PASS | `data-model.md` §7 invariant: plugin holds no mutable state; execution target passed as parameter. `contracts/dom-tool-contracts.md` §6: no session store, no caching. |
| II | Deterministic trust layer, pure, no LLM | PASS | `research.md` §8: DOM tools là side-effect tools, không thay thế Compiler. `contracts` §1-§2: nếu cần validate, gọi `compile_build`/`detect_errors`. `contracts` §7 non-goals: no compatibility logic in DOM tools. |
| III | Model = provider config | PASS | `contracts` §7 non-goals: no LangChain/LangGraph, no model API calls. Plugin depends only on OpenClaw SDK + Playwright + compiler/catalog packages. |
| IV | WebChat primary | PASS | Tool plugin channel-agnostic. `contracts` không mention channel cụ thể. Extension overlay deferred. |
| V | Docs tiếng Việt + English thuật ngữ | PASS | All artifacts follow convention. |
| Hackathon | time-box HOUR 10-12 | PASS | `quickstart.md` maps to HOUR 10-12 implement + verify flow. |
| Quality Gate | `npm test` xanh | PASS | `quickstart.md` lists unit tests for pure helpers + integration tests against mock page. |
| boundary | Tool plugin layer | PASS | `packages/openclaw-tools/` separate; `data-model.md` §4: DOM tools do not interpret compatibility errors. |
| ADR-0003 §2.3 scope | OUT: Extension, payment, no scope creep | PASS | `contracts` §7 + `data-model.md` §8: Extension overlay, checkout, payment, multi-tab all OUT. |

**Gate result (post-Phase 1 + clarifications)**: PASS — design không drift. Không violation cần Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/004-dom-build-tools/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── dom-tool-contracts.md
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
└── openclaw-tools/              # 003 + 004 (extended plugin)
    ├── package.json             # name: @buildmate/openclaw-tools, openclaw.extensions
    ├── openclaw.plugin.json     # plugin manifest: now 6 tools
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts             # definePluginEntry + register 6 tools
    │   ├── schemas.ts           # TypeBox parameter schemas
    │   ├── dom/
    │   │   ├── page-object.ts   # selectors + wait strategies for phongvu + mock
    │   │   ├── browser-pool.ts  # Playwright context lifecycle (stateless per call)
    │   │   └── parser.ts        # parse build state from DOM
    │   └── tools/
    │       ├── compile-build.ts
    │       ├── detect-errors.ts
    │       ├── repair-build.ts
    │       ├── search-components.ts
    │       ├── add-to-build.ts       # NEW
    │       └── read-current-build.ts # NEW
    ├── mock-build-pc/           # NEW — self-hosted mock build-PC page
    │   ├── package.json
    │   ├── server.ts            # minimal static + API server (Express / fastify / node:http)
    │   ├── public/
    │   │   ├── index.html       # mirror phongvu build PC layout
    │   │   ├── app.js           # mock React-like interactions
    │   │   └── catalog.json     # full catalog replica derived from @buildmate/catalog
    │   └── tests/
    │       └── mock-page.test.ts
    └── tests/
        ├── plugin-registration.test.ts   # 6 tools registered
        ├── dom-helpers.test.ts           # parser + matcher pure helpers
        ├── add-to-build-mock.test.ts     # integration: add via mock page
        ├── read-current-build-mock.test.ts # integration: read via mock page
        └── fallback-detector.test.ts     # login/timeout/anti-bot detection
```

**Structure Decision**: Mở rộng package `@buildmate/openclaw-tools` tại `packages/openclaw-tools/` với 2 DOM tools và thêm thư mục `mock-build-pc/`. Lý do:
- DOM tools vẫn thuộc OpenClaw tool plugin layer (ADR-0001 §3), cùng layer với 4 compiler/catalog tools.
- Giữ 1 plugin giảm overhead hackathon: 1 manifest, 1 install, 1 restart.
- Tách `mock-build-pc/` thành submodule riêng trong package để mock page có thể chạy standalone và được DOM tools target giống hệt phongvu.
- Browser automation logic (`dom/`) tách riêng khỏi tool wrappers để dễ test helpers deterministically.

## Complexity Tracking

> Không có Constitution violation → bảng trống, không ghi.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |
