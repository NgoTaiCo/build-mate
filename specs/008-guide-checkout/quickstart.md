# Quickstart: `guide_checkout`

**Feature**: `008-guide-checkout`  
**Branch**: `008-guide-checkout`  
**Date**: 2026-07-08

## 1. Prerequisites

- Node.js 22.17 LTS (hoặc 22.19+/24).
- OpenClaw gateway đã cài đặt: `npm install -g openclaw@latest`.
- Các package workspace hiện có phải build/test xanh:
  - `packages/compiler` (001)
  - `packages/catalog` (002)
  - `packages/openclaw-tools` (003)

> **Lưu ý**: `guide_checkout` là **S4 stretch**. Chỉ triển khai sau khi MVP (S1+S3) hoàn thành.

## 2. Install Dependencies

Từ repo root:

```powershell
# Nếu root package.json workspaces đã có sẵn
npm install

# Hoặc cài riêng cho openclaw-tools
npm install --workspace=@buildmate/openclaw-tools
```

## 3. Run Tests

```powershell
cd packages/openclaw-tools
npm test
```

Expected output: ~5-7 unit tests pass, bao gồm:
- `summary.test.ts` — tính tổng giá, discount, stock warnings.
- `guide.test.ts` — URL/fallback steps.
- `guide-checkout-tool.test.ts` — tool registration + TypeBox validation.

## 4. Build TypeScript

```powershell
cd packages/openclaw-tools
npm run build
```

## 5. Link Plugin into OpenClaw

```powershell
# Từ repo root
openclaw plugins install --link ./packages/openclaw-tools
openclaw gateway restart
```

## 6. Runtime Verification

### 6.1 Inspect tools

```powershell
openclaw plugins inspect buildmate-tools --runtime --json
```

Expected: `contracts.tools` bao gồm `guide_checkout`.

### 6.2 End-to-end via WebChat

1. Mở `http://127.0.0.1:18789/`.
2. Chat: `"Tôi muốn thanh toán build này"` (sau khi agent đã có build từ flow S1/S3).
3. Agent gọi `guide_checkout` → trả về JSON summary → agent render thành prose.

## 7. Configuration

Thêm URL checkout vào plugin config nếu cần (ví dụ môi trường mock):

```json5
// packages/openclaw-tools/openclaw.plugin.json
{
  "id": "buildmate-tools",
  "config": {
    "checkoutUrl": "https://phongvu.vn/buildpc"
  }
}
```

Nếu `checkoutUrl` không được cung cấp, tool sẽ trả về `url: null` và dùng fallback steps.

## 8. Manual Test Snippet

```typescript
import { createOrderSummary } from "@buildmate/openclaw-tools/checkout";
import { mockCatalog } from "@buildmate/catalog";

const build = [
  { sku: "CPU-13600KF", type: "CPU", quantity: 1 },
  { sku: "RAM-32GB-DDR5", type: "RAM", quantity: 1 },
];

const result = createOrderSummary(
  build,
  (sku) => mockCatalog.find((c) => c.sku === sku),
  { checkoutUrl: "https://phongvu.vn/buildpc" }
);

console.log(JSON.stringify(result, null, 2));
```

## 9. Safety Checklist

- [ ] Tool không gọi LLM.
- [ ] Tool không gọi payment gateway.
- [ ] Tool không submit đơn hàng.
- [ ] Tool không thu thập thẻ / địa chỉ.
- [ ] `npm test` xanh trước demo.
