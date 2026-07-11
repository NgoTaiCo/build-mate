# Contract: Chrome Extension UI

## Manifest Contract

- Manifest version là 3.
- Content script match chính xác `https://phongvu.vn/buildpc*` và `https://www.phongvu.vn/buildpc*` tại top frame, sau khi document idle.
- Permission duy nhất là `activeTab`.
- Không khai báo host permissions riêng, service worker, remote code hoặc network capability. `panel.css` là web-accessible resource duy nhất, giới hạn ở hai Phong Vu origin vì Chrome chỉ cho `web_accessible_resources.matches` match origin; content script mới là lớp giới hạn chính xác route Build PC.

## Popup-to-Content Contract

Popup chỉ gửi message sau tới active supported tab:

```json
{ "type": "BUILDMATE_TOGGLE_PANEL" }
```

Content script trả acknowledgement:

```json
{ "ok": true, "open": true }
```

Nếu tab không hợp lệ, content script chưa inject hoặc tab đang loading, popup hiển thị hướng dẫn/retry; không throw lỗi ra UI.

## UI Contract

- Mount unique host `buildmate-extension-root` với ShadowRoot open.
- Host chỉ chứa launcher và panel của BuildMate; không query, đọc, sửa hay click UI cấu hình Build PC.
- Panel là non-modal complementary region; Escape đóng panel và focus quay về launcher.
- Mọi data được render từ demo constants trong bundle và mang copy `Demo cục bộ — chưa kết nối dữ liệu Phong Vu`.

## Explicit Non-goals

- OpenClaw/backend integration, WebSocket, remote fetch/XHR, authentication, storage/session persistence.
- Đọc/ghi build từ DOM, synthetic click, auto-add, checkout/payment hoặc multi-tab automation.
- Giá, tồn kho và compatibility thật.
