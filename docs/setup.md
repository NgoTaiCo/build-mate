# Machine Setup — BuildMate

Tài liệu cho thành viên mới: cài gì vào máy để chạy/develop BuildMate.

## 1. Yêu cầu tối thiểu

| Component | Version | Mục đích |
|---|---|---|
| Node.js | 22.19+ LTS hoặc 24 | OpenClaw runtime |
| OpenClaw | latest (`openclaw@latest`) | Gateway + agent + session + memory |
| Chrome | bất kỳ bản gần đây | Test Extension MV3 |
| Model API key | mimo pro (opencode Go plan) | LLM provider cho OpenClaw |

## 2. Cài OpenClaw

```powershell
npm install -g openclaw@latest
openclaw onboard --install-daemon   # cấu hình + daemon auto-restart
```

Verify:
```powershell
openclaw gateway                    # start gateway
# mở http://127.0.0.1:18789/  → WebChat UI
```

## 3. Cấu hình OpenClaw tối thiểu (`~/.openclaw/openclaw.json`)

```json5
{
  session: {
    dmScope: "per-channel-peer",              // mỗi khách 1 session
    reset: { mode: "idle", idleMinutes: 60 }, // demo sạch
  },
  memory: { backend: "qmd" },                 // cross-session recall
  agents: {
    defaults: {
      model: "<mimo-pro-provider-ref>",       // verify ref với opencode docs
      workspace: "~/.openclaw/workspace",
    },
  },
}
```

Verify model: `openclaw dashboard` → chat "hello" → agent reply = gateway+model OK.

## 4. Project này

```powershell
# cd vào project
# (Khi có code production) cài deps theo từng package
```

Kiến trúc & scope: đọc `AGENTS.md` + `docs/adr/README.md` trước.

## 5. Extension approach

Cách extension Chrome thao tác trên `phongvu.vn/buildpc` (cấu trúc DOM, selector stable/brittle, SyntheticEvent, keep-alive, code patterns) nằm trong `docs/extension-phongvu-integration.md`. Extension là stretch (xem ADR-0003), không phải primary demo 1 ngày.

## 6. OpenClaw reference (capability + tools)

Xem `docs/openclaw-reference.md` (compile từ docs chính thức) để biết: sessions, tools plugin SDK, channels (Zalo native), skills, multi-agent, browser automation.

## 7. Troubleshooting nhanh

| Triệu chứng | Xử lý |
|---|---|
| `openclaw` không chạy | check Node version ≥ 22.19; cài lại `-g openclaw@latest` |
| Gateway crash | daemon auto-restart; session durable trên disk → resume |
| mimo pro không reply | verify provider ref + API key trong `openclaw.json` |
| Extension không inject | check `content_scripts.matches` (cả non-www `phongvu.vn`) + reload extension |
