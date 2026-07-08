# Data Model: `guide_checkout`

**Feature**: `008-guide-checkout`  
**Date**: 2026-07-08  
**Spec**: [spec.md](./spec.md)

## 1. Overview

`guide_checkout` biến một `Build` đã được compile/repair thành `OrderSummary` + `CheckoutGuide`. Dữ liệu chủ yếu được lookup từ `Catalog` và tổng hợp deterministic. Không có persistence hay state machine phức tạp.

## 2. Entities

### 2.1 `Build` (reference entity)

Đã được định nghĩa trong `001-build-compiler-core`. `guide_checkout` chỉ đọc, không sửa.

| Field | Type | Description |
|---|---|---|
| `components` | `BuildComponent[]` | Danh sách linh kiện trong build |

#### `BuildComponent` (reference)

| Field | Type | Description |
|---|---|---|
| `sku` | `string` | Mã SKU duy nhất của linh kiện |
| `type` | `ComponentType` | Loại linh kiện (CPU, MAINBOARD, RAM, VGA, SSD, PSU, CASE, COOLER, ...) |
| `quantity` | `number` | Số lượng (mặc định 1) |

### 2.2 `Component` (reference entity)

Đã được định nghĩa trong `002-mock-catalog-adapter`. `guide_checkout` sử dụng các trường sau:

| Field | Type | Description |
|---|---|---|
| `sku` | `string` | Mã SKU |
| `name` | `string` | Tên hiển thị |
| `type` | `ComponentType` | Loại linh kiện |
| `price` | `number` | Giá niêm yết (VND) |
| `stock_status` | `"in_stock" \| "out_of_stock" \| string` | Trạng thái tồn kho |
| `promotion` | `Promotion \| null` | Khuyến mãi đang áp dụng (nếu có) |

### 2.3 `Promotion`

| Field | Type | Description |
|---|---|---|
| `label` | `string` | Mô tả khuyến mãi (ví dụ: "Giảm 10%") |
| `discountAmount` | `number \| null` | Giá trị giảm giá cố định (VND), nếu có |
| `discountPercent` | `number \| null` | Phần trăm giảm giá (0-100), nếu có |

**Validation**:
- Ít nhất một trong `discountAmount` hoặc `discountPercent` có thể null.
- Nếu cả hai đều null, `OrderSummary` ghi nhãn khuyến mãi nhưng không áp dụng giảm giá vào tổng.

### 2.4 `LineItem`

Một dòng trong đơn hàng, tương ứng với một `BuildComponent` đã được lookup.

| Field | Type | Description |
|---|---|---|
| `sku` | `string` | SKU linh kiện |
| `name` | `string` | Tên hiển thị |
| `type` | `ComponentType` | Loại linh kiện |
| `quantity` | `number` | Số lượng |
| `unitPrice` | `number` | Giá niêm yết một đơn vị |
| `discountAmount` | `number` | Giá trị giảm giá đã áp dụng cho dòng này (0 nếu không có) |
| `lineTotal` | `number` | `(unitPrice - discountAmount) * quantity` |
| `stockStatus` | `"in_stock" \| "out_of_stock" \| "unknown"` | Trạng thái tồn kho đã chuẩn hóa |
| `promotionLabel` | `string \| null` | Nhãn khuyến mãi |
| `warnings` | `string[]` | Cảnh báo riêng dòng (hết hàng, thiếu giá, v.v.) |

**Validation**:
- `unitPrice` phải `>= 0`.
- `quantity` phải `>= 1`.
- `discountAmount` phải `>= 0` và `<= unitPrice`.

### 2.5 `OrderSummary`

| Field | Type | Description |
|---|---|---|
| `items` | `LineItem[]` | Danh sách dòng đơn hàng |
| `subtotal` | `number` | Tổng giá trước khuyến mãi (`sum(unitPrice * quantity)`) |
| `totalDiscount` | `number` | Tổng giảm giá (`sum(discountAmount * quantity)`) |
| `totalPrice` | `number` | `subtotal - totalDiscount` |
| `currency` | `string` | `"VND"` |
| `stockReady` | `boolean` | `true` nếu tất cả items đều `in_stock` |
| `warnings` | `string[]` | Cảnh báo chung (ví dụ: có món hết hàng) |
| `generatedAt` | `string` | ISO 8601 timestamp khi summary được tạo |

**Validation / Invariants**:
- `totalPrice = subtotal - totalDiscount`.
- `totalPrice >= 0`.
- Nếu có bất kỳ item nào `out_of_stock` hoặc `unknown`, `stockReady = false` và `warnings` phải chứa thông báo tương ứng.

### 2.6 `CheckoutGuide`

| Field | Type | Description |
|---|---|---|
| `url` | `string \| null` | URL trang checkout (ví dụ: `https://phongvu.vn/buildpc`) |
| `steps` | `string[]` | Các bước điều hướng bằng ngôn ngữ tự nhiên |
| `fallback` | `string` | Hướng dẫn dự phòng khi `url` không xác định |

**Validation**:
- `steps` phải có ít nhất 1 bước.
- Nếu `url` null, `fallback` phải cung cấp hướng dẫn thay thế.

## 3. Relationships

```text
Build ──has many──> BuildComponent
BuildComponent ──references──> Component (by SKU)
Component ──has zero or one──> Promotion
LineItem = BuildComponent + Component + normalized Promotion
OrderSummary = aggregate(LineItem[])
CheckoutGuide = config-driven guide object
```

## 4. Validation Rules from Requirements

| Requirement | Rule |
|---|---|
| FR-001 | Input phải là build đã compile/repair (không validate compatibility ở đây). |
| FR-002 | Mỗi `LineItem` phải có giá, stock status, và promo label (nếu có). |
| FR-003 | `totalPrice` phải bằng tổng giá linh kiện sau khi áp dụng discount đã biết. |
| FR-004 | `CheckoutGuide` phải chứa URL hoặc fallback steps. |
| FR-005 | Dữ liệu trong `OrderSummary` phải deterministic — cùng build + cùng catalog data → cùng output. |
| FR-006 | `guide_checkout` KHÔNG được tạo ra đơn hàng, thanh toán, thu thập thẻ, hay điền địa chỉ. |
| FR-007 | Item `out_of_stock` / `unknown` phải được đánh dấu và sinh warning. |
| FR-008 | Nếu URL checkout không có trong config, trả về `url: null` + fallback steps. |

## 5. State Transitions

Không áp dụng. `guide_checkout` là pure function: `Build + Catalog + Config → OrderSummary + CheckoutGuide`. Không có mutation hay persistence.

## 6. Design Invariants

- **Stateless**: `guide_checkout` không lưu trạng thái giữa các lần gọi.
- **No side effects**: Không gọi API bên ngoài (ngoài catalog lookup do `@buildmate/catalog` cung cấp), không ghi file, không ghi session.
- **Deterministic**: Cùng input + cùng catalog snapshot → cùng output.
- **Safe by default**: Mọi hành vi thanh toán / đặt hàng / điền thông tin đều bị từ chối.

## 7. Out-of-Scope Data Concerns

- Không lưu đơn hàng vào database.
- Không lưu lịch sử checkout vào session (OpenClaw owns session/memory).
- Không gửi thông tin thẻ / địa chỉ / liên hệ đến bất kỳ API nào.
