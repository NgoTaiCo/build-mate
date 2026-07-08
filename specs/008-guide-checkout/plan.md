# Implementation Plan: Checkout Guidance Tool — `guide_checkout`

**Branch**: `008-guide-checkout` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/008-guide-checkout/spec.md`

## Summary

Mở rộng OpenClaw tool plugin `@buildmate/openclaw-tools` (từ `003-wire-openclaw-plugins`) bằng tool `guide_checkout`. Tool nhận một build PC đã compile và repair, gọi hàm deterministic trong module `checkout` để lắp ráp `OrderSummary` (danh sách linh kiện, tổng giá, trạng thái tồn kho, khuyến mãi đã áp dụng) và `CheckoutGuide` (URL + các bước điều hướng đến trang thanh toán). Phần giải thích bằng ngôn ngữ tự nhiên do OpenClaw agent/model layer tạo ra thông qua provider config; tool KHÔNG gọi LLM. Feature là **S4 stretch** trong ADR-0003 — chỉ triển khai sau khi MVP (S1+S3) hoàn thành. Tool tuyệt đối không thực hiện thanh toán thật, không submit đơn hàng, không thu thập thẻ, không tự động điền địa chỉ.

## Technical Context

**Language/Version**: TypeScript 5.x trên Node.js 22.17 LTS  
**Primary Dependencies**: `openclaw/plugin-sdk`, `@buildmate/compiler` (workspace — Build type), `@buildmate/catalog` (workspace — Component lookup), `@sinclair/typebox`  
**Storage**: N/A — tool plugin stateless, không persist; OpenClaw owns session/memory (Constitution Principle I)  
**Testing**: `node:test` + `node:assert/strict` — test deterministic checkout-summary logic độc lập, không cần OpenClaw runtime  
**Target Platform**: Node 22+ server-side OpenClaw tool plugin  
**Project Type**: OpenClaw tool plugin extension  
**Performance Goals**: Tổng hợp đơn hàng < 50ms; prose rendering < 5 giây end-to-end (do agent LLM layer)  
**Constraints**: Data assembly MUST be deterministic; LLM chỉ dùng cho prose ở agent layer; KHÔNG thực hiện thanh toán / submit đơn / điền địa chỉ / thu thập thẻ; S4 stretch; chỉ hỗ trợ URL checkout cố định hoặc fallback steps  
**Scale/Scope**: 1 tool registration, 1 deterministic summary module, ~5-7 unit tests, thêm vào `packages/openclaw-tools/`

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| # | Nguyên tắc (Constitution) | Trạng thái | Ghi chú |
|---|---|---|---|
| I | OpenClaw owns session/memory | PASS | Tool plugin stateless, không tự xây SessionStore, không persist conversation state. |
| II | Build Compiler = deterministic trust layer, pure functions, unit-testable, LLM không đoán compatibility | PASS by design | `guide_checkout` không xử lý compatibility. Phần lắp ráp `OrderSummary` là pure function deterministic (tính tổng giá, kiểm tra tồn kho). Không dùng LLM để chọn SKU hay tính giá. |
| III | Model = provider config, không thêm LangChain/LangGraph | PASS | Tool không gọi model. Prose generation xảy ra ở OpenClaw agent layer thông qua model provider config. |
| IV | WebChat = channel primary | PASS | Tool plugin channel-agnostic; WebChat vẫn là primary. Checkout URL có thể dùng cho bất kỳ channel nào. |
| V | Docs tiếng Việt + English thuật ngữ, ADR format, không emoji | PASS | Plan docs theo convention. |

| Constraint | Trạng thái | Ghi chú |
|---|---|---|
| Hackathon time-box (S4 = stretch, sau S1+S3) | STRETCH | ADR-0003 §2.3: `guide_checkout` là scene S4, implement chỉ khi MVP done early. |
| MVP = S1+S3, S3 KHÔNG cắt | PASS | Feature này không cắt S3; là bổ sung sau MVP. |
| Quality Gate: `npm test` xanh trước demo | PASS by design | Checkout summary module có ~5-7 unit test standalone. |
| boundary-architect: Tool plugin layer wrap+dispatch | PASS | Deterministic summary logic tách trong module riêng; tool plugin chỉ wrap+dispatch (tương tự pattern 003/007). |
| ADR-0003 §2.3 scope (OUT: payment thật, order placement, address autofill) | PASS | Out-of-scope explicit trong spec và sẽ được ghi trong contracts. |

**Gate result (pre-Phase 0)**: PASS — không violation nguyên tắc. S4 stretch được ghi nhận nhưng không vi phạm Constitution.

### Post-Phase 1 re-check (sau khi design xong + research clarified)

| # | Nguyên tắc | Re-check | Evidence |
|---|---|---|---|
| I | OpenClaw owns session/memory | PASS | `data-model.md` §6: no state, no persistence. `contracts/guide-checkout-contract.md` §8 non-goals: "Building a custom session store, orchestrator, or gateway replacement." |
| II | Deterministic trust layer, pure, no LLM | PASS | `contracts` §1-§3: `createOrderSummary` là pure function. `data-model.md` §4: `OrderSummary` chỉ chứa dữ liệu đã lookup từ catalog, không có prose. `contracts` §8 non-goals: "Calling model APIs inside the tool." |
| III | Model = provider config | PASS | `contracts` §8 non-goals: no model API calls inside tool, no external orchestrator. Prose generation stays in agent layer. |
| IV | WebChat primary | PASS | Tool plugin channel-agnostic. Checkout URL configurable via plugin config. |
| V | Docs tiếng Việt + English thuật ngữ | PASS | Tất cả artifact (plan/research/data-model/contracts/quickstart) theo convention. |
| Hackathon | S4 stretch | STRETCH | `quickstart.md` ghi rõ: chỉ chạy sau khi 001+002+003 xong. |
| Quality Gate | `npm test` xanh | PASS | `quickstart.md` documents ~5-7 unit tests + references 001/002/003 gates. |
| boundary | Tool plugin layer | PASS | `packages/openclaw-tools/src/checkout/` tách deterministic logic; tool plugin chỉ wrap. |
| ADR-0003 scope | OUT: payment, order, address autofill | PASS | `contracts` §8 + `data-model.md` §7 explicit out-of-scope. |

**Gate result (post-Phase 1 + clarifications)**: PASS — design không drift. S4 stretch vẫn được ghi nhận.

## Project Structure

### Documentation (this feature)

```text
specs/008-guide-checkout/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── guide-checkout-contract.md
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
└── openclaw-tools/              # 003-wire-openclaw-plugins (existing)
    ├── package.json             # add @buildmate/catalog if not yet
    ├── openclaw.plugin.json     # add "guide_checkout" to contracts.tools
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts             # register existing 4 tools + guide_checkout
    │   ├── schemas.ts           # TypeBox parameter schemas (updated)
    │   ├── tools/
    │   │   ├── compile-build.ts
    │   │   ├── detect-errors.ts
    │   │   ├── repair-build.ts
    │   │   ├── search-components.ts
    │   │   └── guide-checkout.ts   # NEW — wraps checkout summary
    │   └── checkout/
    │       ├── types.ts         # OrderSummary, CheckoutGuide, LineItem
    │       ├── summary.ts       # deterministic createOrderSummary(build, catalog)
    │       └── guide.ts         # buildCheckoutGuide(config) → URL + steps
    └── tests/
        ├── guide-checkout-tool.test.ts
        ├── summary.test.ts
        └── guide.test.ts
```

**Structure Decision**: Mở rộng package `packages/openclaw-tools/` thay vì tạo package mới. Lý do: `guide_checkout` là tool đơn giản, chủ yếu wrap một hàm deterministic nhỏ và dispatch về `@buildmate/catalog`. Tách module `src/checkout/` đủ để giữ ranh giới pure-function vs tool plugin; tạo package riêng sẽ overkill cho một stretch goal có time-box chặt. Nếu sau này checkout logic phình to (nhiều rule, nhiều kênh bán hàng), có thể extract thành `packages/checkout/`.

## Complexity Tracking

> Không có Constitution violation. S4 stretch là scope decision đã được ADR-0003 chấp nhận; không ghi vào bảng này.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |
