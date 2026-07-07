# Data Model: Wire Compiler and Catalog as OpenClaw Tool Plugins

**Branch**: `003-wire-openclaw-plugins` | **Date**: 2026-07-07
**Source**: spec.md Key Entities + research.md §1–§8
**Implementation note**: types dưới đây = TypeScript type definitions. Plugin layer stateless; all business data structures come from `@buildmate/compiler` (001) và `@buildmate/catalog` (002).

## Entities Overview

```text
OpenClaw Gateway ──loads── ToolPlugin
                               │
                               ├─ registers ToolDefinition[]
                               │       ├── compile_build  → delegates → @buildmate/compiler.compileBuild
                               │       ├── detect_errors  → delegates → @buildmate/compiler.detectErrors
                               │       ├── repair_build   → delegates → @buildmate/compiler.repairBuild
                               │       └── search_components → delegates → @buildmate/catalog.searchComponents
                               │
                               └─ ToolInvocation (input/output envelope)
```

---

## 1. ToolPlugin (plugin entry)

Represents the OpenClaw plugin entry point loaded by the gateway.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `"buildmate-tools"` | yes | Stable plugin identifier. Matches `openclaw.plugin.json` `id`. |
| `name` | `"BuildMate Tools"` | yes | Human-readable plugin name. |
| `description` | `string` | yes | Short description for plugin listing. |
| `register` | `(api: PluginApi) => void` | yes | Callback invoked by OpenClaw at load time; calls `api.registerTool(...)` for each tool. |

**Constraints**:
- No state between invocations.
- No session/memory access.
- No LLM calls.
- No business logic beyond dispatch.

---

## 2. PluginApi (OpenClaw SDK surface)

The object passed by OpenClaw to `register`. Plugin only uses `registerTool`.

| Field | Type | Description |
|---|---|---|
| `registerTool` | `(definition: ToolDefinition) => void` | Register one callable tool. |
| `on` / `registerHook` | `...` | Available but unused by this plugin. |

---

## 3. ToolDefinition (one registered tool)

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | yes | Tool name exposed to agent: `compile_build`, `detect_errors`, `repair_build`, `search_components`. |
| `description` | `string` | yes | Agent-facing description of what the tool does. Must mention deterministic behavior for Compiler tools. |
| `parameters` | `TSchema` (TypeBox) | yes | JSON Schema for tool parameters. |
| `execute` | `(id: string, params: unknown) => Promise<ToolOutput>` | yes | Server-side in-process handler. Thin wrapper around `@buildmate/compiler` / `@buildmate/catalog`. |

---

## 4. ToolInput / ToolOutput (invocation envelopes)

### 4.1 ToolInput

OpenClaw calls `execute(id, params)` where `params` matches the tool's `parameters` schema after validation.

| Tool | `params` shape |
|---|---|
| `compile_build` | `{ build: Build }` |
| `detect_errors` | `{ build: Build }` |
| `repair_build` | `{ build: Build, errors: CompilerError[] }` |
| `search_components` | `{ criteria: SearchCriteria }` |

> `Build`, `CompilerError`, `RepairPlan`, `SearchCriteria`, `CatalogResult`, `CatalogComponent` are defined in `specs/001-build-compiler-core/data-model.md` and `specs/002-mock-catalog-adapter/data-model.md`. This feature does not redefine them.

### 4.2 ToolOutput

OpenClaw expects the execute function to return a content message.

```typescript
interface ToolOutput {
  content: Array<{ type: "text"; text: string }>;
}
```

The `text` field contains `JSON.stringify(result)` where `result` is the pure function output:

| Tool | `result` type | Serialized as |
|---|---|---|
| `compile_build` | `CompilerResult` | `JSON.stringify({ errors, repair_plan, is_valid })` |
| `detect_errors` | `CompilerError[]` | `JSON.stringify(errors)` |
| `repair_build` | `RepairPlan[]` | `JSON.stringify(repair_plan)` |
| `search_components` | `CatalogResult` | `JSON.stringify({ components, source, errors })` |

**Error envelope** (for unexpected plugin-level failures only):
```typescript
interface ToolErrorOutput {
  ok: false;
  error: string;    // "Unexpected error in compile_build"
  details?: string; // safe error message, no stack trace leaked to agent
}
```
Serialized the same way inside `content[0].text`.

---

## 5. Plugin Manifest (`openclaw.plugin.json`)

Static manifest declaring plugin metadata and tool contracts.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `"buildmate-tools"` | yes | Same as `ToolPlugin.id`. |
| `name` | `"BuildMate Tools"` | yes | Same as `ToolPlugin.name`. |
| `contracts.tools` | `string[]` | yes | `["compile_build","detect_errors","repair_build","search_components"]` — used by runtime verification. |
| `activation.onStartup` | `true` | yes | Load plugin when gateway starts. |

---

## 6. Package Manifest (`package.json`)

| Field | Value | Description |
|---|---|---|
| `name` | `@buildmate/openclaw-tools` | Workspace package name. |
| `type` | `"module"` | ESM. |
| `main` | `./src/index.ts` | Entry for OpenClaw extension loader. |
| `openclaw.extensions` | `["./index.ts"]` | Tells OpenClaw where to load plugin entry. |
| `openclaw.compat.pluginApi` | `">=2026.3.24-beta.2"` | Minimum OpenClaw plugin API version. |
| `dependencies` | `@buildmate/compiler`, `@buildmate/catalog` | Local/workspace dependencies. |
| `devDependencies` | `typescript`, `tsx`, `@types/node` | Same pattern as 001/002. |

---

## 7. Invariants

- **Stateless**: plugin holds no mutable state; no session storage; no cache.
- **Deterministic delegation**: identical input → identical output because underlying functions are deterministic (Compiler + Catalog mock path).
- **No logic leakage**: plugin does not interpret error codes, does not decide compatibility, does not generate repair plans.
- **No OpenClaw runtime dependency in core**: `@buildmate/compiler` and `@buildmate/catalog` remain pure and testable standalone; only `@buildmate/openclaw-tools` imports OpenClaw SDK.
- **Tool name stability**: names are fixed strings; agent prompts/skills rely on them.

## 8. Out-of-scope data

- Session/memory state — owned by OpenClaw (Constitution Principle I).
- `add_to_build` DOM execution data — deferred to browser automation feature.
- `guide_checkout` checkout guidance data — deferred to separate feature.
- Model/provider configuration — owned by `~/.openclaw/openclaw.json`.
