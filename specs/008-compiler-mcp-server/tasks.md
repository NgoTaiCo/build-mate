---
description: "Task list for Compiler MCP Server (008-compiler-mcp-server)"
---

# Tasks: Compiler MCP Server

**Input**: Design documents from `/specs/008-compiler-mcp-server/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mcp-tool-contracts.md, quickstart.md

**Tests**: Included — plan.md's Project Structure and quickstart.md's Quality Gate (`npm test` green) explicitly designate the 5 test files (`compile-build-tool.test.ts`, `detect-errors-tool.test.ts`, `repair-build-tool.test.ts`, `error-handling.test.ts`, `protocol-roundtrip.test.ts`) as required deliverables, not optional extras.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact, relative to repo root

## Path Conventions

Single package project. All new files live under `packages/mcp-server/`, plus one new root file (`package.json`), per plan.md's Project Structure section. `packages/compiler/` (001) is referenced as a workspace dependency and is not modified.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Introduce root npm workspaces and scaffold the new `@buildmate/mcp-server` package (neither exists yet — this is the first feature to create a root `package.json`, per research.md §3).

- [X] T001 Create root `package.json` at repo root with `"workspaces": ["packages/*"]`, `"private": true`, and a root `test`/`typecheck` script that delegates to `npm test --workspaces --if-present` / `npm run typecheck --workspaces --if-present` (does not modify `packages/compiler/package.json`)
- [X] T002 [P] Create `packages/mcp-server/package.json`: `name: "@buildmate/mcp-server"`, `type: "module"`, `bin: { "buildmate-mcp-server": "dist/index.js" }`, dependencies `@modelcontextprotocol/sdk` (^1.29.0), `zod` (^3.x), `@buildmate/compiler` (`*`, resolved via workspace per research.md §3), devDependencies `typescript` (^5.7.0), `tsx` (^4.19.0), `@types/node` (^22.10.0), scripts `test` (`node --import tsx --test tests/*.test.ts`, matching `packages/compiler`'s convention), `typecheck` (`tsc --noEmit`), `build` (`tsc`)
- [X] T003 [P] Create `packages/mcp-server/tsconfig.json` matching `packages/compiler/tsconfig.json` (target ES2023, module/moduleResolution NodeNext, strict, declaration, outDir dist, rootDir src)
- [X] T004 Run `npm install` at repo root to link the new workspaces (`packages/compiler`, `packages/mcp-server`) and install `@modelcontextprotocol/sdk`/`zod` (depends on T001, T002, T003)

**Checkpoint**: Workspaces resolve; `packages/mcp-server` can `import` from `@buildmate/compiler`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared schema/server/entry-point scaffolding that every tool and every test depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Create zod input schemas in `packages/mcp-server/src/schemas.ts`: `BuildSchema` (mirrors `Build`/`Component` from `@buildmate/compiler`'s `types.ts` — `components: array of objects with at least `type: string`, `id: string`, plus known optional attrs per component type) and `CompilerErrorSchema` (mirrors `CompilerError`: `code`, `severity`, `name`, `message`, `component_refs`, optional `details`) — shapes only, no re-validation of Compiler's own domain rules
- [X] T006 Create server factory in `packages/mcp-server/src/server.ts`: `export function createServer()` builds and returns an `McpServer` instance (`name: "buildmate-compiler"`) with no tools registered yet — tool registration is added by each user story below (depends on T005)
- [X] T007 Create CLI entry point in `packages/mcp-server/src/index.ts`: imports `createServer` from `./server.js`, connects the returned server to a `StdioServerTransport` (from `@modelcontextprotocol/sdk/server/stdio.js`), and keeps the process alive on stdin per research.md §9 (depends on T006)

**Checkpoint**: Foundation ready — `createServer()` is importable by tests without needing stdio, and `index.ts` provides the process entry point. User story implementation can now begin.

---

## Phase 3: User Story 1 - MCP Client Validates a Build (Priority: P1) 🎯 MVP

**Goal**: Expose `compile_build` as an MCP tool that dispatches to `compileBuild()` and returns a byte-identical `CompilerResult`.

**Independent Test**: Start the server, connect a generic MCP client, call `compile_build` with a build containing an LGA1700 CPU + AM5 mainboard, and confirm the response includes `E001 SOCKET_MISMATCH` and `is_valid: false`.

### Tests for User Story 1

- [X] T008 [P] [US1] Dispatch-level test in `packages/mcp-server/tests/compile-build-tool.test.ts`: import the `compile_build` handler directly and assert its `CallToolResult` JSON content is byte-identical (`JSON.stringify` equal) to calling `compileBuild(build)` directly, for (a) a socket-mismatch build (`E001`, `is_valid: false`), (b) a fully compatible build (zero errors, `is_valid: true`), (c) a build with multiple issues (all errors present, not just the first)

### Implementation for User Story 1

- [X] T009 [US1] Implement `packages/mcp-server/src/tools/compile-build.ts`: export a function that registers `compile_build` on a given `McpServer` via `registerTool` — input `{ build: BuildSchema }`, handler parses input, calls `compileBuild(build)` from `@buildmate/compiler`, serializes the result as `{ content: [{ type: "text", text: JSON.stringify(result) }], isError: false }`; on structurally invalid `build` (not an object / `components` not an array), catches and returns `{ isError: true, content: [{ type: "text", text: <message> }] }` instead of throwing (per research.md §7)
- [X] T010 [US1] Register the `compile_build` tool onto the server in `packages/mcp-server/src/server.ts` by calling the registration function from `tools/compile-build.ts` inside `createServer()` (depends on T009)

**Checkpoint**: User Story 1 is fully functional and testable independently — `compile_build` is callable and dispatch-verified.

---

## Phase 4: User Story 2 - MCP Client Detects Then Repairs a Build (Priority: P1)

**Goal**: Expose `detect_errors` and `repair_build` so a client can run the detect → repair pipeline over MCP.

**Independent Test**: Call `detect_errors` on a build with a known error, feed the returned errors into `repair_build` for the same build, and confirm the response includes at least one concrete, constraint-based fix per error.

### Tests for User Story 2

- [X] T011 [P] [US2] Dispatch-level test in `packages/mcp-server/tests/detect-errors-tool.test.ts`: import the `detect_errors` handler directly and assert its `CallToolResult` JSON content is byte-identical to calling `detectErrors(build)` directly, including the empty-array case for a fully compatible build
- [X] T012 [P] [US2] Dispatch-level test in `packages/mcp-server/tests/repair-build-tool.test.ts`: import the `repair_build` handler directly and assert (a) its JSON content is byte-identical to calling `repairBuild(build, errors)` directly, (b) `repair_plan.length === errors.length` for a multi-error build, (c) applying a returned fix and re-running `detectErrors` no longer surfaces the original error, (d) an empty `errors` array returns `[]`

### Implementation for User Story 2

- [X] T013 [P] [US2] Implement `packages/mcp-server/src/tools/detect-errors.ts`: export a function that registers `detect_errors` on a given `McpServer` via `registerTool` — input `{ build: BuildSchema }`, handler calls `detectErrors(build)` from `@buildmate/compiler` and serializes the `CompilerError[]` result unchanged; same structural-invalid-input → `isError: true` handling as compile_build
- [X] T014 [P] [US2] Implement `packages/mcp-server/src/tools/repair-build.ts`: export a function that registers `repair_build` on a given `McpServer` via `registerTool` — input `{ build: BuildSchema, errors: array of CompilerErrorSchema }`, handler calls `repairBuild(build, errors)` from `@buildmate/compiler` and serializes the `RepairPlan[]` result unchanged; catches structurally invalid `build`/`errors` (including an errors list referencing a component not present in the build) and returns `isError: true` with a descriptive message rather than guessing or fabricating a fix
- [X] T015 [US2] Register the `detect_errors` and `repair_build` tools onto the server in `packages/mcp-server/src/server.ts` by calling the registration functions from `tools/detect-errors.ts` and `tools/repair-build.ts` inside `createServer()` (depends on T013, T014)

**Checkpoint**: User Stories 1 and 2 both work independently — the full detect → repair pipeline is callable over MCP.

---

## Phase 5: User Story 3 - Any Standard MCP Client Discovers the Tools Automatically (Priority: P2)

**Goal**: Prove genuine MCP-protocol compliance — all 3 tools are discoverable via the protocol's own `tools/list` capability, with usable descriptions and schemas, before any tool call is made.

**Independent Test**: Connect a generic MCP client (the SDK's own reference `Client`) to a freshly created server and confirm all three tools appear in the tool list with input schemas, then confirm each is callable with input matching its advertised schema.

### Tests for User Story 3

- [X] T016 [US3] Protocol round-trip test in `packages/mcp-server/tests/protocol-roundtrip.test.ts`: use `InMemoryTransport` (from `@modelcontextprotocol/sdk/dist/esm/inMemory.js`) to create a linked transport pair, connect a real SDK `Client` to a real `McpServer` returned by `createServer()` in the same process, and assert (a) `client.listTools()` returns exactly `compile_build`, `detect_errors`, `repair_build` each with a non-empty `inputSchema`, (b) `client.callTool()` succeeds for each of the three tools with input matching its advertised schema, (c) a second server instance from a fresh `createServer()` call lists the same three tools (restart-equivalence, per spec Edge Cases) (depends on T010, T015 — requires all 3 tools registered)

**Checkpoint**: All user stories are independently functional — the server is genuinely MCP-compliant, not just internally dispatch-correct.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cross-tool guarantees (FR-007 determinism, FR-009 crash-safety) that don't belong to a single user story, plus final validation.

- [X] T017 [P] Malformed-input / crash-safety test in `packages/mcp-server/tests/error-handling.test.ts` (FR-009, spec Edge Cases): for each of `compile_build`, `detect_errors`, `repair_build`, assert that a non-object `build`, a `build` whose `components` is not an array, and (for `repair_build`) an `errors` list referencing a component absent from the `build` all produce `{ isError: true }` with a descriptive message — and that the server process/handler does not throw
- [X] T018 [P] Create `packages/mcp-server/README.md` documenting install (`npm install` at repo root), running the server (`npx tsx src/index.ts`), and the MCP client config snippet from quickstart.md
- [X] T019 Run full `quickstart.md` validation: `cd packages/mcp-server && npm test && npm run typecheck`, then manually connect via the documented `mcpServers` config and verify the three quickstart scenarios (socket-mismatch `compile_build`, detect→repair pipeline, malformed-input smoke test) plus the determinism check (two identical `compile_build` calls produce `JSON.stringify`-equal responses, FR-007/SC-003)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (needs `packages/mcp-server` to exist with its dependencies installed) — BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 (Phase 3) and US2 (Phase 4) have no dependency on each other and can proceed in parallel
  - US3 (Phase 5) requires US1 and US2's tool registrations to already exist in `server.ts` (T010, T015), since it verifies discovery of all 3 tools together
- **Polish (Phase 6)**: Depends on all of US1, US2, US3 being complete (exercises all 3 tools)

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependency on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) — no dependency on US1's files, but both register onto the shared `server.ts` (T010 and T015 touch the same file — sequence these two specifically if worked on in parallel)
- **User Story 3 (P2)**: Requires US1 (T010) and US2 (T015) to be registered first — verifies all 3 tools together

### Within Each User Story

- Tests written before implementation (dispatch-level tests fail first, since the handler files don't exist yet)
- Tool handler files before the `server.ts` registration wiring that imports them

### Parallel Opportunities

- T002, T003 can run in parallel (different new files)
- T005 can start in parallel with T002/T003 (different file), but T006/T007 are sequential (index.ts imports server.ts, server.ts imports schemas.ts)
- T008 (US1 test) can be written in parallel with T011, T012 (US2 tests) — different files
- T013, T014 (US2 tool implementations) can run in parallel — different files
- T017, T018 (Polish) can run in parallel — different files
- Once Foundational (Phase 2) is done, US1 (Phase 3) and US2 (Phase 4) can be staffed in parallel; only the final `server.ts` wiring tasks (T010, T015) need to be sequenced against each other since they edit the same file

---

## Parallel Example: User Story 1 + User Story 2 (after Foundational)

```bash
# Launch US1 and US2 test-writing together (different files):
Task: "Dispatch-level test for compile_build handler in packages/mcp-server/tests/compile-build-tool.test.ts"
Task: "Dispatch-level test for detect_errors handler in packages/mcp-server/tests/detect-errors-tool.test.ts"
Task: "Dispatch-level test for repair_build handler in packages/mcp-server/tests/repair-build-tool.test.ts"

# Launch US2's two tool implementations together (different files):
Task: "Implement detect_errors tool in packages/mcp-server/src/tools/detect-errors.ts"
Task: "Implement repair_build tool in packages/mcp-server/src/tools/repair-build.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (`compile_build`)
4. **STOP and VALIDATE**: Run T008 standalone, confirm `compile_build` dispatch matches direct Compiler calls
5. Demo: a generic MCP client can call `compile_build` and see `E001 SOCKET_MISMATCH` on a bad build

### Incremental Delivery

1. Setup + Foundational → workspace + scaffolding ready
2. Add User Story 1 → `compile_build` works and is tested → MVP demo
3. Add User Story 2 → `detect_errors` + `repair_build` pipeline works → demo detect→repair
4. Add User Story 3 → protocol round-trip proves generic-client discoverability → demo `tools/list`
5. Polish → crash-safety, README, full quickstart validation

### Parallel Team Strategy

With multiple developers, after Foundational is done:
- Developer A: User Story 1 (T008-T010)
- Developer B: User Story 2 (T011-T015)
- Both converge briefly on `server.ts` for T010/T015 (small, sequence by hand), then Developer A or B picks up User Story 3 (T016) once both are merged

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story (US1, US2, US3) for traceability
- No new domain entities are introduced (data-model.md §1) — all tasks are protocol-binding/dispatch work, not modeling work
- Server MUST NOT branch on `CompilerError.code`/`severity`, reorder/filter/dedupe Compiler output, or add fields beyond what `@buildmate/compiler` returns (data-model.md §5) — every implementation task above preserves pass-through behavior
- Commit after each task or logical group, per this repo's CLAUDE.md convention (`git add <file> && git commit -m "type(scope): description"`)
- Stop at any checkpoint to validate a story independently before moving to the next
