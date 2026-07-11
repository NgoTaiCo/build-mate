# BuildMate Extension - Test Execution Plan

## Quick Start (5 phút)

```bash
# Terminal 1: Start DOM bridge
cd /Users/ngotaico/Projects/build-mate
node tools/dom-bridge-simulator.mjs

# Terminal 2: Start MCP server (optional, cho full integration test)
cd packages/buildpc-mcp-server
npm run build
node dist/index.js

# Browser: Load extension
# 1. Mở chrome://extensions
# 2. Bật Developer mode
# 3. Click "Load unpacked"
# 4. Chọn thư mục: /Users/ngotaico/Projects/build-mate/apps/chrome-extension
```

## Test Sequence

### ✅ Stage 1: Mock Page (Baseline)

**Goal:** Verify extension work với mock page (data-attributes đầy đủ)

```bash
# Mở mock page
open http://127.0.0.1:8781/mock-buildpc
```

**In Console:**
```javascript
// Load test suite
// (Copy-paste nội dung test-console.js vào Console)

// Run tests
await BuildMateTests.runAll()
// Expected: All tests PASS

// Test add GPU
await BuildMateTests.addGpu()
// Expected: { ok: true, snapshot: { components: [1 GPU] } }
```

**Pass criteria:**
- ✅ `readBuild()` detect empty build
- ✅ `openCategory("gpu")` mở modal
- ✅ `addComponent()` thêm được GPU
- ✅ `readBuild()` sau khi add có 1 component

---

### 🎯 Stage 2: Real Page - Structure Inspection

**Goal:** Understand DOM structure của phongvu.vn thật

```bash
# Mở trang thật
open https://phongvu.vn/buildpc
# (Login nếu phongvu yêu cầu)
```

**In Console:**
```javascript
// Load test suite
// (Copy-paste test-console.js)

// Inspect structure
await BuildMateTests.inspect()
```

**Expected output:**
```
📦 Found X teko-col-8 containers
  [0] Cấu hình 1 Cấu hình 2 ... (tabs container)
  [1] CPU Chưa chọn Chọn ...
  [2] VGA Chưa chọn Chọn ...
  ...

🏷️  Category Rows:
  cpu: ✅ Found
  gpu: ✅ Found
  ram: ✅ Found
  ...

🪟 Modal Selectors:
  [role="dialog"]: ❌ No match (modal chưa mở)
  ...
```

**Action items:**
- ✅ Nếu category rows FOUND → selectors work
- ❌ Nếu NOT FOUND → cần debug `categoryRow()` logic
  - Check: DOM structure đổi?
  - Check: Label text đổi? ("VGA" → "Card màn hình")

---

### 🎯 Stage 3: Real Page - Read Build

**Goal:** Parse được components đã chọn từ DOM thật

**Steps:**
1. Manually chọn 2 linh kiện trên UI:
   - Click nút "Chọn" của CPU → chọn 1 CPU bất kỳ
   - Click nút "Chọn" của VGA → chọn 1 VGA bất kỳ

2. **In Console:**
   ```javascript
   await BuildMateTests.read()
   ```

**Expected output:**
```
✅ Found 2 components
  1. cpu: Intel Core i5-12400F (sku-xyz)
  2. gpu: Radeon RX 7800 XT (sku-abc)
  Total: 25000000 VND
```

**Pass criteria:**
- ✅ `components.length` match số linh kiện đã chọn
- ✅ `name` có tên sản phẩm (không phải "Chưa chọn")
- ✅ `sku` hoặc `vendor_product_id` có giá trị
- ✅ `total` parse được số tiền

**Common failures:**
- ❌ `components: []` → `categoryRow()` không detect selected state
  - Debug: Inspect row element, check có gì khác giữa "Chưa chọn" vs đã chọn
- ❌ `name: "Chưa chọn"` → `componentFromRow()` parse sai
  - Debug: Check children structure, name element ở đâu?
- ❌ `sku: "AUTO-GPU-..."` → không extract được từ href
  - Debug: Link format đổi? Check regex pattern

---

### 🎯 Stage 4: Real Page - Open Modal

**Goal:** Mở được modal chọn linh kiện

**In Console:**
```javascript
await BuildMateTests.openGpu()
```

**Expected:**
```
✅ PASS: Modal opened
Modal element: <dialog>...</dialog>
  Products/buttons found: 50
```

**Pass criteria:**
- ✅ `result.ok === true`
- ✅ Modal xuất hiện trên UI
- ✅ Products detected > 0

**Common failures:**
- ❌ `CATEGORY_NOT_FOUND` → `categoryRow()` fail
  - Rerun Stage 2 inspect
- ❌ `CATEGORY_BUTTON_NOT_FOUND` → nút text đổi ("Chọn" → "Sửa")
  - Check: Category đã có component chưa? Nút sẽ là "Sửa"
  - Should work: code đã handle cả "Chọn" và "Sửa"
- ❌ `MODAL_TIMEOUT` → modal selector không match
  - Debug: `document.querySelector('[role="dialog"]')` có trả về gì không?
  - Nếu null → emotion class đổi, cần update selector

---

### 🎯 Stage 5: Real Page - Add Component (Final Boss)

**Goal:** Thêm được 1 linh kiện qua automation

**Prerequisites:**
- Modal VGA đang mở (từ Stage 4)
- Đã có real SKU (extract từ modal)

**Steps:**

1. **Extract real SKU:**
   ```javascript
   await BuildMateTests.findSku()
   ```
   Output:
   ```
   ✅ Real SKU found: VGA-XYZ-123
   📋 Copy để dùng cho addComponent test:
   {
     "sku": "VGA-XYZ-123",
     "vendor_product_id": "VGA-XYZ-123",
     "name": "Radeon RX 7800 XT...",
     "category": "gpu"
   }
   ```

2. **Close modal** (click nút đóng hoặc ESC)

3. **Test add:**
   ```javascript
   // Paste object từ step 1
   const component = {
     sku: "VGA-XYZ-123",
     vendor_product_id: "VGA-XYZ-123",
     name: "Radeon RX 7800 XT",
     category: "gpu"
   };
   
   const result = await BuildMateDomAdapter.addComponent(component);
   console.log(result);
   ```

**Expected:**
```
{ 
  ok: true, 
  added: { sku: "...", name: "...", ... },
  snapshot: { 
    components: [...],
    total: ...
  }
}
```

**Visual verification:**
- ✅ Modal mở
- ✅ (Optional) AMD filter click nếu component name có "AMD"
- ✅ Product card có highlight/click
- ✅ Modal đóng
- ✅ VGA row trên UI hiện tên component đã chọn

**Pass criteria:**
- ✅ `result.ok === true`
- ✅ `result.snapshot.components` có GPU vừa add
- ✅ UI reflect change (VGA row không còn "Chưa chọn")

**Common failures:**

- ❌ `PRODUCT_LIST_TIMEOUT` → Products load chậm
  - Wait longer hoặc check network tab
  - Possible: anti-bot blocking?

- ❌ `PRODUCT_NOT_FOUND` → `findProduct()` không match SKU
  - SKU format sai? Try lại với SKU khác
  - Check: `vendor_product_id` có trong href không?

- ❌ `PRODUCT_BUTTON_NOT_FOUND` → Nút "Chọn" trong card không tìm được
  - Inspect card structure: nút ở đâu?
  - Text có đúng "Chọn" không? (có thể "Thêm vào giỏ"?)

- ❌ `VERIFY_TIMEOUT` → Add thành công nhưng `readBuild()` không detect
  - Rerun `BuildMateTests.read()` → có component không?
  - Nếu không → `componentFromRow()` parse fail

---

## Full MCP Integration Test (Optional)

Sau khi pass tất cả console tests, test qua MCP protocol:

```bash
# Get context_id
curl http://127.0.0.1:8781/contexts

# Copy context_id từ response
```

**In Claude Desktop / OpenClaw chat:**

```
User: Test read_current_build với context_id: abc-123-xyz
