# BuildMate Extension - Testing Guide

## Mục đích

Verify extension đọc và thêm linh kiện được trên **trang thật phongvu.vn/buildpc** sau khi upgrade robust selectors.

## Prerequisites

1. **DOM Bridge Simulator** đang chạy: `node tools/dom-bridge-simulator.mjs`
2. **MCP Server** đang chạy: `cd packages/buildpc-mcp-server && npm run build && node dist/index.js`
3. **Chrome Extension** đã load: `chrome://extensions` → Developer mode → Load unpacked `apps/chrome-extension/`

## Test Levels

### Level 1: Mock Page (Smoke Test)

✅ **Đã pass** - Mock page dùng data-attributes nên luôn work.

```bash
# Mở mock page
open http://127.0.0.1:8781/mock-buildpc
```

**Console test:**
```javascript
// Read empty build
BuildMateDomAdapter.readBuild()
// Expected: { status: "ready", components: [], total: 0, ... }

// Add GPU
await BuildMateDomAdapter.addComponent({
  sku: "GPU-001",
  vendor_product_id: "PV-GPU-001",
  name: "Demo Radeon RX 7800 XT",
  category: "gpu"
})
// Expected: { ok: true, added: {...}, snapshot: { components: [1 item] } }

// Read after add
BuildMateDomAdapter.readBuild()
// Expected: components array has 1 GPU
```

### Level 2: Real Page - Read Only

🎯 **Critical Test** - Verify `readBuild()` parse được DOM thật.

```bash
# Mở trang thật (cần login trước nếu phongvu.vn yêu cầu)
open https://phongvu.vn/buildpc
```

**Steps:**
1. Manually chọn 1-2 linh kiện trên UI (VGA + CPU chẳng hạn)
2. Mở Console, chạy:
   ```javascript
   BuildMateDomAdapter.readBuild()
   ```
3. **Verify output:**
   - `components[]` có đúng 2 items?
   - `name` parse được từ DOM?
   - `sku` hoặc `vendor_product_id` extract từ href?
   - `total` parse được?

**Expected Issues:**
- ❌ Nếu `components: []` → `categoryRow()` không tìm được row → inspect DOM structure
- ❌ Nếu `name: "Chưa chọn"` → `componentFromRow()` parse sai → check selector logic
- ❌ Nếu `total: 0` nhưng UI hiện tổng → total selector sai

**Debug Commands:**
```javascript
// Test categoryRow() cho GPU
const labels = ["VGA", "Card màn hình", "Card đồ họa"];
const cols = document.querySelectorAll('[class*="teko-col-8"]');
for (const col of cols) {
  for (const row of col.children) {
    const rowText = row.textContent.replace(/\s+/g, " ").trim();
    if (labels.some(label => rowText.includes(label))) {
      console.log("Found GPU row:", row, rowText);
    }
  }
}

// Test componentFromRow() cho selected row
const gpuRow = /* paste row từ trên */;
const children = [...gpuRow.children];
for (const child of children) {
  console.log(child.tagName, child.textContent.trim().substring(0, 50));
}
```

### Level 3: Real Page - Open Category

🎯 **Critical Test** - Verify `openCategory()` mở được modal.

**Console test:**
```javascript
// Test mở VGA modal
await BuildMateDomAdapter.openCategory("gpu")
// Expected: { ok: true, modal: <dialog element> }

// Inspect modal structure
const modal = document.querySelector('[role="dialog"]');
console.log("Modal found:", modal);
console.log("Products in modal:", modal.querySelectorAll("article, div[class*='product']").length);

// Test findFirstProduct()
const firstBtn = [...modal.querySelectorAll("button")].find(b => /^Chọn$/i.test(b.textContent.trim()));
console.log("First 'Chọn' button:", firstBtn);
```

**Expected Issues:**
- ❌ `{ ok: false, error: "CATEGORY_NOT_FOUND" }` → `categoryRow()` fail
- ❌ `{ ok: false, error: "CATEGORY_BUTTON_NOT_FOUND" }` → button selector sai (có thể là "Sửa" thay vì "Chọn")
- ❌ `{ ok: false, error: "MODAL_TIMEOUT" }` → modal selector không match, inspect `document.querySelector('[role="dialog"]')`

### Level 4: Real Page - Add Component (End-to-End)

🎯 **Final Boss** - Verify `addComponent()` full flow.

**Prerequisites:**
- Trang phongvu.vn/buildpc đã load
- Extension connected (check dev panel overlay)
- Chưa chọn GPU (hoặc ready để replace)

**Steps:**
1. Get real component ID từ phongvu catalog:
   ```javascript
   // Mở GPU modal manually, inspect 1 product card
   const card = document.querySelector("article"); // hoặc div[class*='product']
   const link = card.querySelector("a[href]");
   const sku = link.href.match(/\/([A-Z0-9-]+)(?:\.html)?$/i)?.[1];
   console.log("Real SKU:", sku);
   ```

2. Test add:
   ```javascript
   await BuildMateDomAdapter.addComponent({
     sku: "VGA-XYZ", // paste từ step 1
     vendor_product_id: "VGA-XYZ", // same
     name: "Test GPU", // arbitrary
     category: "gpu"
   })
   ```

3. **Expected:** `{ ok: true, added: {...}, snapshot: { components: [...] } }`

**Expected Issues:**
- ❌ `PRODUCT_LIST_TIMEOUT` → `findFirstProduct()` không detect product cards → inspect modal DOM sau khi async load
- ❌ `PRODUCT_NOT_FOUND` → `findProduct()` không match vendor_product_id → try với real SKU from step 1
- ❌ `PRODUCT_BUTTON_NOT_FOUND` → nút "Chọn" trong card không tìm được → inspect card structure
- ❌ `VERIFY_TIMEOUT` → component đã add nhưng `readBuild()` không detect → check `componentFromRow()` parse logic

## MCP Tool Testing (via OpenClaw/Claude Desktop)

Sau khi extension pass console tests, test qua MCP protocol:

1. Get `context_id`:
   ```bash
   curl http://127.0.0.1:8781/contexts
   ```

2. Test `read_current_build` tool:
   ```javascript
   // Trong Claude Desktop chat với BuildMate
   Use read_current_build tool with context_id: "<paste from step 1>"
   ```

3. Test `add_to_build` tool:
   ```javascript
   Use add_to_build tool with:
   - context_id: "<paste>"
   - component: { sku: "GPU-001", vendor_product_id: "PV-GPU-001", name: "Test GPU", category: "gpu" }
   ```

## Debugging Tips

### Inspect trang thật structure

```javascript
// Đếm teko-col-8 containers
document.querySelectorAll('[class*="teko-col-8"]').length

// Xem content từng container
document.querySelectorAll('[class*="teko-col-8"]').forEach((col, i) => {
  console.log(`Container ${i}:`, col.textContent.substring(0, 100));
});

// Tìm modal sau khi click "Chọn"
document.querySelector('[role="dialog"]') || 
document.querySelector('[id^="teko-modal-"]') ||
document.querySelector('[class*="css-"]')

// List tất cả buttons trong modal
const modal = document.querySelector('[role="dialog"]');
[...modal.querySelectorAll("button")].map(b => b.textContent.trim())
```

### Check emotion classes

Nếu modal selector fail, emotion class có thể đã đổi:

```javascript
// Sau khi click "Chọn" VGA, inspect modal element
$0 // trong DevTools Elements tab, chọn modal rồi switch sang Console
// Copy class name, update dom-adapter.js line ~160
```

### Selector brittle checklist

- ❌ `[class*="css-xxxxx"]` — emotion class đổi mỗi build
- ❌ `[id^="teko-modal-random"]` — dynamic ID
- ❌ `div:nth-of-type(3)` — positional, vỡ khi đổi order
- ✅ `[role="dialog"]` — semantic, stable
- ✅ `[aria-label="AMD"]` — semantic, stable
- ✅ `button` với text "Chọn" — stable nếu phongvu không đổi copy

## Success Criteria

✅ Task #6 pass khi:

1. **Mock page**: read + add work (smoke test)
2. **Real page read**: `readBuild()` parse được 1-2 components đã chọn manually
3. **Real page open**: `openCategory("gpu")` mở được modal, detect products
4. **Real page add**: `addComponent()` thêm được 1 GPU, verify snapshot

Nếu 1 trong 4 fail → debug theo section trên, update selectors, re-test.

## Known Limitations

- **Login wall**: Nếu phongvu.vn yêu cầu login, phải login manual trước test
- **Anti-bot**: Rate limit / CAPTCHA → test với delay, hoặc switch mock
- **UI changes**: Phongvu đổi structure → update selectors theo guide `docs/extension-phongvu-integration.md`
- **Emotion classes**: CSS class names đổi → fallback sang semantic attrs (role/aria)
