# Quickstart: DOM Build Tools

**Branch**: `004-dom-build-tools` | **Date**: 2026-07-07
**Mục đích**: cài Playwright browsers, khởi động mock build-PC page, chạy unit/integration test, và verify 2 DOM tools qua WebChat.

## Prerequisites

- Node.js ≥ 22.17 LTS
- OpenClaw đã cài (`openclaw --version` trả về version)
- OpenClaw Gateway đã onboard (`openclaw onboard --install-daemon`)
- `@buildmate/compiler` (001) và `@buildmate/catalog` (002) đã implement hoặc stub sẵn trong workspace
- Repo ở branch `004-dom-build-tools`

## Setup workspace

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

## Install Playwright browsers

```powershell
cd packages/openclaw-tools
npx playwright install chromium
```

> Chỉ cần Chromium cho headless automation. Nếu dùng Playwright dependency đã có trong package, browsers sẽ được download.

## Create / extend plugin files

Nếu chưa có từ 003, tạo cấu trúc:

```powershell
New-Item -ItemType Directory -Path "packages/openclaw-tools/src/tools" -Force
New-Item -ItemType Directory -Path "packages/openclaw-tools/src/dom" -Force
New-Item -ItemType Directory -Path "packages/openclaw-tools/mock-build-pc/public" -Force
New-Item -ItemType Directory -Path "packages/openclaw-tools/tests" -Force
New-Item -ItemType Directory -Path "packages/openclaw-tools/mock-build-pc/tests" -Force
```

Update `packages/openclaw-tools/package.json`:

```json
{
  "name": "@buildmate/openclaw-tools",
  "version": "0.2.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "openclaw": {
    "extensions": ["./index.ts"],
    "compat": { "pluginApi": ">=2026.3.24-beta.2" }
  },
  "scripts": {
    "test": "node --import tsx --test tests/*.test.ts mock-build-pc/tests/*.test.ts",
    "typecheck": "tsc --noEmit",
    "mock:build-pc": "node --import tsx mock-build-pc/server.ts"
  },
  "dependencies": {
    "@buildmate/compiler": "file:../compiler",
    "@buildmate/catalog": "file:../catalog",
    "playwright": "^1.45.0"
  },
  "devDependencies": {
    "@sinclair/typebox": "^0.32.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0"
  }
}
```

Update `packages/openclaw-tools/openclaw.plugin.json`:

```json
{
  "id": "buildmate-tools",
  "name": "BuildMate Tools",
  "contracts": {
    "tools": [
      "compile_build",
      "detect_errors",
      "repair_build",
      "search_components",
      "add_to_build",
      "read_current_build"
    ]
  },
  "activation": { "onStartup": true }
}
```

```powershell
npm install
```

## Start mock build-PC page

```powershell
cd packages/openclaw-tools
npm run mock:build-pc
```

Expected: Mock server chạy tại `http://127.0.0.1:3001`.

Verify bằng trình duyệt:

```powershell
Start-Process "http://127.0.0.1:3001"
```

## Run tests

```powershell
cd packages/openclaw-tools
npm test
```

**Constitution Quality Gate**: tests should pass before demo. Coverage targets:
- Pure helpers (`dom-helpers.test.ts`): parser, SKU matcher, fallback detector.
- Integration `add_to_build` trên mock page (`add-to-build-mock.test.ts`).
- Integration `read_current_build` trên mock page (`read-current-build-mock.test.ts`).
- Plugin registration có 6 tools (`plugin-registration.test.ts` nếu chưa có từ 003).

## Install plugin into OpenClaw

```powershell
# Từ repo root
openclaw plugins install --link ./packages/openclaw-tools
```

## Restart gateway

```powershell
openclaw gateway restart
```

## Verify runtime

### 1. Inspect plugin manifest

```powershell
openclaw plugins inspect buildmate-tools --runtime --json
```

Expected: JSON contains `contracts.tools` with all 6 tool names including `add_to_build` and `read_current_build`.

### 2. Verify tools via agent/WebChat

Mở `http://127.0.0.1:18789/` (WebChat) hoặc chat qua channel đã bind agent `buildmate`.

Đảm bảo mock server đang chạy.

**read_current_build (mock)**:

```text
Call read_current_build with target: "mock"
```

Expected: response chứa `build_state` với `components: []`, `total: 0`.

**add_to_build (mock)**:

```text
Call add_to_build with sku: "CPU-AM5-001", target: "mock"
```

Expected: response chứa `ok: true`, `target: "mock"`, `added.sku: "CPU-AM5-001"`.

**read_current_build again**:

```text
Call read_current_build with target: "mock"
```

Expected: response chứa build với CPU vừa thêm.

**add_to_build (auto fallback suggestion)**:

```text
Call add_to_build with sku: "CPU-AM5-001", target: "auto"
```

Nếu `phongvu.vn/buildpc` không reachable hoặc bị login wall: response chứa `fallback_suggested: true`, `ok: false`. Agent sẽ hỏi user có muốn chuyển sang mock không.

## Project Structure

```text
packages/openclaw-tools/
├── package.json
├── openclaw.plugin.json
├── tsconfig.json
├── src/
│   ├── index.ts                  # definePluginEntry + register 6 tools
│   ├── schemas.ts                # TypeBox parameter schemas
│   ├── dom/
│   │   ├── page-object.ts        # selectors + wait strategies
│   │   ├── browser-driver.ts     # Playwright context lifecycle
│   │   └── parser.ts             # parse build state from DOM
│   └── tools/
│       ├── compile-build.ts
│       ├── detect-errors.ts
│       ├── repair-build.ts
│       ├── search-components.ts
│       ├── add-to-build.ts       # DOM tool
│       └── read-current-build.ts # DOM tool
├── mock-build-pc/
│   ├── server.ts                 # minimal HTTP server
│   └── public/
│       ├── index.html            # mirror phongvu build PC layout
│       ├── app.js                # mock interactions
│       └── catalog.json          # full catalog replica
└── tests/
    ├── dom-helpers.test.ts
    ├── add-to-build-mock.test.ts
    ├── read-current-build-mock.test.ts
    └── fallback-detector.test.ts
```

## Test Suite Coverage

| Test file | What it covers | Count |
|---|---|---|
| `dom-helpers.test.ts` | Parse build state, parse price, category label mapping | 5+ |
| `fallback-detector.test.ts` | Detect login wall, captcha, timeout, unreachable (fixtures) | 4+ |
| `add-to-build-mock.test.ts` | Add component via mock page DOM, verify build list update | 3+ |
| `read-current-build-mock.test.ts` | Read empty build, read build with components | 3+ |
| `plugin-registration.test.ts` | Plugin registers 6 tools | 1+ |

## What this quickstart does NOT cover

- Implementing `@buildmate/compiler` — see `specs/001-build-compiler-core/quickstart.md`.
- Implementing `@buildmate/catalog` — see `specs/002-mock-catalog-adapter/quickstart.md`.
- Chrome Extension overlay — out of scope.
- Checkout / payment automation — out of scope.
- Production deployment / ClawHub publish — out of hackathon scope.
