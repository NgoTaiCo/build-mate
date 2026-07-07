# Quickstart: Wire Compiler and Catalog as OpenClaw Tool Plugins

**Branch**: `003-wire-openclaw-plugins` | **Date**: 2026-07-07
**Mục đích**: cài plugin vào OpenClaw Gateway, restart, verify runtime, và chạy thử cả 4 tools.

## Prerequisites

- Node.js ≥ 22.17 LTS
- OpenClaw đã cài (`openclaw --version` trả về version)
- OpenClaw Gateway đã onboard (`openclaw onboard --install-daemon`)
- `@buildmate/compiler` (001) và `@buildmate/catalog` (002) đã implement hoặc stub sẵn trong workspace
- Repo ở branch `003-wire-openclaw-plugins`

## Setup workspace (nếu chưa có root `package.json` workspaces)

Root `package.json` nên declare workspaces:

```json
{
  "name": "buildmate",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/compiler",
    "packages/catalog",
    "packages/openclaw-tools"
  ]
}
```

```powershell
# Từ repo root
npm install
```

## Create plugin package

```powershell
New-Item -ItemType Directory -Path "packages/openclaw-tools/src/tools" -Force
New-Item -ItemType Directory -Path "packages/openclaw-tools/tests" -Force
Set-Location packages/openclaw-tools
npm init -y
```

Edit `packages/openclaw-tools/package.json`:

```json
{
  "name": "@buildmate/openclaw-tools",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "openclaw": {
    "extensions": ["./index.ts"],
    "compat": { "pluginApi": ">=2026.3.24-beta.2" }
  },
  "scripts": {
    "test": "node --import tsx --test tests/*.test.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@buildmate/compiler": "file:../compiler",
    "@buildmate/catalog": "file:../catalog"
  },
  "devDependencies": {
    "@sinclair/typebox": "^0.32.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0"
  }
}
```

Create `packages/openclaw-tools/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["tests", "dist"]
}
```

Create `packages/openclaw-tools/openclaw.plugin.json`:

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
  "activation": { "onStartup": true }
}
```

Install:

```powershell
npm install
```

## Install plugin into OpenClaw

```powershell
# Từ repo root
openclaw plugins install --link ./packages/openclaw-tools
```

Expected output: plugin `buildmate-tools` registered with local symlink.

## Restart gateway

```powershell
openclaw gateway restart
```

Hoặc nếu chạy foreground:

```powershell
openclaw gateway
# Ctrl+C rồi chạy lại
```

## Verify runtime

### 1. Inspect plugin manifest

```powershell
openclaw plugins inspect buildmate-tools --runtime --json
```

Expected: JSON contains `contracts.tools` with all 4 tool names.

### 2. Verify tools via agent/WebChat

Mở `http://127.0.0.1:18789/` (WebChat) hoặc chat qua channel đã bind agent `buildmate`.

Gửi lần lượt các test invocation:

**compile_build**:
```text
Call compile_build with build: { components: [ { type: "cpu", id: "c1", socket: "LGA1700", ram_gen_supported: ["DDR5"], tdp: 65 }, { type: "mainboard", id: "m1", socket: "AM5", ram_gen_supported: ["DDR5"], form_factor: "ATX" }, { type: "ram", id: "r1", generation: "DDR5" }, { type: "psu", id: "p1", wattage: 650, form_factor: "ATX" }, { type: "cooler", id: "cl1", height: 155 }, { type: "case", id: "ca1", max_cooler_height: 165, supported_mb_form_factors: ["ATX"], supported_psu_form_factors: ["ATX"] }, { type: "storage", id: "s1" } ] }
```

Expected: response contains `E001 SOCKET_MISMATCH` and `is_valid: false`.

**detect_errors**:
```text
Call detect_errors with the same build above.
```

Expected: response contains `E001`.

**repair_build**:
```text
Call repair_build with the same build and the E001 error.
```

Expected: response contains repair plan with fix targeting socket attribute.

**search_components**:
```text
Call search_components with criteria: { type: "cpu", socket: "AM5", stock_status: "in_stock" }
```

Expected: response contains only AM5 CPUs that are in stock.

## Run unit tests

```powershell
cd packages/openclaw-tools
npm test
```

**Constitution Quality Gate**: tests should pass before demo. Coverage targets:
- Plugin entry registers exactly 4 tools.
- Each tool `execute` delegates to the correct underlying function.
- `compile_build` and `detect_errors` return deterministic `CompilerError[]`.
- `repair_build` returns `RepairPlan[]` matching input errors length.
- `search_components` delegates to catalog search.
- Unexpected errors are caught and returned as `ToolErrorOutput`, not thrown.

## Test Suite Coverage

| Test file | What it covers | Count |
|---|---|---|
| `plugin-registration.test.ts` | Plugin registers 4 tools with correct names | 1+ |
| `compile-build-tool.test.ts` | Delegates to `compileBuild`, returns JSON `CompilerResult` | 3+ |
| `detect-errors-tool.test.ts` | Delegates to `detectErrors`, returns JSON `CompilerError[]` | 3+ |
| `repair-build-tool.test.ts` | Delegates to `repairBuild`, returns JSON `RepairPlan[]` | 3+ |
| `search-components-tool.test.ts` | Delegates to `searchComponents`, returns JSON `CatalogResult` | 3+ |
| `error-handling.test.ts` | Unexpected exceptions caught → `ToolErrorOutput` | 2+ |

## Project Structure

```text
packages/openclaw-tools/
├── package.json
├── openclaw.plugin.json
├── tsconfig.json
├── src/
│   ├── index.ts                  # definePluginEntry
│   ├── schemas.ts                # TypeBox schemas
│   └── tools/
│       ├── compile-build.ts      # compile_build tool
│       ├── detect-errors.ts      # detect_errors tool
│       ├── repair-build.ts       # repair_build tool
│       └── search-components.ts  # search_components tool
└── tests/
    ├── plugin-registration.test.ts
    ├── compile-build-tool.test.ts
    ├── detect-errors-tool.test.ts
    ├── repair-build-tool.test.ts
    ├── search-components-tool.test.ts
    └── error-handling.test.ts
```

## What this quickstart does NOT cover

- Implementing `@buildmate/compiler` — see `specs/001-build-compiler-core/quickstart.md`.
- Implementing `@buildmate/catalog` — see `specs/002-mock-catalog-adapter/quickstart.md`.
- `add_to_build` / browser automation — deferred to DOM execution feature.
- `guide_checkout` — deferred to checkout guidance feature.
- Production deployment / ClawHub publish — out of hackathon scope.
