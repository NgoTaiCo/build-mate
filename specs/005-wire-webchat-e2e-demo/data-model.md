# Data Model: Wire WebChat end-to-end demo

**Feature**: 005-wire-webchat-e2e-demo  
**Date**: 2026-07-07

## Entities

### UserNeed

Mô tả nhu cầu của khách hàng thu thập được từ WebChat.

| Field | Type | Description |
| --- | --- | --- |
| `sessionId` | string | OpenClaw session identifier (do OpenClaw cấp) |
| `channel` | string | Luôn là `webchat` trong feature này |
| `rawInput` | string | Tin nhắn gốc của khách hàng |
| `extractedBudget` | number? | Ngân sách ước tính (VND) nếu detect được |
| `extractedUseCase` | string? | Mục đích sử dụng: gaming, office, creative, v.v. |
| `extractedPreferences` | string[] | Các yêu cầu ưu tiên: brand, kích thước, v.v. |
| `createdAt` | ISO timestamp | Thờii điểm thu thập |

**Validation rules**:
- `sessionId` bắt buộc.
- Ít nhất một trong `extractedBudget`, `extractedUseCase`, `rawInput` phải có dữ liệu.

### Component

Một linh kiện trong catalog.

| Field | Type | Description |
| --- | --- | --- |
| `sku` | string | Mã SKU duy nhất |
| `name` | string | Tên hiển thị |
| `category` | enum | `cpu`, `motherboard`, `ram`, `gpu`, `psu`, `storage`, `case`, `cooler` |
| `brand` | string | Hãng sản xuất |
| `price` | number | Giá bán (VND) |
| `stockStatus` | enum | `in_stock`, `out_of_stock`, `pre_order` |
| `promo` | string? | Thông tin khuyến mãi |
| `specs` | object | Thuộc tính kỹ thuật phụ thuộc category (xem bên dưới) |

**Category-specific specs**:

- `cpu`: `socket`, `tdp`, `ramGenSupport`, `integratedGpu?`
- `motherboard`: `socket`, `ramGen`, `formFactor`, `maxRam`
- `ram`: `gen`, `capacityGB`, `speedMHz`
- `gpu`: `tdp`, `lengthMm`, `powerConnectors`
- `psu`: `wattage`, `efficiency`, `formFactor`
- `storage`: `type` (ssd/hdd), `capacityGB`, `interface`
- `case`: `formFactor`, `maxGpuLengthMm`
- `cooler`: `socketSupport`, `tdp`

**Validation rules**:
- `sku` duy nhất trong catalog.
- `price` >= 0.
- `category` phải nằm trong danh sách cho phép.
- Các trường `specs` bắt buộc tùy theo category để Compiler có thể check.

### BuildConfiguration

Cấu hình PC được chọn/biên dịch.

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | UUID hoặc unique id của build |
| `sessionId` | string | OpenClaw session identifier |
| `components` | BuildComponent[] | Danh sách linh kiện theo vai trò |
| `status` | enum | `draft`, `compiled`, `error`, `fixed` |
| `totalPrice` | number | Tổng giá ước tính |
| `errors` | CompatibilityError[] | Các lỗi phát hiện (nếu có) |
| `createdAt` | ISO timestamp | Thờii điểm tạo |
| `updatedAt` | ISO timestamp | Thờii điểm cập nhật gần nhất |

**BuildComponent**:

| Field | Type | Description |
| --- | --- | --- |
| `role` | enum | `cpu`, `motherboard`, `ram`, `gpu`, `psu`, `storage`, `case`, `cooler` |
| `sku` | string | Tham chiếu đến Component |
| `qty` | number | Số lượng (mặc định 1, RAM có thể 2–4) |

**Validation rules**:
- Mỗi `role` xuất hiện tối đa một lần, trừ `ram` và `storage`.
- `sku` phải tồn tại trong catalog.
- `totalPrice` = tổng `price * qty` của các component.

**State transitions**:

```text
draft  --compile_build-->  compiled
compiled / fixed --detect_errors-->  error
error  --repair_build-->  fixed
```

### CompatibilityError

Lỗi tương thích do Compiler phát hiện.

| Field | Type | Description |
| --- | --- | --- |
| `code` | string | `E001`, `E002`, ... |
| `severity` | enum | `error`, `warning` |
| `affectedRoles` | string[] | Các role bị ảnh hưởng, ví dụ `["cpu", "motherboard"]` |
| `message` | string | Mô tả lỗi cho ngườii dùng |
| `details` | object? | Dữ liệu bổ sung (ví dụ: expected socket, actual socket) |

**Validation rules**:
- `code` phải nằm trong danh sách error codes đã định nghĩa.
- `affectedRoles` không rỗng.

### RepairPlan

Kế hoạch sửa chữa build lỗi.

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | UUID |
| `buildId` | string | Tham chiếu đến BuildConfiguration |
| `errors` | CompatibilityError[] | Các lỗi cần sửa |
| `suggestions` | Suggestion[] | Linh kiện đề xuất thay thế |
| `status` | enum | `pending`, `applied`, `rejected` |
| `createdAt` | ISO timestamp | Thờii điểm tạo |

**Suggestion**:

| Field | Type | Description |
| --- | --- | --- |
| `role` | enum | Vai trò cần thay thế |
| `currentSku` | string | SKU hiện tại gây lỗi |
| `replacementSku` | string | SKU đề xuất |
| `reason` | string | Lý do đề xuất |

**Validation rules**:
- `replacementSku` phải tồn tại trong catalog.
- `replacementSku` phải khác `currentSku`.

### DemoRun

Ghi lại kết quả rehearsal.

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | UUID |
| `scenario` | string | `S1`, `S3`, hoặc `S1-S3` |
| `input` | object | Input của scenario (need / broken build) |
| `expectedErrorCode` | string? | E001/E002 nếu là S3 |
| `result` | object | Output thực tế |
| `passed` | boolean | Rehearse thành công hay không |
| `runAt` | ISO timestamp | Thờii điểm chạy |

## Relationships

```text
UserNeed 1 ----> * BuildConfiguration (theo session)
BuildConfiguration * ----> * Component (qua BuildComponent)
BuildConfiguration 1 ----> * CompatibilityError
BuildConfiguration 1 ----> * RepairPlan
RepairPlan * ----> * Component (qua Suggestion)
```

## Notes

- Không có database persist; mọi entity trên chỉ tồn tại trong OpenClaw session transcript hoặc in-memory runtime.
- `BuildConfiguration` là trung tâm của S1 và S3.
- `CompatibilityError` và `RepairPlan` phải được serializable để truyền qua OpenClaw tool result.
