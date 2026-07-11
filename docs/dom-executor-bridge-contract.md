# DOM Executor Bridge Contract

> Contract handoff giữa MCP server, BE và Chrome extension. Local relay `:8781`
> hiện tại là simulator để kiểm chứng; production thay bằng BE bridge này.
>
> **Transport đang ship:** BE bridge (`packages/chat-backend/src/dom-bridge.ts`)
> và extension hiện dùng **HTTP long-poll** (không phải WebSocket): extension
> `POST /contexts` để register, `GET /commands?context_id=` long-poll, và
> `POST /commands/:command_id/result` để trả kết quả; MCP gọi `POST /dom-commands`.
> Phần §3–4 mô tả bản WebSocket là hướng tương lai — semantic (ID, action,
> guard, result envelope) giữ nguyên.

## 1. Ranh giới trách nhiệm

| Thành phần | Trách nhiệm | Không làm |
|---|---|---|
| OpenClaw | agent reasoning, native session/memory, gọi MCP tool | không biết selector/DOM |
| MCP server | validate tool input semantic, gọi BE bridge, trả tool result | không kết nối trực tiếp Chrome |
| BE bridge | authenticate, định tuyến command/reply, timeout pending command | không sở hữu session/memory OpenClaw |
| Extension | giữ connection, định tuyến đúng tab, thực thi DOM adapter | không nhận JavaScript/selector từ server |
| Content script | click/đọc/verify trên `phongvu.vn/buildpc` | không tự chọn sản phẩm gần đúng |

## 2. ID và lifecycle

- `openclaw_session_key`: session hội thoại do OpenClaw sở hữu. BE chỉ chuyển key
  theo channel hiện có, không tạo SessionStore mới.
- `context_id`: UUID do extension tạo cho một tab BuildPC đang mở. Nó chỉ là
  địa chỉ DOM tạm thời, không phải conversation session.
- `command_id`: UUID do BE tạo cho một command; dùng để correlate reply và chống
  xử lý reply trùng.
- `tab_id`: chỉ dùng nội bộ extension service worker để gửi message tới content
  script; không phải tool input.

`context_id` hết hiệu lực khi tab đóng, navigation rời `/buildpc`, hoặc
extension disconnect. BE xóa mapping connection khi WebSocket đóng.

## 3. Luồng production

```text
OpenClaw -> MCP tool -> BE HTTP command API -> BE WebSocket -> extension worker
  <- MCP result <- BE pending-command reply <- content script DOM adapter
```

1. Extension tạo WebSocket outbound tới BE và gửi `dom.register`.
2. BE bind `context_id` với authenticated connection/tab.
3. Agent OpenClaw gọi `read_current_build` hoặc `add_to_build` qua MCP.
4. MCP server gửi command semantic tới BE; BE push xuống extension.
5. Service worker chuyển command tới content script của tab tương ứng.
6. Content script thực thi, verify DOM snapshot, rồi trả `dom.result`.
7. BE resolve pending command và MCP trả kết quả cho OpenClaw.

Extension chỉ cần outbound WebSocket; không cần expose port từ Chrome về internet.

UI confirmation không gọi MCP hoặc DOM adapter trực tiếp. Nó gửi semantic user
intent tới BE; OpenClaw mới quyết định gọi `add_to_build` sau khi reasoning và
compiler validation hoàn tất.

## 4. Wire messages

### Extension đăng ký

```json
{
  "type": "dom.register",
  "context_id": "8b2d4d92-0c95-4f5b-aec5-73a624fea9c1",
  "page_url": "https://phongvu.vn/buildpc"
}
```

### MCP server gọi BE

`POST /v1/dom/commands`

```json
{
  "context_id": "8b2d4d92-0c95-4f5b-aec5-73a624fea9c1",
  "action": "add_component",
  "component": {
    "sku": "250509159",
    "vendor_product_id": "250509159",
    "name": "Card man hinh Asus Dual GeForce RTX 5060 8GB GDDR7 OC Edition",
    "category": "gpu",
    "filter_labels": ["GeForce RTX 50 series"],
    "replace_existing": false,
    "product_url": "https://phongvu.vn/...--s250509159"
  }
}
```

`action` chỉ nhận `read_build`, `add_component` hoặc `remove_component`.
`remove_component` phải kèm `component` exact và nên kèm `expected_revision`
từ snapshot ngay sau lần add để tránh xóa nhầm thay đổi mới của người dùng.

`filter_labels` là optional exact text của facet đã biết từ Catalog/storefront,
chỉ để thu hẹp danh sách trước khi tìm exact SKU. Đây không phải CSS selector;
extension vẫn phải tìm đúng `vendor_product_id` và verify sau khi click.

### BE push command xuống extension

```json
{
  "type": "dom.command",
  "command_id": "3d9aa23f-55d8-4cdf-b5f0-bdf5ace2c49c",
  "command": {
    "action": "add_component",
    "component": {
      "sku": "250509159",
      "vendor_product_id": "250509159",
      "name": "Card man hinh Asus Dual GeForce RTX 5060 8GB GDDR7 OC Edition",
      "category": "gpu"
    }
  }
}
```

### Extension trả result

```json
{
  "type": "dom.result",
  "command_id": "3d9aa23f-55d8-4cdf-b5f0-bdf5ace2c49c",
  "ok": true,
  "snapshot": {
    "status": "ready",
    "components": [
      {
        "sku": "250509159",
        "vendor_product_id": "250509159",
        "name": "Card man hinh Asus Dual GeForce RTX 5060 8GB GDDR7 OC Edition",
        "category": "gpu",
        "product_url": "https://phongvu.vn/...--s250509159"
      }
    ],
    "total": 9390000,
    "revision": "[\"250509159\"]"
  }
}
```

Failure response dùng cùng envelope, với `ok: false` và `error`, ví dụ:
`CONTEXT_OFFLINE`, `CATEGORY_NOT_FOUND`, `PRODUCT_NOT_FOUND`,
`PRODUCT_OUT_OF_STOCK`, `COMPONENT_ALREADY_SELECTED`, `VERIFY_TIMEOUT`.
Với failure sau khi extension đã mở product modal, response có thêm
`modal_closed: true` sau khi dọn UI thành công.

`remove_component` có thêm các guard `REVERT_CONFLICT`,
`COMPONENT_NOT_SELECTED`, `REMOVE_BUTTON_NOT_FOUND` và
`REMOVE_VERIFY_TIMEOUT`.

## 5. Guard bắt buộc

- BE chỉ chấp nhận extension connection đã authenticated; kiểm tra origin và
  page URL là `https://phongvu.vn/buildpc`.
- BE không forward raw selector, JavaScript hoặc URL command từ agent tới
  extension. DOM adapter là nơi duy nhất sở hữu selector.
- `replace_existing: true` chỉ được gửi sau khi agent nhận explicit user
  confirmation. Mặc định là guard `COMPONENT_ALREADY_SELECTED`.
- UI "Hoàn tác" chỉ gửi user intent tới BE. OpenClaw gọi `revert_component`
  sau khi xác nhận component/revision; UI không tự click Xóa.
- Catalog dùng để chọn exact SKU; trạng thái `Liên hệ` đọc từ DOM là kiểm tra
  tồn kho cuối cùng vì catalog có thể stale.
- BE đặt TTL cho pending command, ví dụ 15 giây, và reject context offline.
- Extension trả snapshot sau mutation; MCP không coi click thành công nếu chưa
  verify SKU trong BuildPC.

## 6. Việc team BE cần làm

1. Cài WebSocket endpoint cho `dom.register`, heartbeat và `dom.result`.
2. Cài HTTP command endpoint, mapping `context_id -> connection` và timeout.
3. Giữ payload ở phần 4; không đưa OpenClaw session state vào BE store.
4. Sau đó thay `BUILDMATE_DOM_RELAY_URL=http://127.0.0.1:8781` bằng base URL
   của BE. `DomBridgeClient` trong MCP server giữ nguyên interface.
