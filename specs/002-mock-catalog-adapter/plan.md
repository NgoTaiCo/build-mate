# Implementation Plan: Catalog Adapter (Live-first, Mock fallback)

**Branch**: `002-mock-catalog-adapter` | **Date**: 2026-07-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-mock-catalog-adapter/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Build a catalog adapter that sources PC component data from **real PhongVu product listings** (pre-fetched via Teko Discovery API, cached as JSON) with deterministic filtering. Expose a `search_components(criteria)` function supporting multi-criteria filtering (socket, price range, stock status, RAM generation, form factor, GPU/cooler clearance) with AND logic. Support 8 component types (CPU, mainboard, RAM, PSU, cooler, case, storage, GPU). Pre-fetch data at build time from PhongVu API, cache permanently in JSON files, load at runtime (fully deterministic, no runtime API calls). Results sorted by price ascending.

## Technical Context

**Language/Version**: TypeScript / Node.js (existing project stack)  
**Primary Dependencies**: Teko Discovery API client (HTTP fetch), JSON transformer for PhongVu response → Component schema  
**Storage**: In-memory JSON data structures (pre-fetched, no database)  
**Data Source**: PhongVu.vn via Teko Discovery API (`https://discovery.tekoapis.com/api/v2/search-skus-v2`)  
**Testing**: Jest (unit tests for filtering logic, API transformer, data determinism)  
**Target Platform**: OpenClaw Gateway plugin (server-side runtime)
**Project Type**: Library / Tool Plugin (Build Compiler integration layer)  
**Performance Goals**: `search_components` returns results in <50ms on commodity hardware  
**Constraints**: <50ms p95 latency; fully deterministic (pre-fetched data); no runtime API calls  
**Scale/Scope**: ~400-1600 real PhongVu products across 8 types (50-200 per type)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Check 1: OpenClaw Session Ownership**
- ✅ PASS: Adapter is a plugin tool, stateless `search_components` function. No session/memory layer build by feature — OpenClaw Gateway owns runtime.

**Check 2: Build Compiler = Deterministic Trust Layer**
- ✅ PASS: `search_components` is pure function, fully unit-testable. Filter logic has no LLM calls. Satisfies "deterministic = trust layer".

**Check 3: Model = Provider Config**
- ✅ PASS: Teko Discovery API token is config in `~/.openclaw/openclaw.json` (provider layer, build-time only). No LLM orchestration, no LangChain. Feature is pre-fetched data + filtering.

**Check 4: WebChat = Channel Primary**
- ✅ PASS: Adapter is server-side only; channel concern is orthogonal.

**Check 5: Docs Tiếng Việt + English Thuật Ngữ**
- ✅ PASS: Spec and design artifacts will follow this convention. Code uses English; docs/ADRs tiếng Việt with English technical terms.

## Project Structure

### Documentation (this feature)

```text
specs/002-mock-catalog-adapter/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── search-api.md    # API contract for search_components()
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/catalog/                      # Catalog adapter package
├── src/
│   ├── index.ts                        # Main export (search_components)
│   ├── search.ts                       # search_components() implementation
│   ├── types.ts                        # Component, SearchCriteria, SearchResult types
│   ├── data-loader.ts                  # Load pre-fetched JSON catalog files
│   ├── phongvu-transformer.ts          # Transform PhongVu API response to Component schema
│   ├── filters/
│   │   ├── index.ts                    # Filter composition
│   │   ├── socket.ts                   # Socket filtering (exact + array match)
│   │   ├── price.ts                    # Price range filtering
│   │   ├── stock.ts                    # Stock status filtering
│   │   ├── form-factor.ts              # Form factor hierarchy (cases) and exact match
│   │   ├── ram-gen.ts                  # RAM generation filtering
│   │   ├── clearance.ts                # GPU/case clearance range filtering
│   │   └── tdp-wattage.ts              # TDP and wattage range filtering
│   └── data/
│       ├── phongvu-catalog-cpu.json     # Pre-fetched CPUs (real PhongVu data)
│       ├── phongvu-catalog-mainboard.json
│       ├── phongvu-catalog-ram.json
│       ├── phongvu-catalog-psu.json
│       ├── phongvu-catalog-cooler.json
│       ├── phongvu-catalog-case.json
│       ├── phongvu-catalog-storage.json
│       └── phongvu-catalog-gpu.json
│
├── scripts/
│   ├── fetch-phongvu-catalog.sh        # Build script: crawl PhongVu API for each type, generate JSON
│   └── fetch-phongvu-catalog.ts        # TypeScript transformer for PhongVu API response
│
├── tests/
│   ├── unit/
│   │   ├── filters/
│   │   │   ├── socket.test.ts
│   │   │   ├── price.test.ts
│   │   │   ├── stock.test.ts
│   │   │   ├── form-factor.test.ts
│   │   │   ├── ram-gen.test.ts
│   │   │   ├── clearance.test.ts
│   │   │   └── tdp-wattage.test.ts
│   │   ├── search.test.ts              # Unit tests for search_components()
│   │   ├── phongvu-transformer.test.ts # Test API response parsing
│   │   └── data-determinism.test.ts    # Determinism verification (100 iterations)
│   ├── integration/
│   │   └── compiler-integration.test.ts # Build Compiler integration
│   └── contract/
│       └── search-api.test.ts          # Contract-driven tests (verify API spec)
│
├── package.json
└── tsconfig.json
```

**Data Flow**:
1. **Build time**: `npm run fetch:phongvu` → runs `scripts/fetch-phongvu-catalog.sh` → calls Teko API for each component type → transforms response → saves to `src/data/phongvu-catalog-<type>.json`
2. **Runtime**: `search_components()` → loads JSON files via `data-loader.ts` → applies filters → returns results
3. **Testing**: Pre-fetched JSON data is committed to repo; tests verify filtering logic and determinism

**Structure Decision**: Single monolithic package (`packages/catalog/`). Catalog adapter is a library/plugin with pure functions (search_components) for integration with Build Compiler. Pre-fetched real PhongVu data cached in JSON files (deterministic, no runtime API calls). Tests organized by type (unit filters, API transformer, integration, contract).

## Complexity Tracking

**No Constitution violations** — all 5 principles satisfied without deviation.
