# Data Model: Component Comparison Tool

**Branch**: `007-compare-components` | **Date**: 2026-07-08
**Source**: spec.md Key Entities + research.md §1-§6
**Implementation note**: types dưới đây = TypeScript type definitions. Không có persistence — pure in-memory data structures.

## Entities Overview

```text
CompareInput ──→ compareComponents() ──→ ComparisonTable
                                          └── Recommendation (nếu có use_case)
```

---

## 1. CompareInput (input root)

Trường | Kiểu | Bắt buộc | Mô tả
---|---|---|---
`skus` | `string[]` | yes | Danh sách SKU cần so sánh. Length 2-5.
`use_case` | `"gaming" \| "productivity" \| "budget" \| null` | no | Nếu cung cấp, comparator trả thêm `Recommendation`.

**Validation rules**:
- `skus.length < 2` → `INSUFFICIENT_SKUS`
- `skus.length > 5` → `TOO_MANY_SKUS`
- `use_case` nếu có phải thuộc 3 giá trị trên; nếu không → `INVALID_USE_CASE`

---

## 2. CatalogComponent (reference)

Comparator sử dụng `CatalogComponent` từ `@buildmate/catalog` (002). Các trường cần cho so sánh:

Trường | Kiểu | Mô tả
---|---|---
`id` | `string` | SKU
`name` | `string` | Tên sản phẩm
`type` | `ComponentType` | Loại linh kiện
`price` | `number` | Giá VND
`stock_status` | `"in_stock" \| "out_of_stock"` | Tình trạng kho
`promo` | `string \| null` | Khuyến mãi
`socket` | `string` | CPU/mainboard socket (nếu có)
`ram_gen_supported` / `generation` | `string[]` / `string` | RAM generation
`tdp` | `number` | TDP (CPU/GPU/RAM/storage/cooler)
`wattage` | `number` | PSU wattage
`clearance_mm` | `number` | Case GPU clearance
`form_factor` | `string` | Mainboard/PSU/case form factor

> Comparator KHÔNG định nghĩa lại type này — import từ `@buildmate/catalog` hoặc `@buildmate/compiler` types.

---

## 3. ComparisonRow

Mỗi row = 1 SKU với giá trị các trường so sánh. Các trường không áp dụng với loại linh kiện đó vẫn xuất hiện với giá trị `"—"` (placeholder).

Trường | Kiểu | Bắt buộc | Mô tả
---|---|---|---
`sku` | `string` | yes | SKU
`name` | `string` | yes | Tên sản phẩm
`type` | `ComponentType` | yes | Loại linh kiện
`price` | `number` | yes | Giá VND
`stock_status` | `"in_stock" \| "out_of_stock"` | yes | Tình trạng kho
`promo` | `string \| null` | yes | Khuyến mãi
`socket` | `string \| "—"` | yes | Socket (nếu không có → "—")
`ram_gen` | `string \| "—"` | yes | RAM generation (nếu không có → "—")
`tdp` | `number \| "—"` | yes | TDP (nếu không có → "—")
`wattage` | `number \| "—"` | yes | PSU wattage (nếu không có → "—")
`clearance` | `number \| "—"` | yes | Case clearance mm (nếu không có → "—")
`form_factor` | `string \| "—"` | yes | Form factor (nếu không có → "—")

> Tên trường `ram_gen`, `tdp`, `wattage`, `clearance`, `form_factor` align với spec yêu cầu.

---

## 4. ComparisonTable (output root)

Trường | Kiểu | Bắt buộc | Mô tả
---|---|---|---
`rows` | `ComparisonRow[]` | yes | Mảng row, 1 row/SKU, giữ thứ tự input.
`component_type` | `ComponentType` | yes | Loại linh kiện chung của tất cả SKU.
`sku_order` | `string[]` | yes | Thứ tự SKU như input (dùng để reconstruct).

**Validation rules**:
- `rows.length === sku_order.length`
- Tất cả rows phải có cùng `type`; nếu không → lỗi `CATEGORY_MISMATCH`

---

## 5. Recommendation

Chỉ sinh khi input có `use_case` hợp lệ.

Trường | Kiểu | Bắt buộc | Mô tả
---|---|---|---
`use_case` | `"gaming" \| "productivity" \| "budget"` | yes | Use case đã chọn
`winner_sku` | `string` | yes | SKU được chọn làm best-fit
`winner_name` | `string` | yes | Tên sản phẩm winner
`scores` | `ScoreEntry[]` | yes | Điểm số deterministic của từng SKU theo rule
`reasons` | `string[]` | yes | Các lý do deterministic (không phải prose) dùng cho LLM layer
`all_out_of_stock` | `boolean` | yes | `true` nếu tất cả SKU đều out-of-stock

### 5.1 ScoreEntry

Trường | Kiểu | Mô tả
---|---|---
`sku` | `string` | SKU
`score` | `number` | Score tổng hợp (càng cao càng tốt cho gaming/productivity; càng thấp càng tốt cho budget)
`rank` | `number` | Thứ hạng 1..N sau sort
`notes` | `string[]` | Ghi chú deterministic (vd. "highest tdp", "lowest price")

> Score là con số dùng để sort; không cần normalized. Ví dụ budget score = price (thấp hơn = tốt hơn). Gaming score = performance proxy value.

---

## 6. CompareErrorCode catalog

Code | Name | Severity | Trigger
---|---|---|---
`C001` | `INSUFFICIENT_SKUS` | error | `skus.length < 2`
`C002` | `TOO_MANY_SKUS` | error | `skus.length > 5`
`C003` | `SKU_NOT_FOUND` | error | Một hoặc nhiều SKU không tồn tại trong catalog
`C004` | `CATEGORY_MISMATCH` | error | SKU list resolve thành nhiều `type` khác nhau
`C005` | `INVALID_USE_CASE` | error | `use_case` không thuộc {gaming, productivity, budget}

---

## 7. Invariants

- **Deterministic**: cùng `skus` + cùng catalog data → cùng `ComparisonTable` và cùng `Recommendation`.
- **Category homogeneous**: comparison chỉ hợp lệ khi tất cả SKU cùng `type`.
- **Order preservation**: `rows` và `scores` giữ thứ tự SKU như input.
- **No LLM in comparator**: comparator không gọi model; prose generation là trách nhiệm của agent/tool layer.
- **No persistence**: pure in-memory functions.

## 8. Out-of-scope data

- Live benchmark scores (spec explicit out-of-scope).
- External review aggregation (spec explicit out-of-scope).
- Historical price data.
- Multi-category comparison.
- SKU resolution logic (delegated to `@buildmate/catalog`).
