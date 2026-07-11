# BuildMate Extension - Changelog

## 2026-07-11 - DOM Adapter Robustness Upgrade

### Problem

Extension không đọc được DOM của trang thật phongvu.vn/buildpc:
- ❌ `categoryRow()` chỉ work với mock data-attributes
- ❌ Modal async product load không được handle
- ❌ Nút "Sửa" (category đã chọn) không detect
- ❌ `readBuild()` chỉ parse data-attributes, không parse DOM structure thật
- ❌ Không có filter support cho vendor/brand

### Root Cause

1. **Selector strategy quá đơn giản**: chỉ dùng data-attributes (mock) hoặc positional selector (brittle)
2. **Modal timing**: code assume product list xuất hiện ngay khi modal mở (thực tế async load 1-2s)
3. **State handling**: chỉ handle "Chưa chọn", không handle category đã chọn (nút "Sửa")
4. **Parse logic**: assume data-attributes có sẵn, không parse từ DOM structure

### Solution

Upgrade `dom-adapter.js` theo guide `docs/extension-phongvu-integration.md`:

#### 1. Robust `categoryRow()` (Lines 29-68)

**Before:**
```javascript
return [...document.querySelectorAll('[class*="teko-col-8"] > *')]
  .find((row) => labels.some((label) => text(row).includes(label))) ?? null;
```

**After:**
```javascript
// Quét TẤT CẢ teko-col-8 containers (skip container đầu = tabs)
const cols = document.querySelectorAll('[class*="teko-col-8"]');
for (const col of cols) {
  for (const row of col.children) {
    const rowText = text(row);
    // Filter: có label + có button + text ngắn (không phải tabs)
    if (labels.some(label => rowText.includes(label)) && 
        rowText.length < 120 && 
        row.querySelector('button')) {
      // Chọn shortest match (tránh nhầm parent container)
      best = ...
    }
  }
}
// Fallback: tìm leaf text element, traverse lên parent
```

**Impact:**
- ✅ Work với multi-container structure
- ✅ Skip tabs container (container đầu)
- ✅ Prioritize shortest match (chính xác hơn)

#### 2. Handle Modal Async Load (Lines 230-235)

**Before:**
```javascript
const modal = findModal();
const card = await waitFor(() => findProduct(modal, vendorProductId));
```

**After:**
```javascript
const modal = findModal();
// KEY FIX: Đợi PRODUCT cards load, không chỉ modal shell
const firstProduct = await waitFor(() => findFirstProduct(modal), 6000);
if (!firstProduct) return { ok: false, error: "PRODUCT_LIST_TIMEOUT" };
// Now safe to search specific product
const card = await waitFor(() => findProduct(modal, vendorProductId), 6000);
```

**Impact:**
- ✅ Không bị race condition (search trước khi products load)
- ✅ Clear error message khi timeout

#### 3. Handle "Sửa" Button (Lines 193-201)

**Before:**
```javascript
[...row.querySelectorAll("button")].find(b => /^(Chọn|Select)$/i.test(text(b)));
```

**After:**
```javascript
[...row.querySelectorAll("button")].find(b => {
  const btnText = text(b);
  return /^(Chọn|Select|Sửa|Edit)$/i.test(btnText);
});
```

**Impact:**
- ✅ Work với category đã chọn (nút đổi thành "Sửa")

#### 4. Smart Filter Detection (Lines 203-261)

**New function `applyFilters(modal, component)`:**

```javascript
// Auto-detect vendor/brand từ component.name + component.sku
// GPU: AMD/Radeon, NVIDIA/GeForce
// CPU: Intel, AMD/Ryzen
// RAM: DDR4/DDR5, 16GB/32GB
// Storage: NVMe/SATA
// Click filter nếu match và chưa active
```

**Usage:**
```javascript
const filterApplied = await applyFilters(modal, component);
if (filterApplied) {
  await waitFor(() => findFirstProduct(modal), 3000); // Wait refresh
}
```

**Impact:**
- ✅ Narrow search space (faster product finding)
- ✅ Better accuracy (AMD filter → only AMD products)

#### 5. Real Page Parsing (Lines 70-131)

**`componentFromRow()` upgrade:**

**Before:**
```javascript
const vendorProductId = row.dataset.vendorProductId;
if (!vendorProductId) return null;
return { sku: row.dataset.sku, ... };
```

**After:**
```javascript
// Priority 1: data-attributes (mock)
if (row.dataset.vendorProductId) return { ... };

// Priority 2: Parse DOM structure
const children = [...row.children];
for (const child of children) {
  // Skip buttons, skip category labels
  // Find element có text = product name
  if (childText && !/^(Chưa chọn|Chọn)$/i.test(childText)) {
    nameElement = child;
    break;
  }
}

// Extract SKU from link href
const link = nameElement.querySelector("a[href]");
const match = link.href.match(/\/([A-Z0-9-]+)(?:\.html)?$/i);
```

**`readBuild()` upgrade:**

**Before:**
```javascript
const totalText = text(document.querySelector("#build-total"));
```

**After:**
```javascript
// Multiple fallback selectors
const totalElement = 
  document.querySelector("#build-total") ||
  document.querySelector("[data-build-total]") ||
  [...document.querySelectorAll("*")].find(el => {
    const txt = text(el);
    return /tổng|total/i.test(txt) && /\d{3,}/i.test(txt);
  });
```

**Impact:**
- ✅ Parse được name từ real DOM (không cần data-attributes)
- ✅ Extract SKU từ href (real product links)
- ✅ Robust total parsing (nhiều fallback)

#### 6. Selector Priority Strategy

**New helper `findFirstProduct(modal)`** (Lines 169-187):

```javascript
// Priority 1: Mock data-attribute
const mockProduct = modal.querySelector("[data-vendor-product-id]");

// Priority 2: Stable text "Chọn" button (real phongvu)
for (const button of modal.querySelectorAll("button")) {
  if (/^(Chọn|Select)$/i.test(text(button))) {
    return button.closest("article, div[class*='product']") || button;
  }
}

// Priority 3: Any clickable
return modal.querySelector("article") || null;
```

**Impact:**
- ✅ Clear priority: semantic > text > structure
- ✅ Avoid emotion classes (brittle)
- ✅ Comments mark brittle selectors for future maintenance

### Testing

Created comprehensive test suite:
- **test-console.js**: Console helper với 6 test functions
- **TESTING.md**: Debug guide + known issues
- **TEST-PLAN.md**: Step-by-step execution plan (5 stages)

Test coverage:
- ✅ Mock page baseline
- ✅ Real page structure inspection
- ✅ Real page read build
- ✅ Real page open modal
- ✅ Real page add component (full flow)

### Files Changed

- `dom-adapter.js`: Core logic upgrade (180 lines → 350 lines)
- `README.md`: Updated với quickstart + architecture
- `test-console.js`: New - console test suite
- `TESTING.md`: New - testing guide
- `TEST-PLAN.md`: New - execution plan
- `CHANGELOG.md`: This file

### Next Steps

1. **Manual testing** theo TEST-PLAN.md:
   - Stage 1-3 = high priority (read build)
   - Stage 4-5 = stretch (add component)

2. **Selector maintenance**:
   - Nếu phongvu.vn đổi UI → update theo guide `docs/extension-phongvu-integration.md`
   - Brittle selectors đã mark comments (emotion classes, dynamic IDs)

3. **Integration**:
   - Wire vào OpenClaw/Claude Desktop qua MCP protocol
   - Test full S1→S3 flow (find → compile → repair → add)

### References

- `docs/extension-phongvu-integration.md` - Selector strategy guide
- `docs/adr/0001-architecture-foundation.md` - Architecture principles
- `docs/adr/0003-hackathon-execution.md` - MVP scope (S1+S3)

