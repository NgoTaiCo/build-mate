# Implementation Plan: Wire WebChat end-to-end demo

**Branch**: `005-wire-webchat-e2e-demo` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/005-wire-webchat-e2e-demo/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Xây dựng luồng demo end-to-end trên WebChat cho hackathon: S1 (tìm kiếm linh kiện → biên dịch cấu hình → trình bày kết quả) rồi S3 (gửi cấu hình lỗi → phát hiện E001/E002 → lập kế hoạch sửa → tự động áp dụng linh kiện đề xuất). Cần deliver một OpenClaw tool plugin gồm Build Compiler package (pure functions), MockCatalog adapter, và DOM execution tools với fallback mock trang build PC; đồng thờii diễn tập toàn bộ hành trình S1 → S3 ít nhất một lần.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22.17 LTS (Node 22.19+)  
**Primary Dependencies**: OpenClaw plugin SDK, `@sinclair/typebox` (tool schemas), `@buildmate/compiler`, `@buildmate/catalog` (workspace packages), Playwright (server-side browser automation fallback)  
**Storage**: N/A — OpenClaw owns durable sessions/memory; Compiler và Catalog là stateless pure functions  
**Testing**: `npm test` (Node built-in test runner qua `tsx`); `npm run lint` (TypeScript compiler / ESLint tùy chọn)  
**Target Platform**: Node.js server chạy OpenClaw Gateway; WebChat client trên mọi browser hiện đại  
**Project Type**: OpenClaw tool plugin + deterministic compiler packages (monorepo workspace)  
**Performance Goals**: Tool calls của Compiler < 100ms p95; token stream đầu tiên đến user < 3s; toàn bộ demo S1 → S3 < 5 phút  
**Constraints**: 1 ngày build + 1 ngày demo; KHÔNG tự xây SessionStore/Backend Gateway; LLM KHÔNG được đoán compatibility; browser automation trên phongvu.vn chưa verify nên cần fallback mock trang build PC; S2 compare / S4 checkout / Extension nằm ngoài scope  
**Scale/Scope**: 1 demo agent, MockCatalog ~50 linh kiện, 5 compiler rules, ít nhất 1 lần rehearsal S1 → S3  

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Status | Notes |
| --- | --- | --- |
| I. OpenClaw owns Session & Memory | PASS | Không xây SessionStore riêng; dùng OpenClaw `per-channel-peer` sessions và QMD memory. |
| II. Build Compiler = Deterministic Trust Layer | PASS | Compiler tools là pure functions có unit test; error codes E001/E002; LLM không check compatibility. |
| III. Model = Provider Config | PASS | mimo pro cấu hình trong `~/.openclaw/openclaw.json`; không thêm orchestrator ngoài. |
| IV. WebChat = Channel Primary | PASS | Demo chạy trên OpenClaw WebChat native; Extension / S2 / S4 bị loại trừ. |
| V. Docs Tiếng Việt + English Thuật Ngữ | PASS | Plan/spec/docs viết tiếng Việt, giữ English thuật ngữ kỹ thuật; không emoji. |
| Quality Gate `npm test` xanh | PASS | Compiler có ~15 unit test; gate bắt buộc trước demo. |
| Boundary review skill | PASS | Dùng `boundary-architect` skill trước khi implement. |

## Project Structure

### Documentation (this feature)

```text
specs/005-wire-webchat-e2e-demo/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/
├── @buildmate/compiler/          # Pure functions: compile_build, detect_errors, repair_build
│   ├── src/
│   │   ├── rules/
│   │   │   ├── socket.ts         # E001 SOCKET_MISMATCH
│   │   │   ├── psu-wattage.ts    # E002 POWER_INSUFFICIENT (demo focus)
│   │   │   └── ram-generation.ts # E002 RAM_GEN_MISMATCH (nếu cần mở rộng)
│   │   ├── index.ts
│   │   └── types.ts
│   └── tests/
│       └── rules/
├── @buildmate/catalog/           # Mock catalog adapter: search_components
│   ├── src/
│   │   ├── data/
│   │   │   └── components.json   # ~50 mock components
│   │   ├── search.ts
│   │   └── index.ts
│   └── tests/
├── @buildmate/openclaw-tools/    # OpenClaw tool plugin wrapper
│   ├── src/
│   │   ├── index.ts              # registerTool calls
│   │   └── schemas.ts            # TypeBox parameter schemas
│   ├── openclaw.plugin.json
│   └── package.json
└── @buildmate/dom-tools/         # DOM execution: add_to_build / read_current_build
    ├── src/
    │   ├── browser-automation.ts # Playwright server-side primary
    │   └── mock-page.ts          # Self-hosted mock build-PC fallback
    └── tests/
tests/
├── contract/                     # Tool input/output contract tests
├── integration/                  # OpenClaw plugin integration smoke tests
└── e2e/                          # Rehearsal scripts for S1 → S3
scripts/
└── rehearsal.mjs                 # End-to-end demo rehearsal runner
```

**Structure Decision**: Monorepo workspace với scoped packages giữ Compiler độc lập khỏi OpenClaw runtime, phù hợp ADR-0001 layer separation, và cho phép từng layer được unit test độc lập.
