# BuildMate DOM Bridge Extension

Extension này là **DOM executor**: nhận lệnh semantic (`read_build`, `add_component`,
`remove_component`) từ BE bridge và thao tác trên trang BuildPC (`phongvu.vn/buildpc`
hoặc trang mock). Nó **không** chứa Catalog, Compiler, OpenClaw credential, và **không**
nhận selector/JavaScript do server gửi xuống — selector chỉ nằm trong `dom-adapter.js`.

## Luồng đúng (WebSocket)

```
OpenClaw ──▶ MCP tool (read_current_build / add_to_build / revert_component)
          ──▶ POST /dom-commands            (HTTP, MCP → BE bridge)
BE bridge ──▶ dom.command  ─┐
                            │  WebSocket /dom-bridge  (BE ⇄ extension, 1 socket / tab)
extension ◀────────────────┘
   └─▶ chrome.tabs.sendMessage(tabId, BUILDMATE_DOM_COMMAND) → content script (DOM adapter)
   └─▶ dom.result ──▶ BE bridge ──▶ MCP result ──▶ OpenClaw
```

- BE bridge = `packages/chat-backend/src/dom-bridge.ts` (WebSocket server tại `/dom-bridge`
  + HTTP `POST /dom-commands` cho MCP).
- Mỗi tab BuildPC = **một WebSocket outbound** từ extension, định danh bằng `context_id`.
  Socket đóng ⇒ BE xóa mapping ngay ⇒ lệnh tới tab chết fail nhanh (`CONTEXT_OFFLINE`).

## Extension phải implement gì (contract WebSocket)

Service worker (`background.js`) chịu trách nhiệm transport. Với **mỗi tab** đã đăng ký:

1. **Mở WebSocket** tới bridge URL (mặc định `ws://127.0.0.1:8790/dom-bridge`).
2. Khi `open`, gửi register:
   ```json
   { "type": "dom.register", "context_id": "<uuid>", "page_url": "https://phongvu.vn/buildpc" }
   ```
3. Nhận lệnh từ bridge:
   ```json
   { "type": "dom.command", "command_id": "<uuid>",
     "command": { "action": "read_build" | "add_component" | "remove_component",
                  "component": { ... }, "expected_revision": "..." } }
   ```
   → forward **command semantic** (không phải selector) tới content script qua
   `chrome.tabs.sendMessage(tabId, { type: "BUILDMATE_DOM_COMMAND", command })`.
4. Trả kết quả (nguyên văn từ DOM adapter):
   ```json
   { "type": "dom.result", "command_id": "<uuid>", "ok": true,
     "snapshot": { "status", "components", "total", "revision" },
     "added": { ... }, "removed": { ... }, "error": "...", "modal_closed": true }
   ```
5. Socket đóng ⇒ **reconnect + register lại** (backoff). Tab đóng / rời `/buildpc` ⇒ đóng socket.

`context_id` do **content script tạo** (`crypto.randomUUID()`) và gửi cho service worker
qua port `chrome.runtime.connect({ name: "buildmate-dom-bridge" })` message `REGISTER`.
Content script phải log/expose `context_id` để agent biết dùng (xem "Truyền context_id").

Không được: gửi selector/JS lên bridge, tự chọn sản phẩm gần đúng, coi click thành công
khi chưa verify SKU trong snapshot.

## Cấu hình bridge URL

Mặc định `ws://127.0.0.1:8790/dom-bridge`. Đổi khi trỏ tới BE khác:

```js
// DevTools của service worker (chrome://extensions → service worker → Inspect)
chrome.storage.local.set({ bridgeUrl: "wss://your-be.example.com/dom-bridge" })
```

Đổi host thì phải thêm host đó vào `manifest.json` → `host_permissions`
(cả `http(s)://host/*` và `ws(s)://host/*`).

## Chạy local (đúng luồng WS)

```bash
# 1) BE bridge (chat-backend) — WS /dom-bridge + HTTP /dom-commands trên :8790
#    Cần OPENCLAW_DEVICE_SEED + OPENCLAW_GATEWAY_TOKEN trong env.
npm --workspace @buildmate/chat-backend run build && node packages/chat-backend/dist/index.js

# 2) MCP server, trỏ vào BE bridge
npm --workspace @buildmate/buildpc-mcp-server run build
BUILDMATE_DOM_RELAY_URL=http://127.0.0.1:8790 node packages/buildpc-mcp-server/dist/http.js
#   (docker compose đã set BUILDMATE_DOM_RELAY_URL=http://chat-backend:8790 sẵn)

# 3) Load extension: chrome://extensions → Developer mode → Load unpacked → apps/chrome-extension/
# 4) Mở trang BuildPC (thật hoặc mock). Service worker tự mở WS + register.
#    Kiểm tra: /healthz của chat-backend báo domContexts > 0.
```

Trang mock để test không cần phongvu thật: chạy `node tools/dom-bridge-simulator.mjs`
rồi mở `http://127.0.0.1:8781/mock-buildpc` (simulator chỉ dùng để **serve trang mock**;
bridge thật là chat-backend :8790).

## Truyền context_id tới agent (để full chat flow chạy)

Agent OpenClaw phải gọi tool với đúng `context_id` của tab. `context_id` chỉ sinh ở
content script, nên cần đưa nó vào hội thoại: frontend/WebChat gửi kèm `context_id`
trong request `/chat` → chat-backend chuyển vào context OpenClaw → agent điền vào
`read_current_build`/`add_to_build`. (Phần này nằm ngoài extension.)

## Files

- `manifest.json` — permissions, `host_permissions` (bridge host), content_scripts
- `background.js` — **service worker**: WebSocket tới bridge, register/command/result, reconnect
- `content-script.js` — inject page, tạo `context_id`, nối port, chạy DOM command
- `dom-adapter.js` — **core**: parse/click DOM, fail-closed selectors (nơi DUY NHẤT có selector)
- `dom-probe.js` — layout contract report cho trang BuildPC thật
- `panel.js` / `panel.css` — overlay UI (status + user intent)
- `TESTING.md`, `TEST-PLAN.md` — hướng dẫn test DOM adapter

## Production Notes

- BE bridge thay simulator nhưng **giữ nguyên wire contract** (`docs/dom-executor-bridge-contract.md`).
- Bridge chỉ nên chấp nhận connection đã authenticated + kiểm origin/page URL
  (`https://phongvu.vn/buildpc`) — xem guard §5 của contract (chưa bật ở bản dev).
- `replace_existing: true` / revert chỉ gửi sau khi agent nhận explicit user confirmation.
- Nếu phongvu.vn đổi UI ⇒ cập nhật selector theo `docs/extension-phongvu-integration.md`.
