# Data Model: Build Compiler Deterministic Core

**Branch**: `001-build-compiler-core` | **Date**: 2026-07-07
**Source**: spec.md Key Entities + research.md §1-§12 (incl. clarification decisions §9-§12)
**Implementation note**: types dưới đây = TypeScript type definitions (type-level contract). Không có persistence — pure in-memory data structures.

## Entities Overview

```text
Build ──┬── Component[] (heterogeneous, discriminated by `type`)
        │
CompilerResult ──┬── CompilerError[] (errors + warnings together, severity-tagged)
                 └── RepairPlan[]    (1:1 with each error)
```

---

## 1. Build (input root)

Trường | Kiểu | Bắt buộc | Mô tả
---|---|---|---
`components` | `Component[]` | yes | Tập linh kiện. Array (research §5) — hỗ trợ multi-instance (2-4 RAM stick, multi-GPU). Có thể rỗng (→ `E003` cho mọi loại bắt buộc — 7 loại).

**Validation rules**:
- `components` phải là array. Rỗng = hợp lệ về shape nhưng trigger `E003` cho 7 loại bắt buộc.
- Không có count limit — multi-instance OK.
- Build không có ID/version ở core (caller pass-through; core chỉ care components).

---

## 2. Component (discriminated union by `type`)

Component = union của 7 type-specific shape. Mỗi shape có `type` discriminator + thuộc tính riêng. research §4: thiếu thuộc tính bắt buộc cho rule → `E006 MISSING_ATTRIBUTE`.

### 2.1 CPU

Trường | Kiểu | Bắt buộc | Rule dùng
---|---|---|---
`type` | `"cpu"` | yes | discriminator
`id` | `string` | yes | ref cho error/repair (caller-provided, core chỉ pass-through)
`socket` | `string` | yes (E001) | vd. `"LGA1700"`, `"AM5"`. Thiếu → E006 cho socket rule.
`ram_gen_supported` | `string[]` | yes (E002) | CPU IMC hỗ trợ: `["DDR4"]`, `["DDR4","DDR5"]` (12th gen flex). Thiếu → E006.
`tdp` | `number` (watts) | yes (W001) | TDP CPU. Thiếu → E006 cho PSU rule (không tính được TDP tổng).

### 2.2 Mainboard

Trường | Kiểu | Bắt buộc | Rule dùng
---|---|---|---
`type` | `"mainboard"` | yes | discriminator
`id` | `string` | yes | ref
`socket` | `string` | yes (E001) | vd. `"AM5"`. Thiếu → E006.
`ram_gen_supported` | `string[]` | yes (E002) | Mainboard hỗ trợ (thường = 1 gen). Thiếu → E006.
`form_factor` | `string` | yes (E005) | vd. `"ATX"`, `"mATX"`, `"ITX"`. Thiếu → E006.

### 2.3 RAM

Trường | Kiểu | Bắt buộc | Rule dùng
---|---|---|---
`type` | `"ram"` | yes | discriminator
`id` | `string` | yes | ref
`generation` | `string` | yes (E002) | vd. `"DDR4"`, `"DDR5"`. Thiếu → E006.
`tdp` | `number` (watts) | no | Optional — nếu có (>0), tính vào TDP tổng (research §11). RAM stick TDP nhỏ (~3-5W).

### 2.4 PSU

Trường | Kiểu | Bắt buộc | Rule dùng
---|---|---|---
`type` | `"psu"` | yes | discriminator
`id` | `string` | yes | ref
`wattage` | `number` (watts) | yes (W001) | Vd. `650`. Thiếu → E006.
`form_factor` | `string` | yes (E005) | Vd. `"ATX"`, `"SFX"`. Thiếu → E006.

> **KHÔNG có trường `tdp`** trên PSU (research §11, §12): PSU cấp điện (source), không tải DC (load);功耗 PSU = AC inefficiency đã loại khỏi W001 scope. Ngăn data sai từ catalog trigger non-deterministic branch. **KHÔNG có trường `efficiency_rating`** (research §12): rating = AC→DC transfer semantics, không thuộc deterministic core; nếu catalog có, caller (LLM) consume, không pass vào Compiler.

### 2.5 Cooler

Trường | Kiểu | Bắt buộc | Rule dùng
---|---|---|---
`type` | `"cooler"` | yes | discriminator
`id` | `string` | yes | ref
`height` | `number` (mm) | yes (E004) | Chiều cao cooler. Thiếu → E006.

### 2.6 Case

Trường | Kiểu | Bắt buộc | Rule dùng
---|---|---|---
`type` | `"case"` | yes | discriminator
`id` | `string` | yes | ref
`max_cooler_height` | `number` (mm) | yes (E004) | Case clearance max. Thiếu → E006.
`supported_mb_form_factors` | `string[]` | yes (E005) | Vd. `["ATX","mATX","ITX"]`. Thiếu → E006.
`supported_psu_form_factors` | `string[]` | yes (E005) | Vd. `["ATX","SFX"]`. Thiếu → E006.

### 2.7 Storage (NEW — clarification Q1, research §9)

Trường | Kiểu | Bắt buộc | Rule dùng
---|---|---|---
`type` | `"storage"` | yes | discriminator
`id` | `string` | yes | ref (cho `E003` và pass-through)
`tdp` | `number` (watts) | no | Optional — nếu có (>0), tính vào TDP tổng (research §11). SSD ~5W, HDD ~10W.

> Storage **KHÔNG có thuộc tính compatibility** (no socket/gen/form-factor) — không thuộc 5 compatibility rule. Chỉ thuộc `E003` required-set (boot-completeness — research §9). Không yêu cầu capacity tối thiểu. Bất kỳ subtype (SSD/HDD/NVMe) đều OK — core không discriminate subtype.

### 2.8 GPU (optional — không thuộc 5 rule compatibility nhưng TDP tính)

Trường | Kiểu | Bắt buộc | Rule dùng
---|---|---|---
`type` | `"gpu"` | yes | discriminator
`id` | `string` | yes | ref
`tdp` | `number` (watts) | yes (W001) | TDP GPU (vd. 220). Thiếu → E006 cho PSU rule.

> **Mở rộng**: linh kiện khác (fans, optical drive...) có `type` khác 7 loại + gpu → core bỏ qua compatibility nhưng nếu có `tdp` (>0) thì tính vào tổng TDP (research §11). Unknown `type` không crash — skip compatibility rule + skip E003 (chỉ 7 loại bắt buộc).

---

## 3. CompilerError

Trường | Kiểu | Bắt buộc | Mô tả
---|---|---|---
`code` | `ErrorCode` (union literal) | yes | Mã ổn định (research §7). `"E001"` \| `"E002"` \| `"E003"` \| `"E004"` \| `"E005"` \| `"E006"` \| `"W001"`.
`severity` | `"error" \| "warning"` | yes | `E00x` = error (chặn), `W00x` = warning (không chặn).
`name` | `string` | yes | Tên ổn định vd. `"SOCKET_MISMATCH"`. Caller dùng để display/log.
`message` | `string` | yes | Người-đọc-được, deterministic (template từ dữ liệu, không LLM).
`component_refs` | `string[]` | yes | `id` của linh kiện gây lỗi (≥1; `E003` ref type chứ không ref id cụ thể → convention `["type:psu"]`).
`details` | `Record<string, unknown>` | no | Dữ liệu rule-specific (vd. `{ expected: "AM5", actual: "LGA1700" }`) để caller/repair plan dùng. Pure data, không function.

**Validation rules**:
- `code` ∈ union literal — TS enforce compile-time.
- `severity` consistent với prefix: `E*` → error, `W*` → warning (invariant, test verify).
- `message` deterministic: cùng input → cùng string (no Date.now(), no Math.random()).

---

## 4. RepairPlan

Trường | Kiểu | Bắt buộc | Mô tả
---|---|---|---
`error_code` | `ErrorCode` | yes | Mã lỗi fix này nhắm tới. 1:1 với 1 error.
`fixes` | `Fix[]` | yes | ≥1 alternative fix (OR semantics — áp dụng 1 là đủ). Mỗi fix = 1 way to resolve.
`rationale` | `string` | yes | Giải thích người-đọc-được vì sao fix này giải quyết lỗi.

### 4.1 Fix

Trường | Kiểu | Bắt buộc | Mô tả
---|---|---|---
`changes` | `Change[]` | yes | ≥1 attribute change. Multi-attribute khi đổi 1 linh kiện kéo theo nhiều thuộc tính phải khớp (vd. đổi CPU → socket + ram_gen_supported cùng phải khớp mainboard).
`strategy` | `"replace_component" \| "modify_attribute"` | yes | `replace` = thay linh kiện (Catalog resolve SKU sau); `modify` = chỉnh thuộc tính (hiếm, vd. demo "chọn CPU khác gen").
`note` | `string` | no | Ghi chú thêm cho caller/display.

### 4.2 Change

Trường | Kiểu | Bắt buộc | Mô tả
---|---|---|---
`component_ref` | `string` | yes | `id` linh kiện cần đổi.
`attribute` | `string` | yes | Tên thuộc tính cần đạt giá trị mới (vd. `"socket"`, `"wattage"`).
`target_value` | `string \| number \| string[]` | yes | Constraint giá trị cần đạt (research §3: constraint, không SKU). Vd. `"AM5"`, `750`, `["DDR5"]`. Cho `E001`: fix A target `cpu.socket = "AM5"`, fix B target `mainboard.socket = "LGA1700"`.

**Validation rules**:
- Mỗi `CompilerError` có ≥1 `RepairPlan` (FR-008: "fix cụ thể cho mỗi lỗi"). Map: `repair_plan.length === errors.length` (1:1).
- Apply fix xong re-validate → error biến mất (SC-002). Test verify.
- `target_value` = constraint, NOT SKU — pure, deterministic, không cần catalog.

---

## 5. CompilerResult (output root)

Trường | Kiểu | Bắt buộc | Mô tả
---|---|---|---
`errors` | `CompilerError[]` | yes | Tất cả lỗi + warning (severity-tagged). Rỗng nếu build OK.
`repair_plan` | `RepairPlan[]` | yes | 1:1 với `errors`. Rỗng nếu `errors` rỗng (SC-006).
`is_valid` | `boolean` | yes | Derived: `!errors.some(e => e.severity === "error")`. Convenience cho caller (warning-only build → `is_valid: true`).

---

## 6. ErrorCode catalog (stable codes — research §7, updated after clarifications)

Code | Name | Severity | Trigger
---|---|---|---
`E001` | `SOCKET_MISMATCH` | error | `cpu.socket !== mainboard.socket`
`E002` | `RAM_GEN_MISMATCH` | error | `ram.generation` ∉ `cpu.ram_gen_supported` OR ∉ `mainboard.ram_gen_supported` (mọi stick)
`E003` | `MISSING_COMPONENT` | error | không có component type ∈ **{cpu, mainboard, ram, psu, cooler, case, storage}** (7 loại — research §9)
`E004` | `COOLER_CLEARANCE_MISMATCH` | error | `cooler.height > case.max_cooler_height`
`E005` | `FORM_FACTOR_MISMATCH` | error | `mainboard.form_factor` ∉ `case.supported_mb_form_factors` OR `psu.form_factor` ∉ `case.supported_psu_form_factors`
`E006` | `MISSING_ATTRIBUTE` | error | component có nhưng thiếu thuộc tính rule cần
`W001` | `PSU_TIGHT` | warning | `psu.wattage < tdp_total_excl_psu * 1.2` (boundary `===` = pass). `tdp_total_excl_psu` = sum `tdp`>0 của component có `type !== "psu"` (research §11).

---

## 7. Rule execution order & invariants

- **Order**: `E003 MISSING_COMPONENT` → `E006 MISSING_ATTRIBUTE` → 5 compatibility/warning rule. Lý do: rule cần linh kiện + thuộc tính đủ mới chạy có nghĩa; thiếu thì lỗi structured đã báo, không chạy logic so sánh sinh lỗi ảo.
- **Invariant — all rules run**: không short-circuit ở lỗi đầu — spec edge case "trả TẤT CẢ lỗi". Mỗi rule độc lập, push error vào `errors[]`.
- **Invariant — TDP sum excludes PSU** (research §11): `rules/psu.ts` compute `tdp_total = components.filter(c => c.type !== "psu" && typeof c.tdp === "number" && c.tdp > 0).reduce((s, c) => s + c.tdp, 0)`. Test verify PSU `tdp` field (if malformed catalog) không vào sum.
- **Deterministic**: output order ổn định — rule chạy theo fixed order trong `validate.ts`, error trong 1 rule theo thứ tự component trong `components` array. Cùng input → cùng output (FR-009, test verify).

## 8. State transitions

Compiler KHÔNG có state (pure functions, no persistence). "State" duy nhất = input → output transformation:
- `Build` (input) → `CompilerResult` (output) — 1-way, immutable, no lifecycle.
- Repair workflow state (pending → applied → re-validated) = caller responsibility (OpenClaw session), không phải Compiler core.

## 9. Out-of-scope data (research §10, §12 — clarifications Q2, Q4)

Trường/khái niệm KHÔNG có trong core schema:
- **Monitor**: không có entity `Monitor` trong Component union. Monitor↔GPU performance = LLM suggestion layer (research §10). Nếu caller có monitor data, LLM consume, không pass vào Compiler.
- **PSU `efficiency_rating`**: không có trường trên PSU (research §12). Rating = AC→DC transfer semantics, LLM advisory.
- **Storage `capacity`**: không có trường capacity trên Storage (research §9). Capacity requirement = use-case dependent, LLM suggest.
- **GPU `model`/benchmark data**: không có; performance matching out of scope.
