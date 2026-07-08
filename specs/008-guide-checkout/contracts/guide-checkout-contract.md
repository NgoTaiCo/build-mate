# Contract: `guide_checkout` Tool

**Feature**: `008-guide-checkout`  
**Date**: 2026-07-08  
**Spec**: [spec.md](../spec.md)  
**Data Model**: [data-model.md](../data-model.md)

## 1. Tool Overview

`guide_checkout` là một OpenClaw tool plugin. Nhận một `Build` đã compile/repair, lookup catalog để lấy price/stock/promo, trả về `OrderSummary` và `CheckoutGuide` dưới dạng JSON. Tool không gọi LLM, không thực hiện thanh toán, không submit đơn hàng.

## 2. Tool Registration

```typescript
api.registerTool({
  name: "guide_checkout",
  description:
    "Given a compiled and repaired PC build, produce an order summary " +
    "(component list, total price, stock status, applied promotions) " +
    "and a navigation guide to the checkout page. " +
    "Does NOT process payment, submit orders, or collect card/address info.",
  parameters: GuideCheckoutInputSchema,
  async execute(_id, params) {
    const result = guideCheckout(params.build, config);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
});
```

Tool cũng phải được khai báo trong `openclaw.plugin.json`:

```json
{
  "id": "buildmate-tools",
  "contracts": {
    "tools": [
      "compile_build",
      "detect_errors",
      "repair_build",
      "search_components",
      "guide_checkout"
    ]
  }
}
```

## 3. Input Schema (TypeBox)

```typescript
import { Type } from "@sinclair/typebox";

export const GuideCheckoutInputSchema = Type.Object(
  {
    build: Type.Array(
      Type.Object({
        sku: Type.String({ description: "Component SKU" }),
        type: Type.String({ description: "Component type, e.g. CPU, RAM, VGA" }),
        quantity: Type.Number({ default: 1, minimum: 1 }),
      }),
      { description: "Compiled and repaired PC build" }
    ),
  },
  { additionalProperties: false }
);

export type GuideCheckoutInput = Static<typeof GuideCheckoutInputSchema>;
```

**Validation**:
- `build` phải là array; mỗi phần tử có `sku` (string), `type` (string), `quantity` (>=1).
- `quantity` mặc định = 1.
- Không chấp nhận additional properties.

## 4. Output Schema

Tool trả về JSON object có cấu trúc:

```typescript
const LineItemSchema = Type.Object({
  sku: Type.String(),
  name: Type.String(),
  type: Type.String(),
  quantity: Type.Number(),
  unitPrice: Type.Number(),
  discountAmount: Type.Number(),
  lineTotal: Type.Number(),
  stockStatus: Type.Union([
    Type.Literal("in_stock"),
    Type.Literal("out_of_stock"),
    Type.Literal("unknown"),
  ]),
  promotionLabel: Type.Union([Type.String(), Type.Null()]),
  warnings: Type.Array(Type.String()),
});

const OrderSummarySchema = Type.Object({
  items: Type.Array(LineItemSchema),
  subtotal: Type.Number(),
  totalDiscount: Type.Number(),
  totalPrice: Type.Number(),
  currency: Type.Literal("VND"),
  stockReady: Type.Boolean(),
  warnings: Type.Array(Type.String()),
  generatedAt: Type.String({ format: "date-time" }),
});

const CheckoutGuideSchema = Type.Object({
  url: Type.Union([Type.String({ format: "uri" }), Type.Null()]),
  steps: Type.Array(Type.String()),
  fallback: Type.String(),
});

export const GuideCheckoutOutputSchema = Type.Object({
  orderSummary: OrderSummarySchema,
  checkoutGuide: CheckoutGuideSchema,
});
```

## 5. Pure Function Contract

```typescript
/**
 * Deterministic pure function. No side effects, no LLM call.
 *
 * @param build Build compiled+repaired
 * @param catalogLookup function sku => Component | undefined
 * @param config { checkoutUrl?: string }
 */
function createOrderSummary(
  build: Build,
  catalogLookup: (sku: string) => Component | undefined,
  config: { checkoutUrl?: string }
): { orderSummary: OrderSummary; checkoutGuide: CheckoutGuide };
```

**Invariants**:
- Cùng `build` + cùng catalog data + cùng `config` → cùng output.
- `totalPrice = subtotal - totalDiscount`.
- `stockReady` chỉ `true` khi tất cả items `in_stock`.
- Không bao giờ gọi model, payment gateway, hoặc order API.

## 6. Example

### Input

```json
{
  "build": [
    { "sku": "CPU-13600KF", "type": "CPU", "quantity": 1 },
    { "sku": "RAM-32GB-DDR5", "type": "RAM", "quantity": 1 }
  ]
}
```

### Output

```json
{
  "orderSummary": {
    "items": [
      {
        "sku": "CPU-13600KF",
        "name": "Intel Core i5-13600KF",
        "type": "CPU",
        "quantity": 1,
        "unitPrice": 6200000,
        "discountAmount": 0,
        "lineTotal": 6200000,
        "stockStatus": "in_stock",
        "promotionLabel": null,
        "warnings": []
      },
      {
        "sku": "RAM-32GB-DDR5",
        "name": "G.Skill 32GB DDR5 5600MHz",
        "type": "RAM",
        "quantity": 1,
        "unitPrice": 2800000,
        "discountAmount": 200000,
        "lineTotal": 2600000,
        "stockStatus": "in_stock",
        "promotionLabel": "Giảm 200K",
        "warnings": []
      }
    ],
    "subtotal": 9000000,
    "totalDiscount": 200000,
    "totalPrice": 8800000,
    "currency": "VND",
    "stockReady": true,
    "warnings": [],
    "generatedAt": "2026-07-08T09:30:00.000Z"
  },
  "checkoutGuide": {
    "url": "https://phongvu.vn/buildpc",
    "steps": [
      "Mở trang https://phongvu.vn/buildpc",
      "Kiểm tra lại cấu hình PC trong giỏ hàng",
      "Nhấn nút 'Thanh toán' để tiếp tục"
    ],
    "fallback": "Nếu không vào được trang, hãy truy cập phongvu.vn, chọn 'Xây dựng cấu hình PC', kiểm tra lại build và nhấn 'Thanh toán'."
  }
}
```

## 7. Error Handling

| Scenario | Behavior |
|---|---|
| Build rỗng | Trả về `OrderSummary` với `items=[]`, `totalPrice=0`, `warnings=["Build is empty — nothing to checkout."]` |
| SKU không tìm thấy trong catalog | LineItem với `name="Unknown SKU"`, `unitPrice=0`, `stockStatus="unknown"`, warning `"SKU {sku} not found in catalog"` |
| Thiếu `price` | `unitPrice=0`, warning `"Price missing for {sku}"` |
| Thiếu `stock_status` | `stockStatus="unknown"`, warning `"Stock status missing for {sku}"` |
| Promotion chỉ có label | Hiển thị label, `discountAmount=0`, warning `"Promotion value not available — total may not reflect discount"` |
| Checkout URL không cấu hình | `checkoutGuide.url = null`, sử dụng `fallback` |

## 8. Non-Goals (Explicit)

- KHÔNG gọi LLM bên trong tool.
- KHÔNG thêm LangChain / LangGraph / orchestrator ngoài OpenClaw.
- KHÔNG tích hợp cổng thanh toán (VNPay, MoMo, Stripe, v.v.).
- KHÔNG submit đơn hàng hoặc tạo đơn trên hệ thống Phong Vu.
- KHÔNG thu thập thông tin thẻ tín dụng, địa chỉ, hoặc thông tin liên hệ.
- KHÔNG thực hiện thao tác DOM trên trang checkout (ví dụ: tự động click "Đặt hàng").
- KHÔNG xử lý lỗi compatibility — thuộc về `compile_build` / `detect_errors` / `repair_build`.
- KHÔNG xây dựng SessionStore, orchestrator, hay gateway replacement.
