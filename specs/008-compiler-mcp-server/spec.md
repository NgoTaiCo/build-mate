# Feature Specification: Compiler MCP Server

**Feature Branch**: `008-compiler-mcp-server`
**Created**: 2026-07-11
**Status**: Draft
**Input**: User description: "Host the Build Compiler as a standalone MCP (Model Context Protocol) server so OpenClaw (or any other MCP-compatible client) can connect to it and call compile_build(build), detect_errors(build), and repair_build(build, errors) as MCP tools. The MCP server wraps and dispatches to the existing @buildmate/compiler package (001-build-compiler-core) — it must not add, modify, or bypass compatibility logic, matching the same purity/determinism constraints as the compiler itself. Out of scope: search_components / catalog tools (packages/catalog does not exist yet — 002-mock-catalog-adapter is unimplemented), add_to_build, guide_checkout, and OpenClaw's native tool-plugin SDK path (that is a separate already-planned feature, 003-wire-openclaw-plugins). This feature is specifically about exposing the compiler via the MCP protocol as an independent server process."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - MCP Client Validates a Build (Priority: P1)

An MCP-compatible client (OpenClaw or any other agent runtime) connects to the Compiler MCP server and calls the `compile_build` tool with a customer's PC build. The server dispatches to the existing deterministic Compiler and returns compatibility status, all detected errors/warnings, and a repair plan in one response.

**Why this priority**: This is the primary reason the server exists — an MCP client cannot reach the deterministic trust layer at all without this tool being exposed and callable over the protocol.

**Independent Test**: Start the server, connect any generic MCP client (e.g., an MCP inspector tool), call `compile_build` with a known-bad build (CPU socket LGA1700 + mainboard socket AM5), and confirm the response includes `E001 SOCKET_MISMATCH` — without writing any client-specific integration code.

**Acceptance Scenarios**:

1. **Given** the server is running and a client is connected, **When** the client calls `compile_build` with a build containing a socket mismatch, **Then** the response includes `E001 SOCKET_MISMATCH` and `is_valid: false`.
2. **Given** the server is running, **When** the client calls `compile_build` with a fully compatible build, **Then** the response reports zero errors and `is_valid: true`.
3. **Given** the server is running, **When** the client calls `compile_build` with a build containing multiple issues, **Then** the response lists every detected error, not just the first one.

---

### User Story 2 - MCP Client Detects Then Repairs a Build (Priority: P1)

An MCP client first calls `detect_errors` to get the list of compatibility problems for a build, then calls `repair_build` with that same build and error list to get concrete, constraint-based fixes for each problem.

**Why this priority**: Two-phase detect-then-repair is BuildMate's core interaction pattern (detect → display to customer → repair on request); both tools must work together as a single deterministic pipeline reachable over MCP.

**Independent Test**: Call `detect_errors` on a build with a known error, feed the returned errors into `repair_build` for the same build, and confirm the response includes at least one concrete fix per error that, when applied, resolves it.

**Acceptance Scenarios**:

1. **Given** a build with `E001 SOCKET_MISMATCH`, **When** the client calls `detect_errors` then `repair_build` with the returned errors, **Then** the response includes a concrete fix specifying the target socket value.
2. **Given** a build with multiple errors, **When** the client calls `repair_build` with all detected errors, **Then** the response includes at least one fix for every error (1:1 mapping).
3. **Given** a repair plan returned by `repair_build`, **When** the suggested fix is applied to the build and `detect_errors` is called again, **Then** the original error no longer appears.

---

### User Story 3 - Any Standard MCP Client Discovers the Tools Automatically (Priority: P2)

A developer or agent runtime connects to the server for the first time and, using only the standard MCP tool-discovery capability (no custom integration code), sees `compile_build`, `detect_errors`, and `repair_build` listed with their input/output shapes.

**Why this priority**: Discoverability via the protocol's own capability negotiation is what makes this a genuine MCP server rather than a bespoke API — it's the operational proof that any compliant client (not just OpenClaw) can use it.

**Independent Test**: Connect a generic MCP client to a freshly started server and confirm all three tools appear in the tool list with usable descriptions and schemas, before making any tool call.

**Acceptance Scenarios**:

1. **Given** a freshly started server, **When** a client requests the tool list, **Then** all three tools (`compile_build`, `detect_errors`, `repair_build`) are listed with their input schemas.
2. **Given** the tool list has been retrieved, **When** the client calls any listed tool with input matching its advertised schema, **Then** the call succeeds without a schema-mismatch error.
3. **Given** the server has just restarted, **When** a client reconnects, **Then** the same three tools are discoverable again without additional configuration.

---

### Edge Cases

- What happens when a tool is called with a malformed build or missing required fields? → The server returns a structured error response (matching the Compiler's own `E006 MISSING_ATTRIBUTE` / structural-error behavior) rather than crashing the process.
- What happens when `repair_build` is called with an errors list that doesn't match the given build (e.g., referencing a component that no longer exists)? → The server returns a structured error indicating the mismatch rather than guessing or fabricating a fix.
- What happens when the server process restarts mid-session? → The client reconnects and rediscovers the tools; no in-flight state is expected to survive, since the Compiler and this server are both stateless.
- What happens when multiple clients or multiple concurrent calls invoke the same tool at once? → Each call is independent; deterministic inputs produce deterministic outputs regardless of call ordering or concurrency.
- What happens when a client calls a tool name that doesn't exist? → The server returns the protocol's standard "unknown tool" error rather than a silent no-op.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST expose `compile_build` as an MCP tool that accepts a build and returns a compilation result containing compatibility status, errors, warnings, and a repair plan.
- **FR-002**: The system MUST expose `detect_errors` as an MCP tool that accepts a build and returns the list of compatibility errors and warnings, without a repair plan.
- **FR-003**: The system MUST expose `repair_build` as an MCP tool that accepts a build and a list of errors and returns a concrete, constraint-based repair plan (1:1 with the given errors).
- **FR-004**: The MCP server layer MUST only wrap and dispatch calls to the existing `@buildmate/compiler` package; it MUST NOT add, modify, or bypass compatibility logic.
- **FR-005**: The underlying Compiler MUST remain a pure, deterministic trust layer: the server MUST NOT introduce state, randomness, or conditional logic that changes compilation or repair outcomes.
- **FR-006**: All three tools MUST be discoverable by any standard MCP client via the protocol's own tool-listing/capability-negotiation mechanism, without client-specific integration code.
- **FR-007**: Tool outputs MUST be deterministic — identical inputs produce identical outputs across repeated calls, regardless of timing or call order.
- **FR-008**: The system MUST NOT introduce a separate session store, orchestrator, or stateful backend beyond what is required to run the server process itself.
- **FR-009**: Malformed or structurally invalid tool input MUST produce a structured error response rather than crashing the server process.
- **FR-010**: The server MUST be independently testable and usable by any generic MCP client, not exclusively by OpenClaw — verified by connecting a non-OpenClaw MCP client and successfully invoking all three tools.
- **FR-011**: The system MUST NOT expose catalog/search functionality, build-application side effects (`add_to_build`), or checkout guidance (`guide_checkout`) — those remain out of scope for this feature.

### Key Entities _(include if feature involves data)_

- **MCP Tool**: A named capability exposed over the MCP protocol (name, input schema, output schema, handler). Its only responsibility here is dispatching to the corresponding Compiler function and returning the result unchanged.
- **Build**: A customer PC configuration containing components. Already defined in feature `001-build-compiler-core`.
- **CompilerError**: A structured compatibility issue with a stable code (e.g., `E001 SOCKET_MISMATCH`). Already defined in feature `001-build-compiler-core`.
- **RepairPlan**: A set of concrete, constraint-based fixes produced by the Compiler for a given list of errors. Already defined in feature `001-build-compiler-core`.

### Out of Scope (Explicit)

- `search_components` / catalog tools — `packages/catalog` does not exist yet (`002-mock-catalog-adapter` is unimplemented).
- `add_to_build` and other DOM-execution or side-effecting features.
- `guide_checkout`.
- OpenClaw's native tool-plugin SDK integration path (`definePluginEntry` / `api.registerTool`) — that is the separate, already-planned `003-wire-openclaw-plugins` feature. This feature is exclusively about the MCP protocol path.
- Modifying Compiler compatibility rules — owned by `001-build-compiler-core`.
- Authentication, authorization, or multi-tenant isolation beyond what a locally-run MCP server needs by default.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of the three tools (`compile_build`, `detect_errors`, `repair_build`) are discoverable and successfully invoked by a generic MCP client without custom integration code.
- **SC-002**: Every response returned by the server matches the equivalent direct call to `@buildmate/compiler` byte-for-byte, for 100% of representative test builds — confirming the server introduces no logic drift.
- **SC-003**: Repeated calls to any tool with the same input return identical output 100% of the time.
- **SC-004**: 100% of malformed or structurally invalid inputs are handled with a structured error response instead of a process crash, verified across representative edge cases.
- **SC-005**: A developer can start the server and successfully invoke all three tools from a generic MCP client within one minute, with no manual client-side schema authoring required.

## Assumptions

- **MCP protocol compliance is the target, not any specific client**: the server is built to the standard MCP tool-server shape so that OpenClaw or any other compliant client can connect; no OpenClaw-specific behavior is assumed.
- **Local process transport by default**: the server runs as a locally-spawned process communicating over the MCP protocol's standard local transport; remote/networked transport is not required for this feature.
- **No authentication required by default**: consistent with a locally-run, single-trust-boundary developer/agent tool server; this can be revisited if a networked deployment is needed later.
- **Compiler and its guarantees already exist**: this feature only exposes the outputs of `001-build-compiler-core` over a new protocol; it does not redefine compatibility rules, error codes, or repair semantics.
- **Statelessness carries over from the Compiler**: since `@buildmate/compiler` is pure and stateless, the server itself holds no session or build state between calls.
