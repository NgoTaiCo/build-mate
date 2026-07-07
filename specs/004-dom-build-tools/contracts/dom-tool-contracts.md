# Contract: DOM Execution Tools (BuildMate Tools Extension)

**Branch**: `004-dom-build-tools` | **Date**: 2026-07-07
**Project type**: OpenClaw tool plugin extension — contract = tool schemas + browser automation behavior + fallback rules.
**Consumers**: OpenClaw agent runtime, BuildMate WebChat agent, future demo/test harness.
**Dependencies**: `@buildmate/openclaw-tools` (003/004), Playwright, `@buildmate/catalog` (002), `@buildmate/compiler` (001) nếu cần pre-add validation.

## Public Surface

Package `@buildmate/openclaw-tools` export default plugin entry (`src/index.ts`) đã đăng ký thêm 2 tools mới. Không expose public API ngoài plugin entry.

`openclaw.plugin.json` manifest mở rộng:

```json
{
  "id": "buildmate-tools",
  "name": "BuildMate Tools",
  "contracts": {
    "tools": [
      "compile_build",
      "detect_errors",
      "repair_build",
      "search_components",
      "add_to_build",
      "read_current_build"
    ]
  },
  "activation": { "onStartup": true }
}
```

---

## 1. Tool: `add_to_build`

**Purpose**: Thêm một linh kiện vào PC build đang mở trên `phongvu.vn/buildpc` (hoặc mock build-PC page nếu target = mock) bằng cách click qua UI.

**Input schema** (TypeBox):

```typescript
Type.Object({
  sku: Type.String({ description: "SKU of the component to add" }),
  target: Type.Union(
    [
      Type.Literal("live"),
      Type.Literal("mock"),
      Type.Literal("auto"),
    ],
    { default: "auto", description: "Where to execute: live site, mock page, or auto-detect" }
  ),
});
```

**Output**: OpenClaw content message chứa JSON-serialized `AddToBuildOutput`.

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"ok\":true,\"target\":\"live\",\"added\":{\"sku\":\"CPU-AM5-001\",\"name\":\"AMD Ryzen 7 7800X3D\",\"type\":\"cpu\",\"price\":8990000}}"
    }
  ]
}
```

**Contract**:
- Nếu `target === "live"`: luôn chạy trên `phongvu.vn/buildpc`.
- Nếu `target === "mock"`: luôn chạy trên self-hosted mock build-PC page.
- Nếu `target === "auto"`: thử live trước; nếu live fail thì trả về `ok: false`, `fallback_suggested: true`, không tự động switch.
- Tool KHÔNG kiểm tra compatibility; agent phải gọi `compile_build` / `detect_errors` trước nếu muốn validate.
- Sau khi click, tool verify bằng cách đọc lại build list (qua cùng parser với `read_current_build`) để confirm SKU xuất hiện.
- Nếu SKU không tìm thấy trên page, trả về error `SKU_NOT_FOUND`.
- Tool KHÔNG được click bất kỳ nút checkout/payment nào.

---

## 2. Tool: `read_current_build`

**Purpose**: Đọc trạng thái build PC hiện tại từ `phongvu.vn/buildpc` (hoặc mock page) bằng cách parse DOM.

**Input schema** (TypeBox):

```typescript
Type.Object({
  target: Type.Union(
    [
      Type.Literal("live"),
      Type.Literal("mock"),
      Type.Literal("auto"),
    ],
    { default: "auto", description: "Where to read from: live site, mock page, or auto-detect" }
  ),
});
```

**Output**: OpenClaw content message chứa JSON-serialized `ReadCurrentBuildOutput`.

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"ok\":true,\"target\":\"live\",\"build_state\":{\"components\":[{\"sku\":\"CPU-AM5-001\",\"name\":\"AMD Ryzen 7 7800X3D\",\"type\":\"cpu\",\"price\":8990000}],\"total\":8990000,\"empty_categories\":[\"mainboard\",\"ram\",\"psu\",\"cooler\",\"case\",\"storage\"],\"warnings\":[]}}"
    }
  ]
}
```

**Contract**:
- Nếu `target === "auto"`: thử live trước; nếu fail thì trả về `fallback_suggested: true`.
- Trả về tất cả components đã chọn với `sku`, `name`, `type`, và `price` nếu parse được.
- `total` có thể null nếu page không hiển thị tổng giá.
- `empty_categories` liệt kê các category chưa có linh kiện.
- Tool KHÔNG được click nút checkout/payment hoặc mở tab mới.

---

## 3. Target Resolution Rules

| Param | Behavior |
|---|---|
| `"live"` | Khởi tạo browser context, navigate đến `https://phongvu.vn/buildpc`, thực hiện flow. |
| `"mock"` | Khởi tạo browser context, navigate đến mock server URL (vd. `http://127.0.0.1:3001`), thực hiện flow. |
| `"auto"` | Thử `"live"`; nếu `FallbackDetector` trả về lý do, đóng context và trả `{ ok: false, fallback_suggested: true, error, target: "live" }`. |

**Agent-side confirm flow** (không nằm trong tool):
1. Agent gọi `add_to_build` / `read_current_build` với `target: "auto"`.
2. Nếu nhận `fallback_suggested: true`, agent hỏi user: "Trang Phong Vu hiện không truy cập được (lý do: ...). Bạn có muốn demo trên trang mock không?"
3. User confirm → agent gọi lại với `target: "mock"`.

---

## 4. Error Envelopes

### 4.1 Business / expected errors

Các lỗi này trả về như successful tool output (`ok: false`) để agent xử lý:

| Error | When | Output field |
|---|---|---|
| `SKU_NOT_FOUND` | Không tìm thấy product card khớp SKU/name trong modal. | `error` |
| `CATEGORY_NOT_FOUND` | Không tìm thấy category row trên page. | `error` |
| `TIMEOUT` | Critical element không xuất hiện trong 30s. | `error` |
| `LOGIN_WALL` | Page redirect đến login hoặc xuất hiện login form. | `error` |
| `ANTIBOT_DETECTED` | Phát hiện captcha / challenge page. | `error` |
| `SELECTOR_BROKEN` | Critical selector không tìm thấy sau retry (UI đổi). | `error` |
| `UNREACHABLE` | Page không load được (network/DNS). | `error` |
| `MOCK_UNAVAILABLE` | Mock server không khởi động được hoặc không reachable. | `error` |

### 4.2 Unexpected plugin errors

Nếu `execute` throw (vd. import failure, Playwright crash), catch và return:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"ok\":false,\"error\":\"Unexpected error in add_to_build\",\"details\":\"...\"}"
    }
  ]
}
```

- Không leak stack trace.
- Không crash gateway.

---

## 5. Browser Automation Contract

### 5.1 Page object selectors

Chỉ dùng semantic selectors (text/aria/role/`data-*`). Không hardcode emotion class.

```typescript
const PageObject = {
  live: {
    url: "https://phongvu.vn/buildpc",
    buildListContainer: '[class*="teko-col-8"]:has(button[aria-label="Chọn"])',
    categoryRow: (label) => `...text match ${label}...`,
    categoryChooseButton: 'button[aria-label="Chọn"]',
    modal: '[role="dialog"]',
    productCard: (sku) => `[data-sku="${sku}"]`,
    productChooseButton: 'button[aria-label="Chọn"]',
  },
  mock: {
    url: "http://127.0.0.1:3001",
    buildListContainer: "[data-testid='build-list']",
    categoryRow: (label) => `[data-category='${label}']`,
    categoryChooseButton: "button[data-action='choose-category']",
    modal: "[data-testid='product-modal']",
    productCard: (sku) => `[data-sku='${sku}']`,
    productChooseButton: "button[data-action='choose-product']",
  },
};
```

### 5.2 Wait strategy

- Mỗi `waitFor` có timeout 30 giây (configurable).
- Retry interval 150–300ms.
- Product list load async → sau khi modal mở, phải `waitFor(() => findFirstProduct(modal), timeout)`.

### 5.3 Browser context lifecycle

- Mỗi invocation tạo Playwright browser context mới hoặc dùng context do OpenClaw cung cấp.
- Đóng context trong `finally` block.
- Không reuse cookies/session giữa các invocation (tránh cross-user contamination).

---

## 6. Mock Build-PC Page Contract

### 6.1 Routes

| Method | Route | Description |
|---|---|---|
| GET | `/` | Render mock build-PC page. |
| GET | `/api/catalog` | Trả toàn bộ catalog JSON. |
| POST | `/api/reset` | Reset build state về rỗng. |

### 6.2 Page behavior

- Category rows giống layout phongvu: label + "Chọn" button.
- Click "Chọn" → mở modal → load product cards async (~200ms).
- Mỗi product card có `data-sku`, `data-name`, `data-price`.
- Click "Chọn" trên product card → đóng modal, thêm vào build list.
- Build list hiển thị selected components + total.
- `read_current_build` parse từ build list container.

### 6.3 Catalog source

Mock page catalog là full replica từ `@buildmate/catalog` (002) hoặc static `catalog.json`. Theo FR-009 và Q1 clarification, mock catalog mirrors real site categories và representative SKUs.

---

## 7. Non-Goals (Explicitly Excluded)

- Chrome Extension overlay — deferred.
- Checkout / payment flow — out of scope.
- Multi-tab browser automation — out of scope.
- Compatibility validation trong DOM tools — deferred to Compiler tool.
- SKU resolution từ catalog nếu catalog chưa implement — fallback theo SKU pattern/name match.
- Persistent session/cookie giữa các tool invocation — OpenClaw owns session.
- Anti-bot bypass / captcha solving — detect and fallback only.
- Real-time stock sync — catalog owned by 002.

---

## 8. Runtime Verification

Sau khi install plugin và restart gateway:

```powershell
openclaw plugins inspect buildmate-tools --runtime --json
```

Expected: `contracts.tools` chứa đủ 6 tool names bao gồm `add_to_build` và `read_current_build`.

End-to-end verification:
1. Khởi động mock build-PC server.
2. Trong WebChat, gọi `read_current_build` với `target: "mock"` → expect empty build.
3. Gọi `add_to_build` với `sku: "CPU-AM5-001"`, `target: "mock"` → expect success.
4. Gọi `read_current_build` với `target: "mock"` → expect build chứa CPU đã thêm.
5. (Optional) Test `target: "auto"` với live site unreachable → expect `fallback_suggested: true`.
