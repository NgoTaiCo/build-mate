# @buildmate/compiler

Build Compiler = deterministic trust layer (Constitution Principle II). Pure-function
library kiểm tra tương thích linh kiện PC — không phụ thuộc OpenClaw runtime, không gọi LLM.

## Public API

```typescript
export function compileBuild(build: Build): CompilerResult;
export function detectErrors(build: Build): CompilerError[];
export function repairBuild(build: Build, errors: CompilerError[]): RepairPlan[];
```

- `compileBuild(build)` — entry point chính: validate + sinh repair plan trong 1 call.
- `detectErrors(build)` — chỉ validate, trả `CompilerError[]` (rỗng nếu build hợp lệ).
- `repairBuild(build, errors)` — sinh `RepairPlan[]` (1:1 với `errors`) từ errors đã detect.

Tất cả function pure: không side-effect, không I/O, deterministic (cùng input → cùng output).

## Error code catalog

| Code | Name | Severity | Trigger |
|---|---|---|---|
| `E001` | `SOCKET_MISMATCH` | error | `cpu.socket !== mainboard.socket` |
| `E002` | `RAM_GEN_MISMATCH` | error | RAM generation không thuộc `cpu.ram_gen_supported` hoặc `mainboard.ram_gen_supported` |
| `E003` | `MISSING_COMPONENT` | error | thiếu ≥1 trong 7 loại bắt buộc (cpu, mainboard, ram, psu, cooler, case, storage) |
| `E004` | `COOLER_CLEARANCE_MISMATCH` | error | `cooler.height > case.max_cooler_height` |
| `E005` | `FORM_FACTOR_MISMATCH` | error | `mainboard`/`psu` form-factor không thuộc `case` supported list |
| `E006` | `MISSING_ATTRIBUTE` | error | component thiếu thuộc tính bắt buộc cho rule |
| `W001` | `PSU_TIGHT` | warning | `psu.wattage < (TDP tổng excl. PSU) × 1.2` |

## Usage example

```typescript
import { compileBuild } from "@buildmate/compiler";

const result = compileBuild({
  components: [
    { type: "cpu", id: "cpu1", socket: "LGA1700", ram_gen_supported: ["DDR5"], tdp: 65 },
    { type: "mainboard", id: "mb1", socket: "AM5", ram_gen_supported: ["DDR5"], form_factor: "ATX" },
    { type: "ram", id: "ram1", generation: "DDR5" },
    { type: "psu", id: "psu1", wattage: 650, form_factor: "ATX" },
    { type: "cooler", id: "cool1", height: 155 },
    { type: "case", id: "case1", max_cooler_height: 165,
      supported_mb_form_factors: ["ATX"], supported_psu_form_factors: ["ATX"] },
    { type: "storage", id: "ssd1" },
  ],
});

// result.errors[0].code === "E001" (socket mismatch)
// result.is_valid === false
// result.repair_plan[0].fixes — alternative constraint-based fixes
```

## Quality gate

```sh
npm install
npm test         # node:test — must be green
npm run typecheck # tsc --noEmit strict — must be 0 errors
npx tsx scripts/smoke.ts
```

## Out of scope

No RGB/aesthetic/price matching, no monitor↔GPU performance rule, no PSU efficiency
rating (80 Plus) branch, no storage capacity check. See `contracts/compiler-api.md`
in `specs/001-build-compiler-core/` for full non-goals.
