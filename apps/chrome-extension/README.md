# BuildMate DOM Bridge Extension

Extension này là DOM executor: nhận `read_build` hoặc `add_component` từ relay simulator và thao tác trên trang BuildPC (phongvu.vn/buildpc hoặc mock). Nó không có Catalog, Compiler, OpenClaw credential hay selector do server gửi xuống.

## Architecture

```
MCP Server → HTTP Relay (8781) → Extension (content script) → phongvu.vn DOM
              ↓
         Mock BuildPC page
```

- **Content Script**: Inject vào phongvu.vn/buildpc, expose `BuildMateDomAdapter`
- **Service Worker**: Poll commands từ relay, forward đến content script
- **DOM Adapter**: Pure functions parse/interact DOM với robust selectors
- **Dev Panel**: Overlay UI hiện connection status + quick actions

## Quick Start

1. **Start relay:**
   ```bash
   node tools/dom-bridge-simulator.mjs
   ```

2. **Load extension:**
   - Mở `chrome://extensions`
   - Bật Developer mode
   - Click "Load unpacked"
   - Chọn `apps/chrome-extension/`

3. **Test với mock page:**
   ```bash
   open http://127.0.0.1:8781/mock-buildpc
   ```
   
   Console:
   ```javascript
   BuildMateDomAdapter.readBuild()
   // { status: "ready", components: [], total: 0 }
   ```

4. **Test với trang thật:**
   ```bash
   open https://phongvu.vn/buildpc
   ```
   
   Xem chi tiết: **[TEST-PLAN.md](./TEST-PLAN.md)**

## Files

- `manifest.json` - Extension config (permissions, content_scripts)
- `content-script.js` - Inject vào page, handle MCP commands
- `dom-adapter.js` - **Core logic**: parse DOM, click elements, fail-closed selectors
- `dom-probe.js` - Observed layout contract report for the live BuildPC page
- `dev-panel.js` - Dev overlay UI
- `service-worker.js` - Background, poll relay, keep-alive
- `test-console.js` - Console test helper
- `TESTING.md` - Testing guide với debug tips
- `TEST-PLAN.md` - Step-by-step test execution plan

## Key Features (dom-adapter.js)

✅ **Observed DOM contract**:
- `Probe DOM` ghi nhận category action, visible modal, và product identity thực tế trên tab đang mở
- Mutation chỉ dùng semantic dialog + exact vendor identity; class Emotion và dynamic ID chỉ xuất hiện trong diagnostics
- `categoryRow()`: quét TẤT CẢ `teko-col-8`, filter theo text + button presence
- Handle cả nút "Chọn" và "Sửa" (category đã chọn)

✅ **Async modal handling**:
- `waitFor(findFirstProduct)` đợi product list load (không chỉ modal shell)
- Filter support: auto-detect AMD/NVIDIA/Intel/DDR4/DDR5 từ component name

✅ **Real page parsing**:
- `readBuild()` chỉ trả component khi page expose identity từ data attribute hoặc product link; không sinh SKU giả
- Parse total từ nhiều fallback selectors
- Extract SKU từ link `href` với regex

## Testing

Xem **[TEST-PLAN.md](./TEST-PLAN.md)** cho step-by-step guide.

Quick console test:
```javascript
// Load test suite (copy-paste test-console.js)
await BuildMateTests.runAll()

// Manual tests
BuildMateTests.read()        // Test readBuild()
BuildMateTests.openGpu()     // Test mở modal
BuildMateTests.inspect()     // Inspect page structure
BuildMateTests.findSku()     // Extract real SKU từ modal
```

## MCP Integration

Get context_id:
```bash
curl http://127.0.0.1:8781/contexts
```

Use MCP tools (via Claude Desktop / MCP client):
```javascript
read_current_build({ context_id: "..." })
add_to_build({ context_id: "...", component: { sku, vendor_product_id, name, category } })
```

## Production Notes

Trong production, Backend replaces relay simulator nhưng giữ nguyên wire contract. URL relay và permissions chỉ dùng cho local dev, không phải production config.

Extension được thiết kế để work với:
- ✅ Mock page (http://127.0.0.1:8781/mock-buildpc) - data-attributes đầy đủ
- ✅ Real phongvu.vn/buildpc - robust selectors fallback semantic attrs

Nếu phongvu.vn thay đổi UI structure → update selectors theo guide trong `docs/extension-phongvu-integration.md`.
