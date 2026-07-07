# Quickstart: Build Compiler Deterministic Core

**Branch**: `001-build-compiler-core` | **Date**: 2026-07-07
**Mục đích**: verify Compiler core standalone (FR-011) — không cần OpenClaw, không cần chat, không cần network.
**Clarifications propagated**: storage required (smoke test phải có storage else E003), PSU excluded from TDP sum.

## Prerequisite

- Node.js ≥ 22.17 LTS (`node -v` → `v22.17.0` hoặc mới hơn).
- Repo cloned, ở branch `001-build-compiler-core`.

## Verify standalone (FR-011 / SC-003)

```powershell
# Từ repo root
cd packages\compiler
npm install        # cài dev deps: typescript, tsx, @types/node
npm test           # chạy node:test qua tsx — ~15 test, 5 rule × ~3 case + missing/repair/validate
```

**Expected**: tất cả test pass, exit code 0. Output dạng:
```text
ℹ tests 15
ℹ suites 8
ℹ pass 15
ℹ fail 0
```

> `npm test` = Constitution Quality Gate (phải xanh trước demo — ADR-0003 §3 HOUR 3-6).
> Test suites: socket / ram-gen / missing (7-type incl. storage) / cooler / form-factor / psu (TDP excl. PSU) / repair / validate.

## Verify type safety (optional, recommended trước demo)

```powershell
cd packages\compiler
npm run typecheck   # tsc --noEmit, strict mode
```

**Expected**: 0 error. TypeScript enforce `ErrorCode` union (E001-E006, W001), `Component` discriminated union (7 types incl. Storage), pure-function signatures compile-time. PSU schema có NO `tdp` field và NO `efficiency_rating` field — type enforce prevents malformed catalog data leaking.

## Smoke test (chạy 1 build thủ công với đủ 7 loại bắt buộc)

```typescript
// scripts/smoke.ts (tạo khi implement, không phải plan artifact)
import { compileBuild } from "../src/index.js";

// Build có E001 (socket mismatch) + đủ 7 loại bắt buộc (incl. storage)
const result = compileBuild({
  components: [
    { type: "cpu", id: "cpu1", socket: "LGA1700", ram_gen_supported: ["DDR4","DDR5"], tdp: 65 },
    { type: "mainboard", id: "mb1", socket: "AM5", ram_gen_supported: ["DDR5"], form_factor: "ATX" },
    { type: "ram", id: "ram1", generation: "DDR5", tdp: 9 },
    { type: "psu", id: "psu1", wattage: 650, form_factor: "ATX" },   // no tdp field on PSU
    { type: "cooler", id: "cool1", height: 155 },
    { type: "case", id: "case1", max_cooler_height: 165,
      supported_mb_form_factors: ["ATX","mATX"], supported_psu_form_factors: ["ATX"] },
    { type: "storage", id: "ssd1", tdp: 5 },   // required (E003 if missing) — no capacity check
  ],
});
console.log(JSON.stringify(result, null, 2));
// Expect: errors[0].code === "E001", is_valid === false, repair_plan[0].error_code === "E001"
// (TDP total excl. PSU = 65+9+5 = 79; × 1.2 = 94.8; PSU 650 >> 94.8 → no W001)
```

```powershell
cd packages\compiler
npx tsx scripts\smoke.ts
```

## Smoke test — missing storage triggers E003 (clarification Q1 verify)

```typescript
// Build thiếu storage → E003 cho storage (boot-completeness)
const result = compileBuild({
  components: [
    // ... 6 types (cpu, mainboard, ram, psu, cooler, case) — all valid
    // storage MISSING
  ],
});
// Expect: errors[?].code === "E003", component_refs includes "type:storage"
```

## Smoke test — PSU tdp excluded from TDP sum (clarification Q5 verify)

```typescript
// Malformed catalog: PSU có tdp:50 (sai schema — PSU không nên có tdp)
// TDP sum MUST exclude PSU tdp; if included → sum inflated → false W001
const result = compileBuild({
  components: [
    { type: "cpu", id: "c1", socket: "AM5", ram_gen_supported: ["DDR5"], tdp: 100 },
    // ... mainboard, ram, cooler, case, storage all valid
    { type: "psu", id: "p1", wattage: 150, form_factor: "ATX", tdp: 50 },  // malformed: PSU has tdp
  ],
});
// TDP total excl. PSU = 100 (just CPU; others no tdp) → required = 120; PSU 150 > 120 → no W001
// If PSU tdp were wrongly included: total = 150 → required = 180; PSU 150 < 180 → false W001
// Test verifies PSU tdp EXCLUDED → no W001 (correct behavior)
```

## Round-trip repair verify (SC-002)

```typescript
// tests/repair.test.ts (1 trong ~15 test)
// 1. detectErrors(build) → errors
// 2. repairBuild(build, errors) → plan
// 3. apply 1 fix/error → mutatedBuild
// 4. detectErrors(mutatedBuild) → original error biến mất
```

Test tự động verify round-trip — không cần bước thủ công.

## What this quickstart does NOT cover

- OpenClaw tool plugin wire-up (`api.registerTool`) = feature sau (HOUR 8-10).
- Catalog integration (`search_components` resolve SKU từ repair constraint) = feature sau.
- WebChat / DOM exec = feature khác.
- Monitor↔GPU performance suggestion = LLM layer, không phải Compiler (clarification Q2).
- PSU efficiency rating advisory = LLM layer, không phải Compiler (clarification Q4).
- Demo flow S1→S3 = rehearse ở HOUR 12-14.

Compiler core = trust layer verify độc lập trước, wire-up sau.
