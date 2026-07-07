# Contract: OpenClaw Tool Plugin (BuildMate Tools)

**Branch**: `003-wire-openclaw-plugins` | **Date**: 2026-07-07
**Project type**: OpenClaw tool plugin — contract = tool schemas + dispatch behavior.
**Consumers**: OpenClaw agent runtime (loads plugin), BuildMate WebChat agent, future demo/test harness.
**Dependencies**: `@buildmate/compiler` (001), `@buildmate/catalog` (002), `openclaw/plugin-sdk`.

## Public Surface

Package `@buildmate/openclaw-tools` exports a default plugin entry (`src/index.ts`) via `definePluginEntry`. No other public APIs are exposed.

```typescript
// src/index.ts
export default definePluginEntry({
  id: "buildmate-tools",
  name: "BuildMate Tools",
  description: "Expose Build Compiler and Catalog as OpenClaw tools",
  register(api) {
    api.registerTool(compileBuildTool);
    api.registerTool(detectErrorsTool);
    api.registerTool(repairBuildTool);
    api.registerTool(searchComponentsTool);
  },
});
```

---

## 1. Tool: `compile_build`

**Purpose**: Validate a PC build deterministically and return errors + repair plan.

**Input schema** (TypeBox):
```typescript
Type.Object({
  build: BuildSchema, // references @buildmate/compiler Build type
});
```

**Output**: OpenClaw content message containing JSON-serialized `CompilerResult`.

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"errors\":[{\"code\":\"E001\",\"severity\":\"error\",\"name\":\"SOCKET_MISMATCH\",\"message\":\"...\",\"component_refs\":[\"cpu1\",\"mb1\"],\"details\":{\"expected\":\"AM5\",\"actual\":\"LGA1700\"}}],\"repair_plan\":[...],\"is_valid\":false}"
    }
  ]
}
```

**Contract**:
- Delegates directly to `compileBuild(params.build)` from `@buildmate/compiler`.
- No modification of `params.build`.
- No LLM call.
- Deterministic: same input → same output string.
- Returns `ToolErrorOutput` envelope only on unexpected runtime exceptions.

---

## 2. Tool: `detect_errors`

**Purpose**: Detect compatibility errors without generating a repair plan.

**Input schema** (TypeBox):
```typescript
Type.Object({
  build: BuildSchema,
});
```

**Output**: OpenClaw content message containing JSON-serialized `CompilerError[]`.

**Contract**:
- Delegates directly to `detectErrors(params.build)` from `@buildmate/compiler`.
- Equivalent to `compileBuild(build).errors`.
- No repair plan returned.

---

## 3. Tool: `repair_build`

**Purpose**: Generate a concrete repair plan from a build and a list of detected errors.

**Input schema** (TypeBox):
```typescript
Type.Object({
  build: BuildSchema,
  errors: Type.Array(CompilerErrorSchema),
});
```

**Output**: OpenClaw content message containing JSON-serialized `RepairPlan[]`.

**Contract**:
- Delegates directly to `repairBuild(params.build, params.errors)` from `@buildmate/compiler`.
- `repair_plan.length === errors.length`.
- Each repair plan contains constraint-based fixes (no SKU resolution).

---

## 4. Tool: `search_components`

**Purpose**: Search the catalog for components matching criteria.

**Input schema** (TypeBox):
```typescript
Type.Object({
  criteria: SearchCriteriaSchema, // references @buildmate/catalog SearchCriteria
});
```

**Output**: OpenClaw content message containing JSON-serialized `CatalogResult`.

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"components\":[{\"id\":\"cpu-001\",\"name\":\"AMD Ryzen 7 7800X3D\",...}],\"source\":\"mock\",\"errors\":[]}"
    }
  ]
}
```

**Contract**:
- Delegates directly to `searchComponents(params.criteria)` from `@buildmate/catalog`.
- Returns components in Compiler-compatible format.
- Mock path deterministic; live path may vary by Apify state.

---

## 5. Parameter Schema Reuse

The plugin imports TypeBox-compatible schemas or types from sibling packages rather than redefining them:

| Imported from | Used in tool |
|---|---|
| `@buildmate/compiler` `Build` | `compile_build`, `detect_errors`, `repair_build` |
| `@buildmate/compiler` `CompilerError` | `repair_build` |
| `@buildmate/catalog` `SearchCriteria` | `search_components` |

If the sibling packages export JSON Schema objects, the plugin uses them directly. If they export only TypeScript types, the plugin creates thin TypeBox schemas that mirror the types (single source of truth remains the compiler/catalog packages).

---

## 6. Error Handling Contract

### 6.1 Expected errors (business logic)

Compiler/Catalog already return structured errors (e.g., `E001`, empty search result). These are passed through as normal successful tool outputs; the agent interprets them.

### 6.2 Unexpected plugin errors

If `execute` throws (e.g., import failure, TypeBox validation mismatch), catch and return:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"ok\":false,\"error\":\"Unexpected error in compile_build\",\"details\":\"...\"}"
    }
  ]
}
```

- Must not crash the gateway.
- Must not leak stack traces to the agent (security/cleanliness).
- Must not retry or transform business results.

---

## 7. Plugin Manifest Contract

`openclaw.plugin.json` declares the 4 tools:

```json
{
  "id": "buildmate-tools",
  "name": "BuildMate Tools",
  "contracts": {
    "tools": [
      "compile_build",
      "detect_errors",
      "repair_build",
      "search_components"
    ]
  },
  "activation": {
    "onStartup": true
  }
}
```

Runtime verification (`openclaw plugins inspect buildmate-tools --runtime --json`) MUST list all 4 tools.

---

## 8. Non-Goals (Explicitly Excluded)

- Implementing `add_to_build` or browser automation — deferred to DOM execution feature.
- Implementing `guide_checkout` — deferred to checkout guidance feature.
- Adding, modifying, or bypassing Compiler compatibility rules.
- Adding, modifying, or bypassing Catalog data sources or filter logic.
- Building a custom session store, orchestrator, or gateway replacement.
- Calling model APIs or using LLM to interpret compatibility.
- Caching tool results between invocations.
