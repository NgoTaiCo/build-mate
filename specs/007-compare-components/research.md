# Research: Component Comparison Tool

**Branch**: `007-compare-components` | **Date**: 2026-07-08
**Phase**: 0 — resolve technical unknowns before design

## Research Tasks

| # | Unknown / Choice | Resolved in § |
|---|---|---|
| R1 | SKU lookup mechanism: extend catalog SearchCriteria vs new `getBySku` API | §1 |
| R2 | Use-case scoring rules (gaming/productivity/budget) deterministic | §2 |
| R3 | Package/module placement: separate comparator package vs inline in compiler vs tool plugin | §3 |
| R4 | Handling missing spec fields and category mismatch | §4 |
| R5 | Prose generation boundary: comparator vs LLM layer | §5 |
| R6 | Stock status treatment in best-fit scoring | §6 |

---

## §1. SKU lookup mechanism

**Decision**: Extend `SearchCriteria` trong `@buildmate/catalog` với trường `sku?: string[]` (additive, backward-compatible). `compareComponents` gọi `search_components({ sku: skus })` để lấy đầy đủ component objects.

**Rationale**: Catalog đã có `search_components` là public API. Thêm filter theo SKU là natural extension, không cần tạo function mới. Array `sku` cho phép lookup 2-5 SKU trong 1 call. Filter này ignored khi omitted (giữ behavior cũ). Trong implementation, catalog predicate thực hiện `criteria.sku.includes(component.id)` nếu `criteria.sku` tồn tại.

**Alternatives considered**:
- New `getComponentsBySku(skus)` function: thêm surface area, phải sửa contracts của 002, tăng scope.
- Load toàn bộ catalog rồi filter local: inefficient với live data; vi phạm time-box nếu catalog lớn.
- Truy cập trực tiếp catalog internal data: vi phạm package boundary.

---

## §2. Use-case scoring rules

**Decision**: Rule-based deterministic scoring per component type. Comparator xác định `type` từ catalog results, sau đó áp dụng bảng rule dưới đây.

| Use case | Mục tiêu | Primary sort | Tie-breaker 1 | Tie-breaker 2 |
|---|---|---|---|---|
| `gaming` | Performance max | Performance proxy DESC | In stock first | Price ASC |
| `productivity` | Balance gen + perf | Generation rank DESC, then performance proxy DESC | In stock first | Price ASC |
| `budget` | Cost min | Price ASC | Promo value DESC | In stock first |

**Performance proxy theo type**:
- `cpu`, `gpu`, `cooler`: `tdp` (higher = more powerful proxy trong MVP).
- `psu`: `wattage`.
- `case`: `clearance_mm` (larger case fits bigger GPUs).
- `ram`, `mainboard`: generation rank (DDR5 > DDR4).
- `storage`: không có proxy; gaming/productivity dùng in-stock + promo.

**Generation rank**: `DDR5 = 2`, `DDR4 = 1`, khác = 0.

**Promo value**: parse numeric discount từ `promo` string (vd. "-500000 VND" → 500000); nếu không parse được → 0.

**Rationale**: Spec yêu cầu deterministic recommendation. Dùng rule rõ ràng thay vì LLM chọn SKU. Proxy đơn giản (tdp/wattage/clearance/gen) đủ cho hackathon MVP; không cần benchmark data (out of scope). Rule dễ unit test với mock data.

**Alternatives considered**:
- LLM chọn best-fit: vi phạm Principle II (LLM đoán compatibility/performance).
- Weighted scoring function phức tạp (vd. weighted sum nhiều field): khó giải thích, dễ ẩn bug, không transparent.
- Per-use-case hardcoded SKU: không deterministic theo input, không scalable.

---

## §3. Package/module placement

**Decision**: Tạo package riêng `packages/comparator/` với name `@buildmate/comparator`.

**Rationale**: So sánh linh kiện là capability deterministic độc lập với compatibility validation (`@buildmate/compiler`) và data sourcing (`@buildmate/catalog`). Package riêng enforce boundary rõ ràng, dễ test độc lập, và dễ tái sử dụng nếu sau này cần compare ở context khác (ví dụ extension). Tool plugin (`@buildmate/openclaw-tools`) chỉ wrap+dispatch, giống pattern 003.

**Alternatives considered**:
- Inline vào `packages/compiler/src/compare.ts`: compiler package bị lẫn responsibility (validation vs comparison); nhưng vẫn acceptable nếu time-box gắt. Plan ghi chú fallback này trong `Project Structure`.
- Inline vào `packages/openclaw-tools/`: tool plugin chứa deterministic logic → vi phạm ranh giới layer, khó test độc lập.

---

## §4. Handling missing spec fields and category mismatch

**Decision**:
- **Category mismatch**: Nếu SKU list resolve thành nhiều `type` khác nhau → trả lỗi `CATEGORY_MISMATCH` với message rõ ràng. So sánh chỉ cho phép cùng category.
- **Missing fields**: Hiển thị placeholder `"—"` trong comparison table; scoring skip field đó cho SKU đó (không coi là 0 để tránh bias).
- **Unknown SKU**: Trả lỗi `SKU_NOT_FOUND` liệt kê SKU không tồn tại.
- **< 2 SKU**: Trả lỗi `INSUFFICIENT_SKUS`.
- **> 5 SKU**: Trả lỗi `TOO_MANY_SKUS`.

**Rationale**: Spec edge cases yêu cầu xử lý graceful. Category mismatch là lỗi vì so sánh CPU với PSU không có ý nghĩa. Missing field không được crash toàn bộ bảng.

**Alternatives considered**:
- Cho phép cross-category comparison: tạo bảng rất sparse, UX kém, không hữu ích.
- Default missing field về 0 hoặc giá trị trung bình: gây bias scoring, không deterministic nếu default thay đổi.

---

## §5. Prose generation boundary

**Decision**: Comparator **KHÔNG** gọi LLM. Comparator trả về `Recommendation` object chứa `winner_sku`, `scores`, `reasons` (deterministic). Prose generation xảy ra ở OpenClaw agent/tool layer — LLM nhận `Recommendation` object và viết lợi khuyên bằng ngôn ngữ tự nhiên.

**Rationale**: Giữ comparator là pure deterministic trust layer (Principle II). LLM chỉ format/giải thích — không quyết định. Điều này cũng phù hợp Principle III (model là provider config trong OpenClaw runtime).

**Alternatives considered**:
- Comparator gọi LLM trực tiếp: làm comparator phụ thuộc model provider, khó test, vi phạm pure-function boundary.
- Tool plugin gọi LLM rồi trả kết quả: acceptable — nhưng vẫn nên để agent layer tự format để tái sử dụng context.

---

## §6. Stock status treatment in best-fit scoring

**Decision**: `out_of_stock` không bị loại khỏi comparison table (shopper vẫn có thể xem spec), nhưng trong best-fit scoring, `in_stock` được ưu tiên hơn `out_of_stock` ở tie-breaker. Nếu tất cả SKU đều out-of-stock, vẫn chọn winner theo rule nhưng đánh dấu `all_out_of_stock: true`.

**Rationale**: So sánh spec cần hiển thị cả out-of-stock. Nhưng recommend out-of-stock làm default winner sẽ gây khó chịu UX. Tie-breaker đủ để ưu tiên hàng có sẵn mà không loại bỏ hoàn toàn.

**Alternatives considered**:
- Loại out_of_stock khỏi table: vi phạm FR-002 (hiển thị stock status side-by-side).
- Cấm recommend out_of_stock: edge case "all out of stock" sẽ không có winner.
- Coi stock như binary score: overcomplicate; tie-breaker đủ.

---

## Phase 0 Summary

Tất cả 6 unknown đã resolve. Decisions feed vào:
- `data-model.md`: `ComparisonTable`, `ComparisonRow`, `Recommendation`, `UseCase`, `CompareErrorCode`.
- `contracts/compare-components-contract.md`: API surface của `@buildmate/comparator` + `compare_components` tool schema.
- `quickstart.md`: test commands cho comparator standalone.
