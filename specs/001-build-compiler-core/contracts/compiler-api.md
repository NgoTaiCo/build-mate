# Contract: Build Compiler Public API

**Branch**: `001-build-compiler-core` | **Date**: 2026-07-07
**Project type**: library (pure functions, in-process) — contract = function signatures + I/O schemas, NOT REST endpoints.
**Consumers**: OpenClaw tool plugin (feature wire-up sau, ADR-0003 HOUR 8-10) gọi `@buildmate/compiler` làm dependency. Test suite gọi trực tiếp.
**Clarifications propagated**: storage trong required-set (Q1), monitor↔GPU & PSU rating out-of-scope (Q2, Q4), TDP sum excludes PSU (Q3, Q5).

## Public API surface

Package `@buildmate/compiler` export 3 function (barrel `src/index.ts`):

```typescript
export function compileBuild(build: Build): CompilerResult;
export function detectErrors(build: Build): CompilerError[];
export function repairBuild(build: Build, errors: CompilerError[]): RepairPlan[];
```

> Tất cả function pure: không side-effect, không I/O, không dependency ngoài Node stdlib. Same input → same output (FR-009).

---

## 1. `compileBuild(build)` → `CompilerResult`

**Mục đích**: Entry point chính — validate build + sinh repair plan trong 1 call. S1 demo (ADR-0003 §2.1) gọi function này.

**Input**: `Build` (xem `data-model.md` §1).
```typescript
interface Build {
  components: Component[];   // heterogeneous, discriminated by `type` (7 types incl. storage)
}
```

**Output**: `CompilerResult` (xem `data-model.md` §5).
```typescript
interface CompilerResult {
  errors: CompilerError[];     // all errors + warnings, severity-tagged
  repair_plan: RepairPlan[];   // 1:1 with errors (empty if errors empty)
  is_valid: boolean;           // = !errors.some(e => e.severity === "error")
}
```

**Contract**:
- `repair_plan.length === errors.length` (1:1 mapping, FR-008).
- `is_valid === true` iff no error-severity error (warning OK).
- Deterministic: same `build` → same `CompilerResult` byte-for-byte (FR-009).
- Không throw trên malformed input (thiếu thuộc tính, unknown type) — trả `E006`/skip. Throw CHỈ trên structurally invalid `build` (vd. `build` không phải object, `components` không phải array) = caller bug, not build error.

**Example** (with storage — clarification Q1):
```typescript
const result = compileBuild({
  components: [
    { type: "cpu", id: "cpu1", socket: "LGA1700", ram_gen_supported: ["DDR4","DDR5"], tdp: 65 },
    { type: "mainboard", id: "mb1", socket: "AM5", ram_gen_supported: ["DDR5"], form_factor: "ATX" },
    { type: "ram", id: "ram1", generation: "DDR5" },
    { type: "psu", id: "psu1", wattage: 650, form_factor: "ATX" },
    { type: "cooler", id: "cool1", height: 155 },
    { type: "case", id: "case1", max_cooler_height: 165,
      supported_mb_form_factors: ["ATX","mATX"], supported_psu_form_factors: ["ATX"] },
    { type: "storage", id: "ssd1" },   // storage required (E003 if missing) — no capacity check
  ],
});
// result.errors[0] = { code: "E001", severity: "error", name: "SOCKET_MISMATCH",
//   message: "CPU socket LGA1700 không khớp mainboard socket AM5",
//   component_refs: ["cpu1","mb1"], details: { expected: "AM5", actual: "LGA1700" } }
// result.is_valid === false
// result.repair_plan[0] = { error_code: "E001", fixes: [
//   { changes: [{ component_ref: "cpu1", attribute: "socket", target_value: "AM5" }], strategy: "replace_component" },
//   { changes: [{ component_ref: "mb1", attribute: "socket", target_value: "LGA1700" }], strategy: "replace_component" },
// ], rationale: "Đồng bộ socket CPU↔mainboard" }
```

**Example** (TDP sum excludes PSU — clarification Q5):
```typescript
// Build: CPU tdp=65, GPU tdp=220, RAM tdp=9 (×2 sticks=18), storage tdp=5, PSU wattage=550
// TDP total excl. PSU = 65 + 220 + 18 + 5 = 308; × 1.2 = 369.6; PSU 550 > 369.6 → no W001
// (PSU's own tdp, even if malformed catalog declares it, is EXCLUDED from sum)
const result = compileBuild({ components: [
  { type: "cpu", id: "c1", socket: "AM5", ram_gen_supported: ["DDR5"], tdp: 65 },
  { type: "mainboard", id: "m1", socket: "AM5", ram_gen_supported: ["DDR5"], form_factor: "ATX" },
  { type: "ram", id: "r1", generation: "DDR5", tdp: 9 },
  { type: "ram", id: "r2", generation: "DDR5", tdp: 9 },
  { type: "gpu", id: "g1", tdp: 220 },
  { type: "psu", id: "p1", wattage: 550, form_factor: "ATX" },  // no tdp field on PSU
  { type: "cooler", id: "cl1", height: 155 },
  { type: "case", id: "cs1", max_cooler_height: 165, supported_mb_form_factors: ["ATX"], supported_psu_form_factors: ["ATX"] },
  { type: "storage", id: "s1", tdp: 5 },
]});
// result.is_valid === true, result.errors === [] (all pass)
```

---

## 2. `detectErrors(build)` → `CompilerError[]`

**Mục đích**: Chỉ validate, không sinh repair plan. Dùng khi caller chỉ cần biết lỗi (vd. streaming "đang kiểm tra..." trước khi repair). S3 demo (ADR-0003 §2.1) gọi function này trước `repairBuild`.

**Input**: `Build` (như §1).

**Output**: `CompilerError[]` (xem `data-model.md` §3). Rỗng nếu build OK.

**Contract**:
- Tương đương `compileBuild(build).errors` — cùng rule, cùng order, cùng content.
- Không throw trên malformed build data — trả `E006`/skip.
- Deterministic.

**Relationship**: `compileBuild(build) === { errors: detectErrors(build), repair_plan: repairBuild(build, detectErrors(build)), is_valid: !detectErrors(build).some(e => e.severity === "error") }`. Implement có thể share `validate.ts` internal.

---

## 3. `repairBuild(build, errors)` → `RepairPlan[]`

**Mục đích**: Sinh repair plan từ build + errors đã detect. Cho caller muốn tách 2 phase (detect → hiển thị → repair theo yêu cầu user).

**Input**:
```typescript
interface RepairBuildInput {
  build: Build;            // build gốc (cần để biết alternative fix khả thi)
  errors: CompilerError[]; // từ detectErrors hoặc compileBuild
}
```
> Signature thực: `repairBuild(build: Build, errors: CompilerError[]): RepairPlan[]`. `build` cần vì fix alternative phụ thuộc linh kiện hiện có (vd. `E001` có 2 fix: đổi CPU hoặc đổi mainboard — cả 2 khả thi nếu cả 2 linh kiện đều có).

**Output**: `RepairPlan[]` (xem `data-model.md` §4). 1:1 với `errors`.

**Contract**:
- `repair_plan.length === errors.length` — mỗi error có ≥1 RepairPlan (FR-008).
- Mỗi `Fix` chứa ≥1 `Change` chỉ ra `component_ref` + `attribute` + `target_value` (constraint, không SKU — research §3).
- ≥1 alternative fix cho mỗi error (OR semantics): áp dụng bất kỳ fix nào trong `fixes[]` đều giải quyết lỗi.
- **Round-trip invariant**: apply đầy đủ 1 fix/error vào build → `detectErrors` re-validate → error đó biến mất (SC-002, test verify).
- `errors` rỗng → trả `[]` (SC-006).
- Deterministic.

**Example** (E003 missing storage — clarification Q1):
```typescript
const plan = repairBuild(build, [
  { code: "E003", severity: "error", name: "MISSING_COMPONENT",
    message: "Build thiếu storage (không cài OS được)",
    component_refs: ["type:storage"], details: { missing_type: "storage" } },
]);
// plan[0] = { error_code: "E003", fixes: [
//   { changes: [{ component_ref: "type:storage", attribute: "type", target_value: "storage" }],
//     strategy: "replace_component", note: "Thêm ≥1 storage (bất kỳ SSD/HDD/NVMe) — không yêu cầu capacity tối thiểu" },
// ], rationale: "Storage bắt buộc cho boot-completeness (cài OS)" }
```

**Example** (W001 PSU tight — clarification Q3+Q5):
```typescript
// TDP total excl. PSU = 600W; PSU wattage = 650W; 650 < 600×1.2=720 → W001
const plan = repairBuild(build, [
  { code: "W001", severity: "warning", name: "PSU_TIGHT",
    message: "PSU 650W thấp hơn TDP tổng 600W + headroom 20% (cần ≥720W)",
    component_refs: ["psu1"], details: { tdp_total_excl_psu: 600, required_wattage: 720, actual_wattage: 650 } },
]);
// plan[0] = { error_code: "W001", fixes: [
//   { changes: [{ component_ref: "psu1", attribute: "wattage", target_value: 720 }],
//     strategy: "replace_component", note: "Tăng PSU wattage ≥720W (TDP tổng excl. PSU × 1.2)" },
// ], rationale: "Đảm bảo PSU có headroom cho load peak/OC" }
// Note: efficiency rating (Gold/White) KHÔNG can thiệp — W001 so DC wattage only (clarification Q4)
```

---

## 4. Error code stability guarantee (cross-cutting)

| Code | Stable | Caller may branch on |
|---|---|---|
| `E001`-`E006`, `W001` | YES — code string + name không đổi cross version (semver: thêm code mới OK, không rename existing) | `error.code === "E001"`, `error.severity === "error"` |

Caller (OpenClaw agent) có thể dùng `code` để:
1. Display error deterministic (template message per code).
2. Route repair (1 fix per code family).
3. Decide chặn vs cho qua (`severity`).

**Breaking change policy**: thêm code mới = MINOR; rename/redefine code/severity mapping = MAJOR (Constitution Governance semver).

---

## 5. Non-goals (out of contract — clarifications Q2, Q4 explicit)

- KHÔNG resolve SKU (Catalog tool làm — research §3).
- KHÔNG gọi LLM (Principle II — deterministic only).
- KHÔNG persist build/result (pure, no storage — FR-011).
- KHÔNG RGB sync, aesthetic matching, price optimization (FR-013).
- KHÔNG monitor↔GPU performance matching (clarification Q2 — 4K/ultrawide vs GPU driving power = LLM suggestion layer, không deterministic; no `Monitor` entity in Component union).
- KHÔNG PSU efficiency rating check (clarification Q4 — 80 Plus White/Gold/Platinum = AC→DC transfer semantics, không đổi DC capacity; no `efficiency_rating` field on PSU schema).
- KHÔNG storage capacity check (clarification Q1 — storage required for E003 but no minimum capacity; capacity = use-case dependent, LLM suggest).
- KHÔNG handle OpenClaw session/tool registration (wire-up feature sau — HOUR 8-10 ADR-0003).
