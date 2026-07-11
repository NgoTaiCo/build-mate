# Implementation Plan: Compiler MCP Server

**Branch**: `008-compiler-mcp-server` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-compiler-mcp-server/spec.md`

## Summary

Tạo package `@buildmate/mcp-server` — một MCP (Model Context Protocol) server độc lập expose 3 tool (`compile_build`, `detect_errors`, `repair_build`) bằng cách wrap và dispatch sang `@buildmate/compiler` (001-build-compiler-core) đã có sẵn. Server dùng official `@modelcontextprotocol/sdk` (TypeScript), transport `stdio` (local process, theo Assumption trong spec), input validation bằng `zod`. Server không chứa business logic — mọi compatibility/repair logic vẫn nằm nguyên trong Compiler; server chỉ là dispatch layer giống cách `003-wire-openclaw-plugins` sẽ làm cho OpenClaw's native plugin SDK, nhưng đây là con đường MCP protocol riêng biệt, độc lập với OpenClaw.

## Technical Context

**Language/Version**: TypeScript 5.x trên Node.js 22.17 LTS (đồng bộ với `packages/compiler`)
**Primary Dependencies**: `@modelcontextprotocol/sdk` (^1.29.0 — official TypeScript MCP SDK), `zod` (^3.x — tool input schema, required bởi SDK's `registerTool`), `@buildmate/compiler` (workspace/local dependency — 001-build-compiler-core); dev-only: `typescript`, `tsx`, `@types/node`
**Storage**: N/A — server stateless, không persist, không session; Compiler bên dưới cũng pure/stateless
**Testing**: `node:test` + `node:assert/strict` (đồng bộ convention 001); protocol round-trip test dùng SDK's `InMemoryTransport` để pair 1 `Client` + 1 `McpServer` trong cùng process (không cần spawn subprocess thật)
**Target Platform**: Node 22+, chạy như local process, giao tiếp qua MCP stdio transport
**Project Type**: MCP server package (thin dispatch layer trên thư viện pure function có sẵn)
**Performance Goals**: tool dispatch <50ms/call (in-process pure function call qua Compiler, không network/I/O ngoài stdio framing)
**Constraints**: server tuyệt đối không thêm/sửa/bypass compatibility logic (FR-004, FR-005); không session store/orchestrator ngoài chạy server process (FR-008); input malformed → structured error response, không crash process (FR-009); output deterministic (FR-007); phải discoverable/callable bởi bất kỳ MCP client chuẩn nào, không riêng OpenClaw (FR-006, FR-010)
**Scale/Scope**: 1 package mới (`packages/mcp-server/`), 3 tool, root `package.json` npm workspaces (mới tạo — chưa tồn tại), ~12-15 test (dispatch-level + protocol round-trip)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| # | Nguyên tắc (Constitution) | Trạng thái | Ghi chú |
|---|---|---|---|
| I | OpenClaw owns session/memory | N/A | Feature này không đụng OpenClaw runtime — server là process độc lập giao tiếp qua MCP, không session store riêng, không phụ thuộc OpenClaw. |
| II | Build Compiler = deterministic trust layer, pure functions, mỗi rule có unit test | PASS | Server chỉ dispatch; không thêm compatibility logic. Compiler (001) giữ nguyên pure/deterministic. Tool handler có unit test + protocol round-trip test. |
| III | Model = provider config, không thêm LangChain/LangGraph | PASS | Server không gọi model, không thêm orchestrator; chỉ MCP protocol framing + dispatch. |
| IV | WebChat = channel primary | N/A | Feature này không phải channel — là 1 protocol server độc lập, không thay đổi WebChat. |
| V | Docs tiếng Việt + English thuật ngữ, ADR format, không emoji | PASS | Plan docs theo convention. |

| Constraint | Trạng thái | Ghi chú |
|---|---|---|
| MVP = S1+S3, S3 KHÔNG cắt | PASS | 3 tool cover cả validate (S1/S3 detect) và repair (S3). |
| Quality Gate: `npm test` xanh trước demo | PASS by design | Plan output ~12-15 unit/protocol test standalone cho `packages/mcp-server`. |
| boundary-architect: server chỉ wrap+dispatch, package riêng | PASS | `packages/mcp-server/` tách biệt, chỉ import `@buildmate/compiler`, không trộn logic. |
| ADR-0003 §2.3 scope (OUT: catalog/search, add_to_build, guide_checkout, P2/P3/P4) | PASS | Explicit out-of-scope trong spec: `search_components`, `add_to_build`, `guide_checkout`, OpenClaw native plugin-SDK path (003) đều loại trừ. |

**Gate result (pre-Phase 0)**: PASS — không violation. Không cần Complexity Tracking.

### Post-Phase 1 re-check (sau khi design xong)

| # | Nguyên tắc | Re-check | Evidence |
|---|---|---|---|
| I | OpenClaw owns session/memory | N/A | `data-model.md` §4: server stateless, không session; không tương tác OpenClaw session layer. |
| II | Deterministic trust layer, pure, unit-testable | PASS | `contracts/mcp-tool-contracts.md`: mỗi tool handler = dispatch trực tiếp đến `compileBuild`/`detectErrors`/`repairBuild`, không transform logic. `research.md` §7: input validation (zod) chỉ kiểm tra shape, không đổi kết quả. |
| III | Model = provider config | PASS | `contracts` non-goals: không gọi LLM, không thêm orchestrator. |
| IV | WebChat primary | N/A | Không liên quan channel. |
| V | Docs tiếng Việt + English thuật ngữ | PASS | Tất cả artifact theo convention. |
| Quality Gate | `npm test` xanh | PASS by design | `quickstart.md` liệt kê test suites + protocol round-trip via `InMemoryTransport`. |
| boundary | Server = dispatch-only layer, package riêng | PASS | `data-model.md` §5: "No logic leakage — server does not interpret error codes, does not branch on compatibility results." |
| ADR-0003 scope | OUT: catalog, add_to_build, guide_checkout, OpenClaw plugin-SDK path | PASS | `contracts` §5 non-goals reiterates explicit exclusions. |

**Gate result (post-Phase 1)**: PASS — design không drift. Không violation cần Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/008-compiler-mcp-server/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── mcp-tool-contracts.md
├── checklists/
│   └── requirements.md  # from /speckit.specify
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
package.json                        # NEW: root workspaces config ["packages/*"] — first feature to introduce it
packages/
├── compiler/                       # 001-build-compiler-core (existing, unchanged)
│   └── ...
└── mcp-server/                     # 008-compiler-mcp-server (this feature)
    ├── package.json                # name: @buildmate/mcp-server, bin entry, deps: @modelcontextprotocol/sdk, zod, @buildmate/compiler (workspace)
    ├── tsconfig.json                # strict, target ES2023, module NodeNext
    ├── src/
    │   ├── index.ts                 # CLI entry: creates server via createServer(), connects StdioServerTransport, runs when invoked directly
    │   ├── server.ts                # createServer(): builds McpServer + registers all 3 tools (importable without stdio — used by tests)
    │   ├── schemas.ts                # zod schemas: BuildSchema, CompilerErrorSchema (input validation for tool args)
    │   └── tools/
    │       ├── compile-build.ts     # registers compile_build — dispatches to compileBuild
    │       ├── detect-errors.ts     # registers detect_errors — dispatches to detectErrors
    │       └── repair-build.ts      # registers repair_build — dispatches to repairBuild
    └── tests/
        ├── compile-build-tool.test.ts
        ├── detect-errors-tool.test.ts
        ├── repair-build-tool.test.ts
        ├── error-handling.test.ts        # malformed input → structured error, no crash
        └── protocol-roundtrip.test.ts    # InMemoryTransport Client<->Server: tool listing + invocation
```

**Structure Decision**: Package mới `packages/mcp-server/` sibling với `packages/compiler/`, theo đúng pattern boundary-architect đã dùng cho 001 (package riêng = ranh giới vật lý). Root `package.json` với npm workspaces được tạo lần đầu ở feature này (003 đã dự đoán trước điều này trong research §5 nhưng chưa implement) — cho phép `packages/mcp-server` reference `@buildmate/compiler` như local dependency mà không cần publish. Đây KHÔNG phải OpenClaw plugin package (`packages/openclaw-tools` của 003 vẫn là 1 package riêng biệt, chưa tồn tại, sẽ implement sau nếu cần).

## Complexity Tracking

> Không có Constitution violation → bảng trống, không ghi.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| — | — | — |
