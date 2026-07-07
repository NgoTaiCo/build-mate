# Research: Wire Compiler and Catalog as OpenClaw Tool Plugins

**Branch**: `003-wire-openclaw-plugins` | **Date**: 2026-07-07
**Phase**: 0 — resolve technical unknowns before design
**Source**: `docs/openclaw-reference.md` (compiled from docs.openclaw.ai), `specs/001-build-compiler-core/contracts/compiler-api.md`, `specs/002-mock-catalog-adapter/contracts/catalog-api.md`

## Research Tasks

| # | Unknown / Choice | Resolved in § |
|---|---|---|
| R1 | OpenClaw plugin SDK shape (registerTool, manifest, activation) | §1 |
| R2 | Tool parameter schema format | §2 |
| R3 | Tool return / response format | §3 |
| R4 | Plugin package layout + workspace integration | §4 |
| R5 | Local dev install pattern (`--link` vs npm workspace) | §5 |
| R6 | Runtime verification pattern | §6 |
| R7 | Error handling inside tool `execute` | §7 |
| R8 | Keeping Compiler/Catalog pure while wrapping | §8 |

---

## §1. OpenClaw Plugin SDK Shape

**Decision**: Use OpenClaw **tool plugin** shape with `definePluginEntry` from `openclaw/plugin-sdk/plugin-entry`, `registerTool` API, `openclaw.plugin.json` manifest, and `package.json` `openclaw.extensions` entry.

**Rationale**: `docs/openclaw-reference.md` §4 confirms tool plugin is the correct shape for registering agent tools. The SDK provides typed hooks and in-process server-side execution. Pattern matches the verified reference exactly:

```json
// package.json
{ "openclaw": { "extensions": ["./index.ts"], "compat": { "pluginApi": ">=2026.3.24-beta.2" } } }
```

```json
// openclaw.plugin.json
{ "id": "buildmate-tools", "name": "BuildMate Tools", "contracts": { "tools": ["compile_build","detect_errors","repair_build","search_components"] }, "activation": { "onStartup": true } }
```

```typescript
// index.ts
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
export default definePluginEntry({ id: "buildmate-tools", name: "BuildMate Tools", register(api) { api.registerTool({ ... }); } });
```

**Alternatives considered**:
- Channel plugin — rejected: this feature exposes tools, not a messaging channel.
- Provider plugin — rejected: we are not adding a model/media/search provider.
- Manual tool registration via agent config only — rejected: `api.registerTool` is the documented SDK path and enables `openclaw plugins inspect --runtime` verification.

---

## §2. Tool Parameter Schema Format

**Decision**: Use **TypeBox** (`@sinclair/typebox`) for parameter schemas, matching the OpenClaw reference example.

**Rationale**: `docs/openclaw-reference.md` §4 shows `import { Type } from "typebox"` and `parameters: Type.Object({ ... })`. TypeBox produces JSON Schema at runtime and provides TypeScript type inference, giving both runtime validation and compile-time safety. The schemas are deterministic, no LLM involvement.

**Schemas for the 4 tools**:

| Tool | Parameters |
|---|---|
| `compile_build` | `{ build: Build }` — reuse `Build` type from `@buildmate/compiler` |
| `detect_errors` | `{ build: Build }` |
| `repair_build` | `{ build: Build, errors: CompilerError[] }` |
| `search_components` | `{ criteria: SearchCriteria }` — reuse `SearchCriteria` from `@buildmate/catalog` |

**Alternatives considered**:
- Zod — popular but not used in the OpenClaw reference example; mixing schema libraries adds confusion.
- JSON Schema raw objects — no TypeScript inference, more boilerplate.
- Plain TS interfaces — no runtime validation, OpenClaw tool registration requires schema object.

---

## §3. Tool Return / Response Format

**Decision**: Return OpenClaw **content message** format: `{ content: [{ type: "text", text: JSON.stringify(result) }] }`.

**Rationale**: OpenClaw tool execution expects a structured content array. Serializing the pure function result as JSON text keeps the plugin thin and preserves the exact shape produced by `@buildmate/compiler` / `@buildmate/catalog`. The agent/LLM consumes the JSON string; formatting into user-friendly text happens in the agent layer (not the plugin).

**Return shape per tool**:

| Tool | Returns |
|---|---|
| `compile_build` | `CompilerResult` serialized |
| `detect_errors` | `CompilerError[]` serialized |
| `repair_build` | `RepairPlan[]` serialized |
| `search_components` | `CatalogResult` (or `CatalogComponent[]`) serialized |

**Alternatives considered**:
- Return raw objects — may not conform to OpenClaw tool contract; reference shows content array.
- Prettify / summarize inside plugin — rejected: violates "plugin only wraps+dispatches, no logic" (Constitution Principle II).

---

## §4. Plugin Package Layout

**Decision**: Create a new package `packages/openclaw-tools/` (name `@buildmate/openclaw-tools`) in the existing `packages/` monorepo layout. It depends on `@buildmate/compiler` and `@buildmate/catalog` as workspace/local dependencies.

**Rationale**: Features 001 and 002 already established `packages/compiler/` and `packages/catalog/` as separate packages. The OpenClaw plugin is a distinct layer (ADR-0001 §3 tool plugin layer) and must not mix logic into Compiler/Catalog. A dedicated package enforces the boundary physically. The root `package.json` will declare npm workspaces (created/updated now or assumed in place because wire-up is the integration point).

**Package contents**:
```text
packages/openclaw-tools/
├── package.json              # name: @buildmate/openclaw-tools, openclaw.extensions
├── openclaw.plugin.json      # plugin manifest
├── tsconfig.json             # strict, ES2023, NodeNext
├── src/
│   ├── index.ts              # definePluginEntry + register 4 tools
│   ├── tools/
│   │   ├── compile-build.ts  # wrap compileBuild
│   │   ├── detect-errors.ts  # wrap detectErrors
│   │   ├── repair-build.ts   # wrap repairBuild
│   │   └── search-components.ts # wrap searchComponents
│   └── schemas.ts            # TypeBox schemas for tool params
└── tests/
    ├── plugin-smoke.test.ts  # verify tool registration object shape
    └── dispatch.test.ts      # verify execute() delegates to pure functions
```

**Alternatives considered**:
- Put plugin inside `packages/catalog/` or `packages/compiler/` — rejected: violates layer separation; tool registration is an integration concern, not core logic.
- Flat `src/` at repo root — rejected: loses package boundary and workspace isolation.

---

## §5. Local Dev Install Pattern

**Decision**: Use `openclaw plugins install --link ./packages/openclaw-tools` for local development; rely on npm workspaces / `file:` links for dependency resolution.

**Rationale**: `docs/openclaw-reference.md` §4 explicitly documents `openclaw plugins install --link ./buildmate-tools` followed by `openclaw gateway restart`. The `--link` flag creates a symlink so source changes are picked up after gateway restart, which is ideal for hackathon iteration. Because `@buildmate/compiler` and `@buildmate/catalog` live in sibling `packages/`, npm workspaces (or `file:` specifiers) resolve them locally without publishing.

**Flow**:
```powershell
# From repo root
npm install                      # install workspace deps if root package.json has workspaces
openclaw plugins install --link ./packages/openclaw-tools
openclaw gateway restart
```

**Alternatives considered**:
- `npm pack` then `openclaw plugins install npm-pack:...` — slower iteration, not needed for local dev.
- Global npm install of plugin — rejected: loses live code linking.
- Copying `dist/` into OpenClaw plugin dir — manual and error-prone.

---

## §6. Runtime Verification Pattern

**Decision**: Verify via `openclaw plugins inspect buildmate-tools --runtime --json` plus end-to-end invocation of all 4 tools through the agent/WebChat.

**Rationale**: `docs/openclaw-reference.md` §4 documents `openclaw plugins inspect <id> --runtime --json` for runtime inspection. The spec requires "verify --runtime that all 4 tools dispatch correctly". The inspect command checks plugin load state and tool manifest. Functional verification is completed by sending representative invocations (one per tool) and asserting expected result types.

**Verification checklist**:
1. `openclaw plugins inspect buildmate-tools --runtime --json` → shows 4 tools in `contracts.tools`.
2. Restart gateway; confirm no plugin load errors in logs.
3. Invoke `compile_build` with a valid build → returns JSON `CompilerResult`.
4. Invoke `detect_errors` with mismatched socket build → returns JSON containing `E001`.
5. Invoke `repair_build` with build + errors → returns JSON `RepairPlan[]`.
6. Invoke `search_components` with `{ type: "cpu", socket: "AM5" }` → returns JSON `CatalogComponent[]`.

**Alternatives considered**:
- Only manual WebChat test — less rigorous; inspect command gives structured confirmation.
- Automated integration test spawning OpenClaw gateway — overkill for hackathon time-box; manual runtime verification is sufficient per spec assumption.

---

## §7. Error Handling Inside Tool `execute`

**Decision**: Catch synchronous/asynchronous errors inside `execute` and return them as structured tool output (`{ ok: false, error: string }`) rather than throwing unhandled exceptions. Structural caller bugs (malformed tool arguments) are still returned gracefully when possible.

**Rationale**: The plugin must not crash the OpenClaw gateway process. Compiler/Catalog already handle malformed build data gracefully (return structured errors like `E006 MISSING_ATTRIBUTE`). For unexpected exceptions, the plugin wraps them in a JSON error object so the agent can report to the user. Throwing raw exceptions could abort the agent turn.

**Error envelope**:
```typescript
{ ok: false, error: "Unexpected error in compile_build", details: string }
```

**Note**: This is a thin safety wrapper, not business logic. The Compiler/Catalog still own all compatibility-error semantics.

**Alternatives considered**:
- Let exceptions propagate — risk of crashing gateway/agent turn.
- Return plain text error message — less structured for agent branching.

---

## §8. Keeping Compiler/Catalog Pure While Wrapping

**Decision**: The plugin layer contains **only** schema definitions, thin `execute` wrappers that call imported pure functions, and error serialization. No conditional compatibility logic, no state, no LLM calls, no caching, no session access.

**Rationale**: This is the core constraint of the feature ("Compiler stays pure (plugin only wraps+dispatches, no logic)"). By placing all business logic in `@buildmate/compiler` and `@buildmate/catalog`, the plugin remains a passive adapter. This enforces Constitution Principle II and makes the plugin trivial to test (just verify delegation).

**What the plugin MUST NOT do**:
- Modify build/criteria before passing to Compiler/Catalog (except safe deserialization).
- Branch on error codes to change agent behavior.
- Store conversation state or build history.
- Call model APIs.
- Decide compatibility (that is Compiler's job).

**What the plugin MAY do**:
- Validate/deserialize tool parameters via TypeBox schema.
- Call pure functions from `@buildmate/compiler` / `@buildmate/catalog`.
- Serialize results to JSON text for OpenClaw content format.
- Catch and wrap unexpected runtime errors.

**Alternatives considered**:
- Embed tool logic directly in plugin — rejected: violates "Compiler stays pure" and creates untestable OpenClaw-coupled code.
- Add caching or session state in plugin — rejected: violates "No SessionStore, no external orchestrator" and Constitution Principle I.

---

## Phase 0 Summary

All 8 research tasks resolved. No remaining NEEDS CLARIFICATION. Decisions feed into:
- `data-model.md`: plugin/tool entities plus references to 001/002 entities.
- `contracts/`: tool schemas and dispatch contracts.
- `quickstart.md`: install `--link`, restart, inspect `--runtime`, end-to-end invocation.
- `plan.md`: technical context + constitution check updated.
