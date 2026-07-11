# Quickstart: Catalog Adapter Validation

**Phase 1 Output** | **Date**: 2026-07-11

This guide provides runnable validation scenarios to prove the feature works end-to-end.

## Prerequisites

- Node.js 18+
- TypeScript compiler (tsc)
- Jest test runner
- Apify account with credentials in `~/.openclaw/openclaw.json` (or mock fallback available)

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Verify Apify credentials** (optional; mock fallback available):
   ```bash
   # Check ~/.openclaw/openclaw.json contains apify endpoint and token
   cat ~/.openclaw/openclaw.json | grep -i apify
   ```

3. **Build the adapter**:
   ```bash
   npm run build
   ```

## Validation Scenarios

### Scenario 1: Search for Compatible CPUs (P1 - Critical)

**Objective**: Verify socket filtering works correctly.

**Setup**:
```typescript
import { searchComponents } from './src/catalog-adapter'

const criteria = {
  type: "CPU",
  socket: "AM5"
}

const result = searchComponents(criteria)
```

**Expected Outcome**:
- ✅ All returned components have `type === "CPU"`
- ✅ All returned components have `socket === "AM5"`
- ✅ Result includes at least 5 components (mock minimum per type)
- ✅ Latency < 50ms

**Test Command**:
```bash
npm test -- --testNamePattern="CPU socket filtering"
```

---

### Scenario 2: Price Range Filtering (P2)

**Objective**: Verify price_min and price_max filters work correctly.

**Setup**:
```typescript
const criteria = {
  type: "CPU",
  price_min: 3000000,
  price_max: 8000000
}

const result = searchComponents(criteria)
```

**Expected Outcome**:
- ✅ All returned CPUs have `price >= 3000000`
- ✅ All returned CPUs have `price <= 8000000`
- ✅ No components with price outside range are returned
- ✅ Returns empty array if min > max (edge case)

**Test Command**:
```bash
npm test -- --testNamePattern="price range filtering"
```

---

### Scenario 3: Stock Status Filtering (P2)

**Objective**: Verify only in-stock components are returned when filtering by stock_status.

**Setup**:
```typescript
const criteria = {
  type: "GPU",
  stock_status: "in_stock"
}

const result = searchComponents(criteria)
```

**Expected Outcome**:
- ✅ All returned GPUs have `stock_status === "in_stock"`
- ✅ No out-of-stock GPUs are returned
- ✅ At least 1 in-stock GPU per type (mock minimum)

**Test Command**:
```bash
npm test -- --testNamePattern="stock status filtering"
```

---

### Scenario 4: RAM Generation Matching (P2)

**Objective**: Verify mainboard RAM generation filtering.

**Setup**:
```typescript
const criteria = {
  type: "mainboard",
  ram_gen: "DDR5"
}

const result = searchComponents(criteria)
```

**Expected Outcome**:
- ✅ All returned mainboards have `ram_gen === "DDR5"`
- ✅ No DDR4 mainboards are returned
- ✅ Returns empty array if no DDR5 mainboards exist

**Test Command**:
```bash
npm test -- --testNamePattern="RAM generation filtering"
```

---

### Scenario 5: Case Form Factor Hierarchy (P3)

**Objective**: Verify hierarchical form_factor matching for cases.

**Setup**:
```typescript
const criteria = {
  type: "case",
  form_factor: "mATX",
  clearance_mm: 280
}

const result = searchComponents(criteria)
```

**Expected Outcome**:
- ✅ Returns mATX cases with clearance >= 280mm
- ✅ Returns ATX cases with clearance >= 280mm (larger size fits)
- ✅ Does NOT return ITX cases (smaller size doesn't fit)
- ✅ All returned cases satisfy: form_factor >= mATX AND clearance_mm >= 280

**Test Command**:
```bash
npm test -- --testNamePattern="case form factor hierarchy"
```

---

### Scenario 6: Multi-Criteria Combined Search (P1 - Critical)

**Objective**: Verify AND logic across multiple criteria.

**Setup**:
```typescript
const criteria = {
  type: "mainboard",
  socket: "AM5",
  ram_gen: "DDR5",
  price_max: 5000000,
  stock_status: "in_stock"
}

const result = searchComponents(criteria)
```

**Expected Outcome**:
- ✅ All returned mainboards satisfy ALL 5 criteria
- ✅ No component fails any single criterion
- ✅ Returns empty array if no component matches all criteria
- ✅ If result is non-empty: each component has socket="AM5" AND ram_gen="DDR5" AND price<=5M AND stock_status="in_stock"

**Test Command**:
```bash
npm test -- --testNamePattern="multi-criteria AND logic"
```

---

### Scenario 7: Mock Data Determinism (P1 - Critical)

**Objective**: Verify mock search results are deterministic (100% reproducibility).

**Setup**:
```typescript
const criteria = {
  type: "CPU",
  socket: "AM5",
  price_max: 10000000
}

const results = []
for (let i = 0; i < 100; i++) {
  results.push(searchComponents(criteria))
}

// Verify all 100 results are identical
```

**Expected Outcome**:
- ✅ Running search 100 times with same criteria returns identical results
- ✅ Component order is stable (same order every time)
- ✅ No non-deterministic behavior (randomization, timing, etc.)

**Test Command**:
```bash
npm test -- --testNamePattern="mock determinism"
```

---

### Scenario 8: Live Data Ordering (if Apify available)

**Objective**: Verify live results are sorted by price ascending.

**Setup**:
```typescript
const criteria = {
  type: "CPU"
}

const result = searchComponents(criteria)
// Assuming live fetch succeeds
```

**Expected Outcome**:
- ✅ Results are sorted by price ascending (lowest first)
- ✅ result.components[i].price <= result.components[i+1].price for all i
- ✅ If live fetch fails, falls back to mock (deterministic)

**Test Command**:
```bash
npm test -- --testNamePattern="live data ordering"
```

---

### Scenario 9: Per-Category Fallback (Integration)

**Objective**: Verify per-category fallback behavior when live fetch fails.

**Setup**:
1. Simulate Apify timeout for CPU type only
2. Leave GPU/RAM/etc. to fetch normally

```typescript
const criteria = {
  type: "CPU"
}
const cpuResult = searchComponents(criteria)

const gpuCriteria = {
  type: "GPU"
}
const gpuResult = searchComponents(gpuCriteria)
```

**Expected Outcome**:
- ✅ CPU results are from mock (timeout fallback)
- ✅ GPU results are from live (fetch succeeded)
- ✅ Other types independently succeed or fall back as needed
- ✅ Determinism preserved for mock; fresh live data for GPU

**Test Command**:
```bash
npm test -- --testNamePattern="per-category fallback"
```

---

## End-to-End Test Flow

**Full validation sequence**:
```bash
# 1. Run all unit tests
npm test

# 2. Verify latency with perf benchmark
npm run bench

# 3. Check mock determinism
npm test -- --testNamePattern="determinism"

# 4. Run type checking
npm run tsc

# 5. Verify integration with Build Compiler
npm test -- --testNamePattern="compiler-integration"
```

## Success Criteria

- [ ] All unit tests pass (`npm test` exits with code 0)
- [ ] Latency < 50ms (verified by perf benchmarks)
- [ ] Mock determinism verified (100 iterations identical)
- [ ] Type checking passes (`tsc` with no errors)
- [ ] All 8 component types have >= 5 mock entries
- [ ] All 8 types have >= 1 in-stock and >= 1 out-of-stock entry
- [ ] Compiler integration tests pass (calls search_components without errors)
- [ ] Edge cases handled correctly (empty criteria, contradictory bounds, etc.)

## Debugging

### Check mock data structure:
```bash
cat src/data/mock-catalog.json | jq '.components | group_by(.type) | map({type: .[0].type, count: length})'
```

### Test single search manually:
```bash
npm run test:manual -- --criteria '{"type":"CPU","socket":"AM5"}'
```

### View Apify config:
```bash
cat ~/.openclaw/openclaw.json | jq '.apify'
```

### Monitor fetch timeout:
```bash
npm test -- --testNamePattern="timeout" --verbose
```

## References

- [API Contract](./contracts/search-api.md) — Full `search_components()` specification
- [Data Model](./data-model.md) — Component entity, SearchCriteria, filtering rules
- [spec.md](./spec.md) — Feature specification and user stories
- [research.md](./research.md) — Technical research and design rationale
