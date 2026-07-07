# Tool Contracts: Wire WebChat end-to-end demo

**Feature**: 005-wire-webchat-e2e-demo  
**Date**: 2026-07-07  
**Purpose**: Define OpenClaw tool plugin interfaces for S1 + S3 demo flow.

## Tool inventory

| Tool | Layer | Deterministic? | Used in |
| --- | --- | --- | --- |
| `search_components` | Catalog | Yes | S1 |
| `compile_build` | Compiler | Yes | S1, S3 (re-check after repair) |
| `detect_errors` | Compiler | Yes | S3 |
| `repair_build` | Compiler | Yes | S3 |
| `read_current_build` | DOM exec | No (external browser state) | S3 (optional, for verification) |
| `add_to_build` | DOM exec | No (external browser side effect) | S3 |

---

## `search_components`

Tìm kiếm linh kiện trong catalog dựa trên nhu cầu khách hàng.

### Input schema (TypeBox)

```typescript
Type.Object({
  query: Type.Optional(Type.String()),
  category: Type.Optional(Type.Enum({ cpu: 'cpu', motherboard: 'motherboard', ram: 'ram', gpu: 'gpu', psu: 'psu', storage: 'storage', case: 'case', cooler: 'cooler' })),
  budgetMax: Type.Optional(Type.Number()),
  useCase: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number({ default: 10 })),
})
```

### Output schema

```typescript
Type.Object({
  results: Type.Array(Type.Object({
    sku: Type.String(),
    name: Type.String(),
    category: Type.String(),
    price: Type.Number(),
    stockStatus: Type.String(),
    promo: Type.Optional(Type.String()),
    specs: Type.Record(Type.String(), Type.Unknown()),
  })),
})
```

### Example

**Input**:

```json
{
  "category": "cpu",
  "budgetMax": 5000000,
  "useCase": "gaming",
  "limit": 3
}
```

**Output**:

```json
{
  "results": [
    {
      "sku": "CPU-I5-12400F",
      "name": "Intel Core i5-12400F",
      "category": "cpu",
      "price": 4190000,
      "stockStatus": "in_stock",
      "specs": { "socket": "LGA1700", "tdp": 117, "ramGenSupport": "ddr4" }
    }
  ]
}
```

---

## `compile_build`

Biên dịch / validate một cấu hình PC.

### Input schema

```typescript
Type.Object({
  build: Type.Object({
    components: Type.Array(Type.Object({
      role: Type.String(),
      sku: Type.String(),
      qty: Type.Optional(Type.Number({ default: 1 })),
    })),
  }),
})
```

### Output schema

```typescript
Type.Object({
  valid: Type.Boolean(),
  totalPrice: Type.Number(),
  errors: Type.Array(Type.Object({
    code: Type.String(),
    severity: Type.String(),
    affectedRoles: Type.Array(Type.String()),
    message: Type.String(),
  })),
})
```

### Example

**Input**:

```json
{
  "build": {
    "components": [
      { "role": "cpu", "sku": "CPU-I5-12400F" },
      { "role": "motherboard", "sku": "MB-B660-DDR4" },
      { "role": "ram", "sku": "RAM-DDR4-16GB" },
      { "role": "psu", "sku": "PSU-500W" }
    ]
  }
}
```

**Output**:

```json
{
  "valid": true,
  "totalPrice": 12570000,
  "errors": []
}
```

---

## `detect_errors`

Phát hiện lỗi tương thích trong một cấu hình.

### Input schema

```typescript
Type.Object({
  build: Type.Object({
    components: Type.Array(Type.Object({
      role: Type.String(),
      sku: Type.String(),
      qty: Type.Optional(Type.Number({ default: 1 })),
    })),
  }),
})
```

### Output schema

```typescript
Type.Object({
  errors: Type.Array(Type.Object({
    code: Type.String(),
    severity: Type.String(),
    affectedRoles: Type.Array(Type.String()),
    message: Type.String(),
    details: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  })),
})
```

### Example

**Input**:

```json
{
  "build": {
    "components": [
      { "role": "cpu", "sku": "CPU-I5-12400F" },
      { "role": "motherboard", "sku": "MB-B650-AM5" },
      { "role": "psu", "sku": "PSU-400W" }
    ]
  }
}
```

**Output**:

```json
{
  "errors": [
    {
      "code": "E001",
      "severity": "error",
      "affectedRoles": ["cpu", "motherboard"],
      "message": "CPU Intel Core i5-12400F (socket LGA1700) không tương thích với mainboard B650 (socket AM5).",
      "details": { "expectedSocket": "LGA1700", "actualSocket": "AM5" }
    },
    {
      "code": "E002",
      "severity": "error",
      "affectedRoles": ["psu"],
      "message": "Nguồn 400W không đủ công suất cho cấu hình này (cần ít nhất 550W).",
      "details": { "requiredWattage": 550, "providedWattage": 400 }
    }
  ]
}
```

---

## `repair_build`

Tạo kế hoạch sửa chữa cho build lỗi.

### Input schema

```typescript
Type.Object({
  build: Type.Object({
    components: Type.Array(Type.Object({
      role: Type.String(),
      sku: Type.String(),
      qty: Type.Optional(Type.Number({ default: 1 })),
    })),
  }),
  errors: Type.Optional(Type.Array(Type.Object({
    code: Type.String(),
    affectedRoles: Type.Array(Type.String()),
  }))),
})
```

### Output schema

```typescript
Type.Object({
  suggestions: Type.Array(Type.Object({
    role: Type.String(),
    currentSku: Type.String(),
    replacementSku: Type.String(),
    reason: Type.String(),
  })),
  fixedBuild: Type.Object({
    components: Type.Array(Type.Object({
      role: Type.String(),
      sku: Type.String(),
      qty: Type.Number(),
    })),
  }),
})
```

### Example

**Input**:

```json
{
  "build": {
    "components": [
      { "role": "cpu", "sku": "CPU-I5-12400F" },
      { "role": "motherboard", "sku": "MB-B650-AM5" },
      { "role": "psu", "sku": "PSU-400W" }
    ]
  }
}
```

**Output**:

```json
{
  "suggestions": [
    {
      "role": "motherboard",
      "currentSku": "MB-B650-AM5",
      "replacementSku": "MB-B660-DDR4",
      "reason": "Chuyển sang mainboard socket LGA1700 để tương thích với CPU i5-12400F."
    },
    {
      "role": "psu",
      "currentSku": "PSU-400W",
      "replacementSku": "PSU-650W",
      "reason": "Nâng công suất nguồn lên 650W để đủ cho CPU và GPU."
    }
  ],
  "fixedBuild": {
    "components": [
      { "role": "cpu", "sku": "CPU-I5-12400F" },
      { "role": "motherboard", "sku": "MB-B660-DDR4" },
      { "role": "psu", "sku": "PSU-650W" }
    ]
  }
}
```

---

## `add_to_build`

Thêm / thay thế linh kiện trong trang build PC (DOM execution).

### Input schema

```typescript
Type.Object({
  sku: Type.String(),
  role: Type.Optional(Type.String()),
  qty: Type.Optional(Type.Number({ default: 1 })),
})
```

### Output schema

```typescript
Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  currentBuild: Type.Object({
    components: Type.Array(Type.Object({
      role: Type.String(),
      sku: Type.String(),
      qty: Type.Number(),
    })),
  }),
})
```

### Example

**Input**:

```json
{
  "sku": "MB-B660-DDR4",
  "role": "motherboard"
}
```

**Output**:

```json
{
  "success": true,
  "message": "Đã thay thế motherboard bằng MB-B660-DDR4.",
  "currentBuild": {
    "components": [
      { "role": "cpu", "sku": "CPU-I5-12400F", "qty": 1 },
      { "role": "motherboard", "sku": "MB-B660-DDR4", "qty": 1 }
    ]
  }
}
```

---

## `read_current_build`

Đọc cấu hình hiện tại từ trang build PC.

### Input schema

```typescript
Type.Object({})
```

### Output schema

```typescript
Type.Object({
  components: Type.Array(Type.Object({
    role: Type.String(),
    sku: Type.String(),
    qty: Type.Number(),
  })),
})
```

### Example

**Output**:

```json
{
  "components": [
    { "role": "cpu", "sku": "CPU-I5-12400F", "qty": 1 },
    { "role": "motherboard", "sku": "MB-B660-DDR4", "qty": 1 }
  ]
}
```

---

## Common types

```typescript
// Shared across tools
const BuildComponentSchema = Type.Object({
  role: Type.String(),
  sku: Type.String(),
  qty: Type.Optional(Type.Number({ default: 1 })),
});

const BuildSchema = Type.Object({
  components: Type.Array(BuildComponentSchema),
});

const CompatibilityErrorSchema = Type.Object({
  code: Type.String(),
  severity: Type.String(),
  affectedRoles: Type.Array(Type.String()),
  message: Type.String(),
  details: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
```

## Notes

- Tất cả tool schemas dùng `@sinclair/typebox` để OpenClaw runtime có thể validate input.
- `compile_build`, `detect_errors`, `repair_build`, `search_components` là deterministic pure functions.
- `read_current_build` / `add_to_build` phụ thuộc trạng thái browser / mock page; cần xử lý timeout và retry.
