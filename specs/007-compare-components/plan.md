# Implementation Plan: Component Comparison Tool

**Branch**: `007-compare-components` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-compare-components/spec.md`

## Summary

Xây dựng `compare_components` tool cho phép shopper so sánh 2-5 SKU linh kiện PC side-by-side theo 9 trường (price, stock, promo, socket, ram_gen, tdp, wattage, clearance, form_factor) và nhận gợi ý best-fit theo use case (gaming/productivity/budget). Phần so sánh bảng và chấm điểm best-fit là **deterministic pure functions** (Principle II); phần giải thích bằng ngôn ngữ tự nhiên do LLM layer tạo ra (Principle III). Feature là **S2 stretch** trong ADR-0003 — chỉ implement sau khi S1 (search+compile) và S3 (detect+repair) hoàn thành.

## Technical Context

**Language/Version**: TypeScript 5.x trên Node.js 22.17 LTS
**Primary Dependencies**: `@buildmate/catalog` (workspace — lookup SKU), `@buildmate/compiler` (workspace — type definitions), `openclaw/plugin-sdk` (tool plugin registration), `@sinclair/typebox` (parameter schemas)
**Storage**: N/A — pure functions, không persist; OpenClaw owns session/memory (Constitution Principle I)
**Testing**: `node:test` + `node:assert/strict` — test deterministic logic độc lập, không cần OpenClaw runtime
**Target Platform**: Node 22+ server-side tool plugin
**Project Type**: OpenClaw tool plugin wrapping a small deterministic comparator library
**Performance Goals**: So sánh 2-5 SKU < 50ms (catalog lookup là phần chậm nhất); recommendation prose < 5s end-to-end (do LLM call)
**Constraints**: Comparison logic MUST be deterministic; LLM chỉ dùng cho prose; chỉ support 2-5 SKU; chỉ support 3 use cases (gaming/productivity/budget); out-of-scope: live benchmarking, external reviews
**Scale/Scope**: 1 comparator module/package, 1 tool registration, ~8 unit tests, 3 use-case scoring rules, 9 comparison fields

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| # | Nguyên tắc (Constitution) | Trạng thái | Ghi chú |
|---|---|---|---|
| I | OpenClaw owns session/memory | PASS | Comparator là pure functions, không state, không SessionStore. Tool plugin stateless. |
| II | Build Compiler = deterministic trust layer, pure functions, unit-testable, LLM không đoán compatibility | PASS by design | Comparison table và best-fit scoring đều deterministic. Không dùng LLM để chọn SKU. Mỗi scoring rule có unit test. |
| III | Model = provider config, không thêm LangChain/LangGraph | PASS | Comparator không gọi model. Prose generation xảy ra ở OpenClaw agent/tool layer thông qua model provider config. |
| IV | WebChat = channel primary | PASS | Tool plugin channel-agnostic; WebChat vẫn là primary. |
| V | Docs tiếng Việt + English thuật ngữ, ADR format, không emoji | PASS | Plan docs theo convention. |

| Constraint | Trạng thái | Ghi chú |
|---|---|---|
| Hackathon time-box (S2 = stretch, sau S1+S3) | STRETCH | ADR-0003 §2.3: S2 (`compare_components`) là stretch. Plan đánh dấu rõ dependency vào 001+002+003. Chỉ implement khi MVP done early. |
| MVP = S1+S3, S3 KHÔNG cắt | PASS | Feature này không cắt S3; nó là bổ sung sau MVP. |
| Quality Gate: `npm test` xanh trước demo | PASS by design | Comparator logic có ~8 unit test standalone. |
| boundary-architect: Tool plugin layer wrap+dispatch | PASS | Deterministic comparator tách riêng; tool plugin chỉ wrap+dispatch (tương tự 003). |
| ADR-0003 §2.3 scope (OUT: live benchmarking, external reviews) | PASS | Out-of-scope explicit trong spec. |

**Gate result (pre-Phase 0)**: PASS — không violation nguyên tắc. S2 stretch được ghi nhận nhưng không vi phạm Constitution.

### Post-Phase 1 re-check (sau khi design xong + research clarified)

| # | Nguyên tắc | Re-check | Evidence |
|---|---|---|---|
| I | OpenClaw owns session/memory | PASS | `data-model.md` §7: no state, no persistence. `contracts` §6: tool plugin không persist. |
| II | Deterministic trust layer, pure, no LLM | PASS | `contracts` §1-§3: comparison + scoring là pure functions. `data-model.md` §4-§5: scoring rules deterministic, không dùng benchmark/reviews. |
| III | Model = provider config | PASS | `contracts` §6 non-goals: comparator không gọi model; prose generation do agent/tool layer qua provider config. |
| IV | WebChat primary | PASS | Tool plugin channel-agnostic. |
| V | Docs tiếng Việt + English thuật ngữ | PASS | Tất cả artifact theo convention. |
| Hackathon | S2 stretch | STRETCH | `quickstart.md` ghi rõ: chỉ chạy sau khi 001+002+003 xong. |
| Quality Gate | `npm test` xanh | PASS | `quickstart.md` documents ~8 unit tests. |
| boundary | Tool plugin layer | PASS | `packages/comparator/` (hoặc `packages/compiler/src/compare.ts`) tách deterministic logic; tool plugin chỉ wrap. |
| ADR-0003 scope | OUT: benchmarking, reviews | PASS | `contracts` §6 + `data-model.md` §8 explicit out-of-scope. |

**Gate result (post-Phase 1 + clarifications)**: PASS — design không drift. S2 stretch vẫn được ghi nhận.

## Project Structure

### Documentation (this feature)

```text
specs/007-compare-components/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── compare-components-contract.md
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
├── openclaw-tools/              # 003-wire-openclaw-plugins (existing)
│   ├── src/
│   │   ├── index.ts             # register existing 4 tools + compare_components
│   │   ├── schemas.ts           # TypeBox parameter schemas (updated)
│   │   └── tools/
│   │       ├── compile-build.ts
│   │       ├── detect-errors.ts
│   │       ├── repair-build.ts
│   │       ├── search-components.ts
│   │       └── compare-components.ts   # NEW — wraps comparator
│   └── tests/
│       └── compare-components-tool.test.ts
└── comparator/                  # NEW — deterministic comparison library (stretch)
    ├── package.json             # name: @buildmate/comparator
    ├── tsconfig.json            # strict, target ES2023, module NodeNext
    ├── src/
    │   ├── index.ts             # public API: compareComponents, selectBestFit
    │   ├── types.ts             # ComparisonTable, ComparisonRow, UseCase
    │   ├── compare.ts           # deterministic table generation
    │   ├── score.ts             # deterministic use-case scoring
    │   └── validate.ts          # input validation (SKU count, category match)
    └── tests/
        ├── compare.test.ts      # table fields, missing data, category mismatch
        ├── score.test.ts        # gaming/productivity/budget winners
        └── validate.test.ts     # 2-5 SKU validation
```

**Structure Decision**: Tách `packages/comparator/` riêng (giống pattern `packages/compiler/` của 001). Lý do: comparison là deterministic trust capability độc lập, không nên trộn vào tool plugin layer. Nếu time-box S2 quá gắt, có thể collapse `packages/comparator/src/` vào `packages/compiler/src/compare/` mà vẫn giữ deterministic boundary; plan này recommend package riêng để ranh giới rõ ràng.

## Complexity Tracking

> Không có Constitution violation. S2 stretch là scope decision đã được ADR-0003 chấp nhận; không ghi vào bảng này.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |
