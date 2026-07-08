# Quickstart: Component Comparison Tool

**Branch**: `007-compare-components` | **Date**: 2026-07-08
**Mục đích**: verify comparator deterministic logic standalone — không cần OpenClaw, không cần chat, không cần network (nếu dùng mock catalog).
**Dependency**: Feature này là S2 stretch. Chỉ chạy quickstart sau khi 001 (compiler), 002 (catalog), và 003 (openclaw-tools wiring) hoàn thành.

## Prerequisite

- Node.js ≥ 22.17 LTS (`node -v`).
- Repo cloned, ở branch `007-compare-components`.
- `packages/catalog/` và `packages/openclaw-tools/` đã setup (từ feature 002 và 003).

## Verify comparator standalone

```powershell
# Từ repo root
cd packages\comparator
npm install        # cài dev deps: typescript, tsx, @types/node
npm test           # chạy node:test qua tsx — ~8 unit test
```

**Expected**: tất cả test pass, exit code 0. Output dạng:

```text
ℹ tests 8
ℹ suites 3
ℹ pass 8
ℹ fail 0
```

> `npm test` = Constitution Quality Gate cho deterministic logic (phải xanh trước demo).
> Test suites: compare (table fields, missing data, category mismatch), score (gaming/productivity/budget winners), validate (SKU count, invalid use case).

## Verify type safety (optional, recommended)

```powershell
cd packages\comparator
npm run typecheck   # tsc --noEmit, strict mode
```

**Expected**: 0 error. TypeScript enforce `CompareInput`, `ComparisonTable`, `Recommendation`, `CompareErrorCode`.

## Smoke test — compare 3 CPUs

```typescript
// packages/comparator/scripts/smoke.ts
create hoặc chạy inline
import { compareComponents } from "../src/index.js";
import { searchComponents } from "@buildmate/catalog";

const result = compareComponents(
  { skus: ["cpu-001", "cpu-002", "cpu-003"], use_case: "gaming" },
  (criteria) => searchComponents(criteria)
);

console.log(JSON.stringify(result, null, 2));
// Expect: table.rows.length === 3, recommendation.winner_sku là CPU có tdp cao nhất trong stock
```

```powershell
cd packages\comparator
npx tsx scripts\smoke.ts
```

## Smoke test — category mismatch error

```typescript
const result = compareComponents(
  { skus: ["cpu-001", "gpu-001"] },
  (criteria) => searchComponents(criteria)
);
// Expect: errors[0].code === "C004", table.rows rỗng
```

## Verify tool plugin registration (after 003 done)

```powershell
# Từ repo root
cd packages\openclaw-tools
npm test
# Expect: compare-components-tool.test.ts pass
```

## Runtime end-to-end (gateway)

```powershell
# 1. Link comparator package
openclaw plugins install --link ./packages/comparator

# 2. Rebuild/restart gateway
openclaw gateway

# 3. Verify tool discoverable
openclaw plugins inspect buildmate-tools --runtime --json
# Expect JSON contains tool "compare_components"

# 4. WebChat test
# Chat: "So sánh CPU cpu-001, cpu-002, cpu-003 cho gaming"
# Expect: agent gọi compare_components và trả bảng so sánh + gợi ý best-fit
```

## What this quickstart does NOT cover

- Prose generation quality (do LLM layer đảm nhiệm — test qualitative qua WebChat).
- Live Apify catalog (mock fallback đủ cho quickstart).
- DOM execution / checkout guide (feature khác).
