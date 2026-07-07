# Quickstart: Catalog Adapter

**Branch**: `002-mock-catalog-adapter` | **Date**: 2026-07-07

## Prerequisites

- Node.js >= 22.17 LTS
- npm (bundled with Node)
- (Optional) Apify API key for live scraping: `$env:APIFY_API_KEY = "apify_api_..."`

## Setup

```powershell
# Create package directory
New-Item -ItemType Directory -Path "packages/catalog/src/apify" -Force
New-Item -ItemType Directory -Path "packages/catalog/tests" -Force

# Initialize package
Set-Location packages/catalog
npm init -y
```

Edit `packages/catalog/package.json`:
```json
{
  "name": "@buildmate/catalog",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "test": "node --import tsx --test tests/*.test.ts",
    "test:watch": "node --import tsx --test --watch tests/*.test.ts",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0"
  },
  "dependencies": {
    "apify-client": "^2.0.0"
  }
}
```

Create `packages/catalog/tsconfig.json`:
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

Install:
```powershell
npm install
```

## Test

```powershell
# Run all tests (mock data path only — no Apify key needed)
npm test

# Run specific test file
node --import tsx --test tests/search.test.ts

# Typecheck
npm run typecheck
```

**Constitution Quality Gate**: `npm test` must pass before demo (Constitution §Quality Gates). Target ~20 tests total.

## Test Suite Coverage

| Test file | What it covers | Count |
|---|---|---|
| `search.test.ts` | Combined criteria with AND logic, empty criteria, mixed types | 5+ |
| `filter-socket.test.ts` | Exact match for CPU/mb, array.includes for cooler, unknown socket | 4+ |
| `filter-price.test.ts` | Inclusive range, min-only, max-only, min>max, mismatch | 4+ |
| `filter-stock.test.ts` | in_stock, out_of_stock, no filter, unknown value | 3+ |
| `filter-ram-gen.test.ts` | DDR4, DDR5, mismatch, filter on mainboard/ram | 3+ |
| `filter-form-factor.test.ts` | Hierarchical case (ATX→mATX→ITX), exact mainboard | 4+ |
| `filter-clearance.test.ts` | Inclusive min, mismatch | 2+ |
| `filter-tdp.test.ts` | tdp_min, tdp_max, combined range | 3+ |
| `filter-wattage.test.ts` | wattage_min, wattage_max | 2+ |
| `mock-data.test.ts` | ≥5 per type, ≥1 in/out stock each, unique IDs, field completeness | 4+ |
| `sort.test.ts` | Price ascending order, deterministic mock order | 2+ |
| `apify.test.ts` | Stub/mock Apify client only (skip live without API key) | 3+ |

## Key Design Decisions (from research.md)

1. **Field mapping**: catalog → compiler field names (research §1). `ram_gen` → `generation`, single value → `ram_gen_supported: [string]`.
2. **form_factor hierarchy**: ATX(3) > mATX(2) > ITX(1) — `>=` for case, `===` for mainboard.
3. **Per-category fallback**: each type fetches independently — partial live, partial mock OK.
4. **No caching**: fresh Apify call per `searchComponents`.
5. **Apify SDK**: `apify-client` official package, Actor ID + API key config.

## Project Structure

```text
packages/catalog/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts             # barrel: searchComponents, searchComponentsMock
│   ├── types.ts             # CatalogComponent, SearchCriteria, CatalogResult, etc.
│   ├── mock-data.ts         # MOCK_CATALOG: CatalogComponent[] (~50 entries)
│   ├── search.ts            # searchComponents orchestration
│   ├── filter.ts            # predicate factories (AND logic)
│   ├── form-factor.ts       # FORM_FACTOR_RANK, FORM_FACTOR_COMPAT constants
│   └── apify/
│       ├── client.ts        # Apify client wrapper (Actor.run with config)
│       └── mapper.ts        # ScrapedProduct → CatalogComponent (regex parse)
└── tests/
    ├── search.test.ts
    ├── filter-socket.test.ts
    ├── filter-price.test.ts
    ├── filter-stock.test.ts
    ├── filter-ram-gen.test.ts
    ├── filter-form-factor.test.ts
    ├── filter-clearance.test.ts
    ├── filter-tdp.test.ts
    ├── filter-wattage.test.ts
    ├── mock-data.test.ts
    ├── sort.test.ts
    └── apify.test.ts
```

## Integration with Build Compiler

Catalog returns components in Compiler-compatible format. Wire-up (future feature, HOUR 8-10):

```typescript
import { searchComponents } from "@buildmate/catalog";
import { compileBuild } from "@buildmate/compiler";

// S1: search → compile → stream
const result = await searchComponents({ type: "cpu", socket: "AM5", stock_status: "in_stock" });
const build = { components: [result.components[0], ...] };
const validation = compileBuild(build);
```
