# Contract: Component Comparison Tool

**Branch**: `007-compare-components` | **Date**: 2026-07-08
**Project type**: OpenClaw tool plugin wrapping deterministic comparator library
**Consumers**: OpenClaw agent via `compare_components` tool; test suite gọi `@buildmate/comparator` trực tiếp

## 1. Comparator package API (`@buildmate/comparator`)

Package export 2 public function chính (barrel `src/index.ts`):

```typescript
export function compareComponents(
  input: CompareInput,
  catalogSearch: (criteria: { sku: string[] }) => CatalogComponent[]
): ComparisonResult;

export function selectBestFit(
  table: ComparisonTable,
  use_case: "gaming" | "productivity" | "budget"
): Recommendation;
```

> `compareComponents` nhận `catalogSearch` là dependency-injected function để tránh I/O trực tiếp trong pure function. Tool plugin sẽ inject `search_components` từ `@buildmate/catalog`.

### 1.1 `compareComponents(input, catalogSearch)` → `ComparisonResult`

**Input**: `CompareInput` (xem `data-model.md` §1).

**Output**:

```typescript
interface ComparisonResult {
  table: ComparisonTable;           // xem data-model.md §4
  recommendation?: Recommendation;  // xem data-model.md §5, chỉ có khi use_case hợp lệ
  errors: CompareError[];           // rỗng nếu thành công
}
```

```typescript
interface CompareError {
  code: "C001" | "C002" | "C003" | "C004" | "C005";
  name: string;
  message: string;
  skus?: string[];
}
```

**Contract**:
- Nếu input invalid (C001-C005) → trả `errors` với `table` rỗng và `recommendation` undefined.
- Nếu thành công → `errors` rỗng, `table` populated, `recommendation` populated nếu có `use_case`.
- Deterministic: cùng input + cùng catalog data → cùng output.
- Không throw trên lỗi business; chỉ throw nếu `catalogSearch` throw (caller bug hoặc infra).

### 1.2 `selectBestFit(table, use_case)` → `Recommendation`

**Input**:
- `table`: `ComparisonTable` hợp lệ (≥2 rows, cùng category).
- `use_case`: một trong `"gaming"`, `"productivity"`, `"budget"`.

**Output**: `Recommendation` (xem `data-model.md` §5).

**Contract**:
- Luôn trả 1 winner SKU từ `table.rows`.
- Scoring deterministic theo research.md §2.
- Không gọi LLM.

---

## 2. `compare_components` tool schema (OpenClaw)

Tool name: `compare_components`

### Input schema (TypeBox)

```typescript
{
  skus: Type.Array(Type.String(), { minItems: 2, maxItems: 5 }),
  use_case: Type.Optional(
    Type.Union([
      Type.Literal("gaming"),
      Type.Literal("productivity"),
      Type.Literal("budget"),
    ])
  ),
}
```

### Output schema

```typescript
{
  table: {
    component_type: Type.String(),
    rows: Type.Array(ComparisonRowSchema),
  },
  recommendation: Type.Optional({
    use_case: Type.String(),
    winner_sku: Type.String(),
    winner_name: Type.String(),
    reasons: Type.Array(Type.String()),
    all_out_of_stock: Type.Boolean(),
  }),
  errors: Type.Array(CompareErrorSchema),
}
```

### Tool behavior

1. Parse input; validate `skus` length 2-5 và `use_case` hợp lệ.
2. Gọi `@buildmate/catalog` `search_components({ sku: skus })` để lấy component objects.
3. Gọi `@buildmate/comparator` `compareComponents(input, catalogSearch)`.
4. Nếu `recommendation` tồn tại, tool plugin **có thể** gọi model provider để generate prose explanation từ `recommendation.reasons` (LLM layer). Prose này không ảnh hưởng đến winner SKU.
5. Trả kết quả JSON cho agent.

---

## 3. Example invocation

### Request

```json
{
  "skus": ["cpu-001", "cpu-002", "cpu-003"],
  "use_case": "gaming"
}
```

### Response (success)

```json
{
  "table": {
    "component_type": "cpu",
    "rows": [
      { "sku": "cpu-001", "name": "Ryzen 5 7600", "type": "cpu", "price": 4500000, "stock_status": "in_stock", "promo": "-200000 VND", "socket": "AM5", "ram_gen": "DDR5", "tdp": 65, "wattage": "—", "clearance": "—", "form_factor": "—" },
      { "sku": "cpu-002", "name": "Ryzen 7 7700X", "type": "cpu", "price": 8200000, "stock_status": "in_stock", "promo": null, "socket": "AM5", "ram_gen": "DDR5", "tdp": 105, "wattage": "—", "clearance": "—", "form_factor": "—" },
      { "sku": "cpu-003", "name": "Core i5-13400F", "type": "cpu", "price": 3900000, "stock_status": "out_of_stock", "promo": null, "socket": "LGA1700", "ram_gen": "DDR4", "tdp": 65, "wattage": "—", "clearance": "—", "form_factor": "—" }
    ]
  },
  "recommendation": {
    "use_case": "gaming",
    "winner_sku": "cpu-002",
    "winner_name": "Ryzen 7 7700X",
    "reasons": [
      "Highest TDP (105W) indicates higher performance class",
      "Supports DDR5 memory generation",
      "Currently in stock"
    ],
    "all_out_of_stock": false
  },
  "errors": []
}
```

### Response (error)

```json
{
  "table": { "component_type": "", "rows": [] },
  "errors": [
    { "code": "C004", "name": "CATEGORY_MISMATCH", "message": "All SKUs must be the same component type. Found: cpu, gpu", "skus": ["cpu-001", "gpu-001"] }
  ]
}
```

---

## 4. Error code stability guarantee

| Code | Stable | Caller may branch on |
|---|---|---|
| `C001`-`C005` | YES | `error.code === "C001"` |

---

## 5. Non-goals (out of contract)

- KHÔNG gọi LLM trong `@buildmate/comparator` (Principle II).
- KHÔNG persist comparison history.
- KHÔNG so sánh cross-category.
- KHÔNG dùng live benchmark scores hoặc external review aggregation (spec out-of-scope).
- KHÔNG tự ý thêm use case ngoài {gaming, productivity, budget}.
- KHÔNG resolve SKU (Catalog tool làm).

---

## 6. Integration with existing packages

```text
┌─────────────────────────────────────┐
│  OpenClaw agent / WebChat           │
└─────────────┬───────────────────────┘
              │ compare_components tool
┌─────────────▼───────────────────────┐
│  @buildmate/openclaw-tools          │
│  (tool plugin + optional prose LLM) │
└─────────────┬───────────────────────┘
              │ inject catalogSearch
┌─────────────▼───────────────────────┐
│  @buildmate/comparator              │
│  (deterministic compare + score)    │
└─────────────┬───────────────────────┘
              │ search_components({ sku })
┌─────────────▼───────────────────────┐
│  @buildmate/catalog                 │
│  (SKU lookup)                       │
└─────────────────────────────────────┘
```
