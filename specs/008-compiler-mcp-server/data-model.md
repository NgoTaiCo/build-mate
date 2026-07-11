# Data Model: Compiler MCP Server

**Branch**: `008-compiler-mcp-server` | **Date**: 2026-07-11
**Source**: spec.md Key Entities + research.md §1-§9

## 1. No new domain entities

This feature introduces **no new domain data**. `Build`, `Component` (7 types), `CompilerError`, and `RepairPlan` are all already fully defined in `specs/001-build-compiler-core/data-model.md` and remain unchanged — this server only transports them over the MCP protocol. See that document for field-level detail.

## 2. MCP Tool binding (the only new "entity" this feature defines)

Trường | Kiểu | Mô tả
---|---|---
`name` | `"compile_build" \| "detect_errors" \| "repair_build"` | Tên tool ổn định, cố định theo spec FR-001/002/003.
`inputSchema` | zod raw shape | Schema validate tham số đầu vào — generated to JSON Schema automatically by the SDK for client discovery (FR-006).
`handler` | `(args) => CallToolResult \| Promise<CallToolResult>` | Dispatch trực tiếp đến function tương ứng trong `@buildmate/compiler`; không transform logic (FR-004, FR-005).

### 2.1 `compile_build`

Input | Output (on success)
---|---
`{ build: Build }` | `CallToolResult` whose JSON content is a `CompilerResult` (`{ errors, repair_plan, is_valid }`) — exactly what `compileBuild(build)` returns.

### 2.2 `detect_errors`

Input | Output (on success)
---|---
`{ build: Build }` | `CallToolResult` whose JSON content is `CompilerError[]` — exactly what `detectErrors(build)` returns.

### 2.3 `repair_build`

Input | Output (on success)
---|---
`{ build: Build, errors: CompilerError[] }` | `CallToolResult` whose JSON content is `RepairPlan[]` — exactly what `repairBuild(build, errors)` returns.

## 3. Error result shape (all 3 tools)

On malformed/structurally-invalid input (per research.md §7):

```typescript
{
  isError: true,
  content: [{ type: "text", text: string }] // human-readable description of the validation/structural failure
}
```

This is a `CallToolResult`, not a JSON-RPC protocol error — the calling client/agent sees it as a normal tool response with `isError: true`, per MCP convention.

## 4. Statelessness

The server holds **no mutable state** between calls: no session storage, no build cache, no conversation memory. Each tool invocation is a pure pass-through: parse input → call the corresponding `@buildmate/compiler` export → serialize output. This mirrors the Compiler's own statelessness (`001-build-compiler-core/data-model.md` §8) — the MCP layer adds a protocol binding on top, nothing more.

## 5. No logic leakage (boundary invariant)

- The server MUST NOT interpret `CompilerError.code` or `severity` to branch behavior (e.g., no special-casing `E001` vs `W001`).
- The server MUST NOT re-order, filter, deduplicate, or otherwise transform the arrays returned by the Compiler.
- The server MUST NOT add fields to `CompilerResult`/`CompilerError`/`RepairPlan` beyond what the Compiler itself produces.

Verified by the dispatch-level tests (research.md §5) asserting the tool's JSON content is byte-identical (`JSON.stringify` equal) to calling the Compiler function directly with the same input.
