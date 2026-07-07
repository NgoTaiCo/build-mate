# Feature Specification: Wire Compiler and Catalog as OpenClaw Tool Plugins

**Feature Branch**: `003-wire-openclaw-plugins`  
**Created**: 2026-07-07  
**Status**: Draft  
**Input**: User description: "Wire Compiler + Catalog as OpenClaw tool plugins via api.registerTool: compile_build(build), detect_errors(build), repair_build(build, errors), search_components(criteria). Install via openclaw plugins install --link, restart gateway, verify --runtime that all 4 tools dispatch correctly. Compiler stays pure (plugin only wraps+dispatches, no logic). No SessionStore, no external orchestrator. Out-of-scope: add_to_build (DOM exec feature), guide_checkout."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Agent Validates a Build via the Compiler Tool (Priority: P1)

A customer describes or submits a PC build to the BuildMate assistant. The assistant delegates compatibility validation to the deterministic Compiler tool and returns a clear result: either the build is compatible, or a list of specific errors (e.g., socket mismatch, RAM generation mismatch) with stable error codes.

**Why this priority**: This is the core trust moment in BuildMate — the assistant must never guess compatibility. Wiring the Compiler as a callable tool means the agent can invoke the deterministic trust layer during a live conversation, which is required for both the S1 (advise) and S3 (repair) demo scenes (ADR-0003 §2.1).

**Independent Test**: Can be fully tested by asking the agent to validate a known-bad build (CPU socket LGA1700 + mainboard socket AM5) and verifying the response references `E001 SOCKET_MISMATCH` rather than a vague explanation.

**Acceptance Scenarios**:

1. **Given** a build with CPU socket LGA1700 and mainboard socket AM5, **When** the agent validates the build, **Then** the response includes `E001 SOCKET_MISMATCH` from the Compiler tool.
2. **Given** a fully compatible build, **When** the agent validates the build, **Then** the response reports zero errors.
3. **Given** a build with multiple issues, **When** the agent validates the build, **Then** the response lists all detected errors, not just the first one.

---

### User Story 2 - Agent Repairs a Build via the Repair Tool (Priority: P1)

A customer has a build with compatibility errors. The assistant invokes the repair tool, receives concrete fix suggestions (e.g., change CPU socket to AM5, or upgrade PSU wattage), and presents them to the customer in plain language.

**Why this priority**: Repair is BuildMate's differentiator (ADR-0003 §2.4: "S3 KHÔNG cắt"). Making `repair_build` callable through the plugin lets the agent turn a detected error into actionable guidance without inventing fixes.

**Independent Test**: Can be fully tested by asking the agent to repair the same known-bad build from Story 1 and verifying the response includes at least one concrete fix that, if applied, resolves `E001`.

**Acceptance Scenarios**:

1. **Given** a build with `E001 SOCKET_MISMATCH`, **When** the agent requests a repair plan, **Then** the response includes a concrete fix specifying the target socket value.
2. **Given** a build with multiple errors, **When** the agent requests a repair plan, **Then** the response includes at least one fix for each error.
3. **Given** a repair plan, **When** the suggested fixes are applied to the build and the build is re-validated, **Then** the original errors disappear.

---

### User Story 3 - Agent Searches Components via the Catalog Tool (Priority: P1)

A customer asks for compatible parts within a budget (e.g., "AM5 CPUs under 6 million VND"). The assistant invokes the catalog search tool, which returns matching components with price, stock status, and compatibility fields. The assistant then presents options or feeds them into the Compiler.

**Why this priority**: Search is the data feed for both advice and repair. Without it, the agent cannot recommend real, purchasable parts or verify that a replacement part resolves an error.

**Independent Test**: Can be fully tested by asking the agent for "AM5 CPUs in stock under 6 million VND" and verifying every returned component matches all three conditions.

**Acceptance Scenarios**:

1. **Given** a request for AM5 CPUs under 6 million VND, **When** the agent searches the catalog, **Then** all returned components have socket AM5, price ≤ 6,000,000 VND, and stock status in_stock.
2. **Given** a request with no matching components, **When** the agent searches the catalog, **Then** the response clearly states that no parts match instead of inventing results.
3. **Given** a multi-criteria request, **When** the agent searches the catalog, **Then** all criteria are applied together (AND logic) before any result is shown.

---

### User Story 4 - Plugin Loads Correctly After Gateway Restart (Priority: P2)

After the plugin is installed and the gateway is restarted, all four tools (compile, detect errors, repair, search) are discoverable by the agent and respond correctly when invoked.

**Why this priority**: This is the operational proof that the wiring works. A tool that exists in code but is not registered at runtime cannot be used by the assistant, so runtime discovery is a gating requirement for the demo.

**Independent Test**: Can be fully tested by restarting the gateway and sending one representative invocation per tool, then confirming each returns the expected result type.

**Acceptance Scenarios**:

1. **Given** the plugin is installed and the gateway has been restarted, **When** the agent invokes `compile_build` with a valid build, **Then** a compilation result is returned.
2. **Given** the same restarted gateway, **When** the agent invokes `detect_errors`, `repair_build`, and `search_components` in any order, **Then** each returns the expected result without errors.
3. **Given** the gateway is running with the plugin loaded, **When** the same deterministic input is sent twice to any tool, **Then** both responses are identical.

---

### Edge Cases

- What happens when a tool is invoked with a malformed build or missing required fields? → The plugin delegates to the Compiler/Catalog, which returns a structured error rather than crashing.
- What happens when the gateway restarts but the plugin fails to load? → The missing tools are not available; the agent cannot perform build validation/repair/search until the plugin is loaded successfully.
- What happens when multiple customers or multiple turns invoke the same tool concurrently? → Each invocation is independent; deterministic inputs produce deterministic outputs regardless of ordering.
- What happens when a repair plan references a component attribute that the catalog cannot satisfy? → The agent communicates the constraint (e.g., "needs a PSU ≥ 750W") and lets the customer or catalog search resolve the specific SKU.
- What happens when a search returns zero results? → The agent reports "no matching parts" and may suggest relaxing one criterion (e.g., increase budget), but does not fabricate components.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST expose `compile_build` as a callable tool that accepts a build and returns a compilation result containing compatibility status, errors, and any warnings.
- **FR-002**: The system MUST expose `detect_errors` as a callable tool that accepts a build and returns the list of compatibility errors and warnings detected by the Compiler.
- **FR-003**: The system MUST expose `repair_build` as a callable tool that accepts a build and a list of errors and returns a concrete repair plan.
- **FR-004**: The system MUST expose `search_components` as a callable tool that accepts search criteria and returns a list of matching catalog components.
- **FR-005**: The plugin layer MUST only wrap and dispatch calls to the existing Compiler and Catalog logic; it MUST NOT add, modify, or bypass compatibility logic.
- **FR-006**: The Compiler MUST remain a pure, deterministic trust layer: the plugin MUST NOT introduce state, randomness, or conditional logic that changes compilation or repair outcomes.
- **FR-007**: The plugin MUST install into the OpenClaw gateway such that the four tools are discoverable by the agent after the gateway restarts.
- **FR-008**: All four tools MUST dispatch correctly at runtime: each tool accepts its defined input and returns the expected output structure.
- **FR-009**: The system MUST NOT introduce a separate session store, orchestrator, or stateful backend outside OpenClaw's native session and memory layer.
- **FR-010**: Tool outputs MUST be deterministic whenever the underlying Compiler or Catalog function is deterministic — identical inputs produce identical outputs across repeated calls.
- **FR-011**: The system MUST route build-validation and repair decisions through the Compiler tool rather than allowing the assistant model to guess compatibility.

### Key Entities _(include if feature involves data)_

- **Tool Plugin**: The integration layer that registers the Compiler and Catalog functions as callable tools inside the OpenClaw agent gateway. Its only responsibility is dispatching inputs to the correct underlying function and returning the result unchanged.
- **Build**: A customer PC configuration containing components. Already defined in feature `001-build-compiler-core`.
- **Component**: A catalog part with type-specific attributes (socket, RAM generation, wattage, etc.). Already defined in feature `002-mock-catalog-adapter`.
- **Error**: A structured compatibility issue with a stable code (e.g., `E001 SOCKET_MISMATCH`). Already defined in feature `001-build-compiler-core`.
- **RepairPlan**: A set of concrete fixes produced by the Compiler for a given list of errors. Already defined in feature `001-build-compiler-core`.
- **SearchCriteria**: The filter parameters accepted by the catalog search tool (type, socket, RAM generation, price range, stock status, etc.). Already defined in feature `002-mock-catalog-adapter`.

### Out of Scope (Explicit)

- `add_to_build` and other DOM execution features — deferred to a separate feature involving browser automation or the Chrome extension bridge.
- `guide_checkout` — deferred to a separate checkout-guidance feature.
- Modifying Compiler compatibility rules or Catalog data sources — those features are owned by `001-build-compiler-core` and `002-mock-catalog-adapter` respectively.
- Building a custom session store, orchestrator, or gateway replacement — OpenClaw owns session and routing per ADR-0001.
- Authentication, authorization, or multi-tenant isolation beyond what OpenClaw provides natively.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of the four tools (`compile_build`, `detect_errors`, `repair_build`, `search_components`) are successfully invoked from the agent at runtime and return the expected result type.
- **SC-002**: Every build-validation response is produced by the Compiler tool, not inferred by the assistant — verified by testing that incompatible builds always return the deterministic error codes defined in `001-build-compiler-core`.
- **SC-003**: Repeated calls to any deterministic tool with the same input return identical outputs 100% of the time.
- **SC-004**: After a gateway restart, all four tools are discoverable and respond correctly within one minute of the gateway becoming ready.
- **SC-005**: 100% of tested multi-tool conversation flows (search → compile → detect → repair) complete end-to-end without requiring a separate orchestrator or session store.
- **SC-006**: No customer receives a build recommendation that bypasses the Compiler compatibility check — every recommended build passes through `compile_build` or `detect_errors`.

## Assumptions

- **OpenClaw gateway is the runtime environment**: the plugin is installed into an existing OpenClaw gateway that already owns sessions, memory, and agent routing (ADR-0001 §3).
- **Compiler and Catalog packages already exist**: this feature only wires the outputs of `001-build-compiler-core` and `002-mock-catalog-adapter`; it does not redefine compatibility rules or catalog schema.
- **Tool names are stable**: the four tools are exposed under the names `compile_build`, `detect_errors`, `repair_build`, and `search_components` so the agent can reference them consistently.
- **Gateway restart is the standard activation path**: after installation, the gateway is restarted to load the plugin and make the tools available to the agent.
- **Runtime verification is manual/demo-oriented for the hackathon**: a single end-to-end pass of all four tools after restart is sufficient for MVP; automated plugin tests are a stretch improvement.
- **No additional state persistence is required**: the plugin remains stateless; any conversation state lives in OpenClaw's native session layer.
