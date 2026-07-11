# Contract: Compiler MCP Server Tools

**Branch**: `008-compiler-mcp-server` | **Date**: 2026-07-11
**Project type**: MCP server (protocol tools, not REST endpoints) — contract = tool name + input/output schema + error shape.
**Consumers**: Any MCP-compatible client (generic MCP inspector, OpenClaw if/when it gains MCP-client support, or any other agent runtime). Test suite connects via the SDK's `Client` over `InMemoryTransport`.

## Server identity

- **Name**: `buildmate-compiler` (server `name` in the MCP `initialize` response)
- **Transport**: stdio (see research.md §2)
- **Tools exposed**: exactly 3 — `compile_build`, `detect_errors`, `repair_build`

---

## 1. `compile_build`

**Purpose**: Validate a build and get a repair plan in a single call. Equivalent to calling `compileBuild(build)` directly on `@buildmate/compiler`.

**Input schema**:
```typescript
{ build: Build }   // Build as defined in 001-build-compiler-core/data-model.md §1
```

**Output** (`CallToolResult`, success case):
```json
{
  "content": [{ "type": "text", "text": "<JSON-serialized CompilerResult>" }],
  "isError": false
}
```
Where the serialized `CompilerResult` is exactly `{ errors, repair_plan, is_valid }` per `001-build-compiler-core/data-model.md` §5 — byte-identical to calling `compileBuild(build)` directly.

**Contract**:
- Deterministic: same `build` → same output across repeated calls (FR-007).
- Does not throw on malformed component data (delegates to Compiler's own `E006`/skip behavior).
- Returns `isError: true` (not a process crash) only when `build` itself is structurally invalid (not an object, or `components` not an array) — matching `001-build-compiler-core/contracts/compiler-api.md` §1's own throw/no-throw boundary, translated into the MCP error shape.

---

## 2. `detect_errors`

**Purpose**: Validate only, no repair plan. Equivalent to `detectErrors(build)`.

**Input schema**:
```typescript
{ build: Build }
```

**Output** (success case): JSON-serialized `CompilerError[]` — empty array if the build is fully compatible.

**Contract**: Same determinism/error-handling guarantees as §1. Content is exactly `detectErrors(build)`'s return value, unchanged.

---

## 3. `repair_build`

**Purpose**: Get concrete, constraint-based fixes for a set of already-detected errors. Equivalent to `repairBuild(build, errors)`.

**Input schema**:
```typescript
{ build: Build, errors: CompilerError[] }   // CompilerError as defined in 001-build-compiler-core/data-model.md §3
```

**Output** (success case): JSON-serialized `RepairPlan[]`, 1:1 with the given `errors` (per `001-build-compiler-core/contracts/compiler-api.md` §3).

**Contract**:
- `repair_plan.length === errors.length`.
- Each `Fix` contains constraint-based `target_value`s (string/number/string[]), never a SKU.
- `errors` empty → returns `[]`.
- Deterministic.

---

## 4. Discoverability contract (cross-cutting, FR-006/FR-010)

Any MCP client calling the protocol's standard `tools/list` request MUST receive all 3 tools with:
- `name` (stable, matches §1-§3 above)
- `description` (human-readable, states what the tool does and which Compiler function it wraps)
- `inputSchema` (JSON Schema auto-generated from the zod shape registered via `registerTool`)

No client-specific configuration or custom integration code is required to discover or call any tool — verified by the protocol round-trip test using the SDK's own reference `Client` (research.md §5).

## 5. Non-goals (out of contract)

- KHÔNG expose `search_components` hay bất kỳ catalog tool nào (packages/catalog chưa tồn tại).
- KHÔNG expose `add_to_build`, `guide_checkout`.
- KHÔNG dùng OpenClaw's native tool-plugin SDK (`definePluginEntry`/`api.registerTool`) — đó là con đường riêng của `003-wire-openclaw-plugins`. Server này CHỈ nói MCP protocol.
- KHÔNG persist build/result nào giữa các call (stateless, FR-008).
- KHÔNG gọi LLM, không thêm compatibility logic ngoài Compiler (FR-004, FR-005).
- KHÔNG networked transport (HTTP/SSE) trong scope feature này (research.md §2) — chỉ stdio.
