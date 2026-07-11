# Research: Compiler MCP Server

**Branch**: `008-compiler-mcp-server` | **Date**: 2026-07-11
**Phase**: 0 — resolve technical unknowns before design

## Research Tasks

| # | Unknown / Choice | Resolved in § |
|---|---|---|
| R1 | Which MCP SDK/library to use | §1 |
| R2 | Transport mechanism | §2 |
| R3 | How `packages/mcp-server` references `@buildmate/compiler` locally | §3 |
| R4 | Tool input validation format | §4 |
| R5 | Testing approach for a protocol server (no real external client) | §5 |
| R6 | Package layout | §6 |
| R7 | Error handling shape inside tool handlers | §7 |
| R8 | Keeping Compiler pure while wrapping it | §8 |
| R9 | How the server binary is actually launched | §9 |

---

## §1. MCP SDK choice

**Decision**: `@modelcontextprotocol/sdk` (official TypeScript SDK, confirmed available at npm — latest `1.29.0` at research time). Use `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` and `registerTool` (the current, non-deprecated registration API — the older `tool(...)` overloads are marked `@deprecated` in favor of `registerTool` in this SDK version).

**Rationale**: This is the reference implementation of the protocol, actively maintained, and what any compliant MCP client (including a hypothetical OpenClaw MCP-client mode) would be built to interoperate with. Confirmed via local install + type inspection that `registerTool<InputArgs extends ZodRawShapeCompat>(name, config, callback)` exists and returns a `RegisteredTool`.

**Alternatives considered**:
- Hand-rolled JSON-RPC server implementing the MCP spec manually: reinvents a well-specified protocol; higher risk of subtle non-compliance (initialize handshake, capability negotiation, error shapes).
- Community/third-party MCP frameworks: less scrutinized than the official SDK; no reason to prefer over the reference implementation for a from-scratch server.

---

## §2. Transport mechanism

**Decision**: `StdioServerTransport` (from `@modelcontextprotocol/sdk/server/stdio.js`) — the server is a locally-spawned child process communicating over stdin/stdout using the MCP stdio framing.

**Rationale**: Matches the spec's documented Assumption ("Local process transport by default"). This is the standard shape for locally-run MCP servers (the pattern used by Claude Desktop, Claude Code, and most MCP clients when launching a server via a `command`/`args` config entry) — no network port, no auth surface, minimal operational complexity, fits the hackathon time-box.

**Alternatives considered**:
- `StreamableHTTPServerTransport` / SSE: needed only for a remotely-hosted, multi-client server; out of scope per spec Assumptions (no networked deployment required for this feature). Can be added later as a separate transport without touching tool logic, since tool registration is transport-agnostic in the SDK's design.

---

## §3. Local package reference (`@buildmate/compiler` as a dependency)

**Decision**: Introduce a root `package.json` with npm workspaces (`"workspaces": ["packages/*"]`) — the first feature to actually create it. `packages/mcp-server/package.json` depends on `"@buildmate/compiler": "*"`, resolved locally via the workspace instead of a published registry version.

**Rationale**: `specs/003-wire-openclaw-plugins/research.md` §4-§5 already anticipated this exact need ("root package.json workspaces created/updated now or assumed in place because wire-up is the integration point") but that feature hasn't been implemented yet. Since this feature is the first one that actually needs a sibling-package dependency, it is the natural place to introduce root workspaces. This keeps `packages/compiler` completely untouched (no changes to its `package.json` are required) and leaves the door open for `packages/catalog` and `packages/openclaw-tools` to join the same workspace later without re-plumbing.

**Alternatives considered**:
- `file:../compiler` specifier without workspaces: works, but doesn't hoist/dedupe `node_modules` and diverges from what 003 already planned; workspaces is the more conventional monorepo choice here.
- Publish `@buildmate/compiler` to a registry (even a private one): unnecessary operational overhead for a hackathon-scoped monorepo.

---

## §4. Tool input validation format

**Decision**: `zod` schemas in `src/schemas.ts`, passed into `registerTool`'s `inputSchema` config (the SDK's `registerTool` generic is constrained to `ZodRawShapeCompat`, i.e., a raw shape of zod validators — this is the SDK's expected format, not an arbitrary choice).

**Rationale**: `zod` is a required/expected dependency for this exact SDK API — `registerTool` types its `Args` generic against `ZodRawShapeCompat`. Using it directly (rather than hand-rolled runtime checks) gets automatic input parsing, descriptive validation errors, and JSON-schema generation for the tool's advertised `inputSchema` (needed for FR-006 discoverability) for free.

**Alternatives considered**:
- Manual type-guard functions: more code, no automatic JSON-schema generation for client-side discovery, higher chance of drift between validation and advertised schema.
- TypeBox (used in 003's plan for the OpenClaw plugin path): not what this SDK version expects; would require an extra adapter layer for no benefit here.

---

## §5. Testing approach

**Decision**: Two layers of tests:
1. **Dispatch-level unit tests** — import the tool's handler function directly (bypassing the protocol entirely) and assert it calls through to `@buildmate/compiler` and shapes the `CallToolResult` correctly for both success and malformed-input cases.
2. **Protocol round-trip test** — use the SDK's `InMemoryTransport` (from `@modelcontextprotocol/sdk/dist/esm/inMemory.js`, confirmed present in the installed package) to create a linked pair of transports, connect a real `Client` to the real `McpServer` in the same process, and verify: (a) `listTools()` returns all 3 tools with schemas, (b) `callTool()` for each tool returns the expected result — proving genuine MCP-protocol compliance (FR-006, FR-010) without spawning a subprocess or needing a real external client.

**Rationale**: `node:test` + `node:assert/strict` matches the convention already established in `001-build-compiler-core`. `InMemoryTransport` is the SDK's own supported mechanism for testing a server without process boundaries — confirmed present in the installed SDK — so protocol compliance can be verified deterministically and fast, satisfying FR-010 ("independently testable by any generic MCP client") using the reference client implementation itself as that generic client.

**Alternatives considered**:
- Spawning the real stdio subprocess in tests: slower, more flaky (process lifecycle management), unnecessary since `InMemoryTransport` exercises the same client/server protocol code paths.
- Only dispatch-level tests, no protocol test: would leave FR-006/FR-010 (discoverability, generic-client compatibility) unverified.

---

## §6. Package layout

**Decision**: New package `packages/mcp-server/` (name `@buildmate/mcp-server`), sibling to `packages/compiler/`, following the same "package = physical boundary" pattern established in 001 and planned in 003.

**Rationale**: Constitution boundary-architect guidance: each layer (Compiler = trust layer, tool-plugin/protocol-server = dispatch layer) gets its own package so logic cannot leak between them by accident. Keeps `packages/compiler` publishable/reusable independent of any one integration path (MCP here, OpenClaw native plugin in 003).

**Alternatives considered**:
- Add MCP server code inside `packages/compiler`: would blur the "pure library, zero integration dependencies" boundary that 001 explicitly established (zero OpenClaw/MCP/runtime dependency was a core constraint of that feature).

---

## §7. Error handling shape inside tool handlers

**Decision**: Tool handlers never `throw` for domain-level problems (malformed build, mismatched errors/build in `repair_build`). They catch/detect these cases and return a `CallToolResult` with `isError: true` and a structured text/JSON content payload describing the problem. Handlers only let genuinely unexpected exceptions propagate (which the SDK itself converts into a protocol-level error response).

**Rationale**: This matches the MCP specification's own convention: tool execution errors are reported *within* the tool result (`isError: true`) so the calling model/agent can see and reason about them, while JSON-RPC-level errors are reserved for protocol violations (unknown tool name, malformed request envelope) — which the SDK already handles before a handler is even invoked. `@buildmate/compiler`'s own contract (`contracts/compiler-api.md` §1 in 001) already distinguishes "structurally invalid build (throws — caller bug)" from "malformed component data (returns `E006`/skip)" — the MCP layer preserves that distinction: a thrown structural error from the Compiler is caught and surfaced as `isError: true` with the message, never as a raw process crash.

**Alternatives considered**:
- Letting Compiler's structural-invalid-input throws propagate uncaught: would crash the server process on a single bad call, violating FR-009.
- Always returning `isError: false` with an error code embedded in the content: breaks the standard MCP client expectation that `isError` reflects execution failure.

---

## §8. Keeping Compiler pure while wrapping it

**Decision**: Each tool handler is a thin function: validate input shape (zod) → call the corresponding `@buildmate/compiler` export (`compileBuild`/`detectErrors`/`repairBuild`) with the parsed arguments, unchanged → serialize the returned value as the tool's JSON content → return. No branching on error codes, no re-ordering, no additional fields injected.

**Rationale**: Directly satisfies FR-004/FR-005 and mirrors the same "wrap+dispatch, no logic" boundary rule `003-wire-openclaw-plugins/research.md` §8 already established for the OpenClaw native-plugin path — this feature applies the identical discipline to the MCP path.

**Alternatives considered**: None — this is a hard constitutional constraint (Principle II), not a tradeoff.

---

## §9. How the server binary is launched

**Decision**: `packages/mcp-server/package.json` declares a `bin` entry (`buildmate-mcp-server`) pointing at the built `dist/index.js`. `src/index.ts` is the thin CLI entry point: it calls `createServer()` (from `server.ts`) and connects it to a `StdioServerTransport`, then the process stays alive reading stdin until the client disconnects. During development, `npx tsx src/index.ts` runs it directly without a build step; for real MCP-client configuration (e.g., an `mcpServers` config block), the documented command is `node dist/index.js` after `npm run build`.

**Rationale**: Matches how essentially every local MCP server is configured by clients (a `command` + `args` pair that starts a long-lived stdio process) and keeps `server.ts` (the testable factory) separate from `index.ts` (the process-lifecycle glue), so tests never need to spawn a real process.

**Alternatives considered**:
- Only a dev script, no `bin`/build path: would make it harder for an external MCP client config to reference a stable launch command.

## Phase 0 Summary

All 9 unknowns resolved. No NEEDS CLARIFICATION remain. Decisions feed into:
- `data-model.md`: confirms no new data entities beyond what 001 already defines; documents the MCP Tool binding shape.
- `contracts/mcp-tool-contracts.md`: 3 tool contracts (name, input schema, output schema, error shape) per §1, §4, §7.
- `quickstart.md`: run + connect + verify flow per §2, §5, §9.
- `tasks.md` (next phase): root workspaces setup (§3), package scaffold (§6), tool implementations (§7, §8), dispatch + protocol tests (§5).
