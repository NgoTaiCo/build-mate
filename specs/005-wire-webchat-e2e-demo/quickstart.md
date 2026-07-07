# Quickstart: Wire WebChat end-to-end demo

**Feature**: 005-wire-webchat-e2e-demo  
**Date**: 2026-07-07

## Prerequisites

- Node.js >= 22.19 LTS
- OpenClaw CLI (`npm install -g openclaw@latest`)
- API key cho model provider (mimo pro hoặc fallback OpenAI/Gemini)
- Chrome (nếu muốn test Extension; không bắt buộc cho WebChat demo)

## 1. Install dependencies

```powershell
npm install
```

Nếu dùng workspace:

```powershell
npm install --workspaces
```

## 2. Configure OpenClaw

Tạo hoặc sửa `~/.openclaw/openclaw.json`:

```json5
{
  session: {
    dmScope: "per-channel-peer",
    reset: { mode: "idle", idleMinutes: 60 },
  },
  memory: { backend: "qmd" },
  agents: {
    defaults: {
      workspace: "~/.openclaw/workspace",
      model: "<mimo-pro-provider-ref>",
    },
    list: [
      { id: "buildmate", workspace: "~/.openclaw/workspace-buildmate" },
    ],
  },
  bindings: [
    { agentId: "buildmate", match: { channel: "webchat" } },
  ],
  tools: {
    allow: [
      "search_components",
      "compile_build",
      "detect_errors",
      "repair_build",
      "add_to_build",
      "read_current_build",
    ],
  },
  plugins: {
    enabled: true,
    entries: {
      "buildmate-tools": { enabled: true },
    },
  },
}
```

Thay `<mimo-pro-provider-ref>` bằng provider ref chính xác từ opencode docs.

## 3. Run compiler tests

```powershell
npm test
```

Hoặc test từng package:

```powershell
npm test --workspace=@buildmate/compiler
npm test --workspace=@buildmate/catalog
npm test --workspace=@buildmate/openclaw-tools
npm test --workspace=@buildmate/dom-tools
```

## 4. Build packages

```powershell
npm run build
```

## 5. Install OpenClaw plugin (local dev)

```powershell
openclaw plugins install --link ./packages/@buildmate/openclaw-tools
openclaw plugins inspect buildmate-tools --runtime --json
```

Khởi động lại gateway nếu cần:

```powershell
openclaw gateway restart
```

## 6. Start OpenClaw gateway

```powershell
openclaw gateway
```

Mở browser tại: `http://127.0.0.1:18789/`

## 7. Demo S1 — Tư vấn + biên dịch

Trong WebChat, gõ:

```text
Tôi muốn build PC gaming khoảng 25 triệu
```

Agent sẽ:
1. Gọi `search_components` để tìm linh kiện.
2. Gọi `compile_build` để validate cấu hình.
3. Stream kết quả cấu hình + tổng giá về WebChat.

## 8. Demo S3 — Repair

Gửi một cấu hình lỗi, ví dụ:

```text
Tôi chọn CPU i5-12400F, mainboard B650 AM5, nguồn 400W
```

Agent sẽ:
1. Gọi `detect_errors` → trả về E001 (socket mismatch) và E002 (power insufficient).
2. Gọi `repair_build` → đề xuất mainboard LGA1700 và PSU 650W.
3. Sau khi xác nhận, gọi `add_to_build` để áp dụng linh kiện.
4. Gọi `compile_build` lại và hiển thị cấu hình đã sửa.

## 9. Rehearse full journey

```powershell
node scripts/rehearsal.mjs
```

Script sẽ chạy S1 → S3 một lần và in kết quả `DemoRun` (passed / failed). Chạy lại cho đến khi đạt ít nhất một lần passed.

## 10. Verify gate

Trước khi demo, đảm bảo:

```powershell
npm test
```

Tất cả test xanh.

## Troubleshooting

| Triệu chứng | Xử lý |
| --- | --- |
| `openclaw` không chạy | Kiểm tra Node version >= 22.19; cài lại `npm install -g openclaw@latest` |
| Plugin không load | Chạy `openclaw plugins inspect buildmate-tools --runtime --json`; kiểm tra `openclaw.plugin.json` |
| WebChat không reply | Kiểm tra gateway log, model provider ref, API key |
| Browser automation fail | Fallback sang mock page: đảm bảo `packages/@buildmate/dom-tools` chạy mock server |
