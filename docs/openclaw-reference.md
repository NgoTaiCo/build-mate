# OpenClaw Reference (cho BuildMate)

> Compile từ [docs.openclaw.ai](https://docs.openclaw.ai) (verified 2026-07-06). Nguồn sự thật = docs online; file này = bản tóm lược thực chiến cho team BuildMate.

## 1. OpenClaw là gì

**Self-hosted gateway + embedded agent runtime** (MIT, open source). Một process Gateway là cầu nối giữa các chat app (Discord, Telegram, WhatsApp, **Zalo**, **WebChat**…) và AI agent. Gateway là **nguồn sự thật duy nhất** cho sessions, routing, channels.

- **Agent-native**: tool use, sessions, memory, multi-agent routing.
- **Self-hosted**: chạy trên máy/VPS của ta, data của ta.
- Cài: `npm install -g openclaw@latest` → `openclaw onboard --install-daemon`.
- Node 22.19+ LTS hoặc Node 24.

## 2. Sessions & Memory (quan trọng cho BuildMate)

> Xem ADR-0001 §4.1 cho cách BuildMate dùng.

- **Gateway owns all session state.** UI clients query gateway.
- **Store:** `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- **Transcripts:** `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`
- **Session ID stable**, OpenClaw chọn. Durable trên disk → survive restart.
- **Routing:** DM share 1 session mặc định; group isolated; cron fresh; webhook isolated.
- **DM isolation** `session.dmScope`:
  - `main` (default) — tất cả DM share 1 session
  - `per-peer` — isolate theo sender, cross-channel
  - `per-channel-peer` (recommended đa user) — isolate theo channel+sender
  - `per-account-channel-peer` — isolate theo account+channel+sender
- **Lifecycle:** daily reset (mặc định `mode:"daily"`, `atHour:4`) / idle reset (`idleMinutes`) / manual `/new`,`/reset`. Heartbeat/cron không kéo dài idle.
- **Maintenance:** `pruneAfter:"30d"`, `maxEntries:500` (mặc định).
- **Cross-session recall:** QMD memory backend + `sessions_history` tool (bounded, redacted — strip thinking signatures, tool-result payloads, XML tags).
- **Compaction:** hội thoại dài tự tóm tắt (xem `/concepts/compaction`).
- **Steering:** inbound prompt giữa run → steer vào run hiện tại sau khi tool call xong.
- Lệnh inspect: `openclaw status`, `openclaw sessions --json`, `/status` trong chat, `/context list`.

Config ví dụ:
```json5
{
  session: {
    dmScope: "per-channel-peer",
    reset: { mode: "idle", idleMinutes: 60 },
    resetByType: { group: { mode: "idle", idleMinutes: 120 } },
  },
  memory: { backend: "qmd" },
}
```

## 3. Agent runtime

- **Embedded agent runtime** (không delegate ra harness ngoài): model discovery, tool wiring, prompt assembly, session management, channel delivery — tích hợp 1 runtime.
- Mỗi agent có: **workspace** (cwd), **agentDir** (auth/model registry), **session store** riêng.
- **Bootstrap files** (inject vào system prompt turn đầu): `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`. File trống = skip; file lớn = trim.
- **Built-in tools:** read/exec/edit/write + system tools. `apply_patch` on cho OpenAI models.
- **Skills** (xem §5).
- **Streaming + chunking:** block streaming (off mặc định), bật per-channel `*.blockStreaming:true`.
- **Model refs:** `provider/model` (split first `/`).
- Multi-agent: `openclaw agents add <id>`, mỗi agent isolated workspace/auth/session. Bindings route inbound → agent.

## 4. Tools & Plugins (cách BuildMate expose Compiler/Catalog)

> Đây là cách BuildMate biến Build Compiler + MockCatalog thành agent tools.

### Plugin shapes
| Shape | Dùng khi |
|---|---|
| Channel plugin | kết nối messaging platform |
| Provider plugin | thêm model/media/search/fetch/speech provider |
| CLI backend plugin | chạy local AI CLI qua model fallback |
| **Tool plugin** | **register agent tools** ← BuildMate dùng cái này |

### Tool plugin — quickstart
`package.json`:
```json
{
  "name": "@buildmate/openclaw-tools",
  "type": "module",
  "openclaw": { "extensions": ["./index.ts"], "compat": { "pluginApi": ">=2026.3.24-beta.2" } }
}
```
`openclaw.plugin.json`:
```json
{
  "id": "buildmate-tools",
  "name": "BuildMate Tools",
  "contracts": { "tools": ["compile_build","detect_errors","repair_build","search_components"] },
  "activation": { "onStartup": true }
}
```
`index.ts`:
```typescript
import { Type } from "typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "buildmate-tools",
  name: "BuildMate Tools",
  description: "Build Compiler + Catalog tools",
  register(api) {
    api.registerTool({
      name: "compile_build",
      description: "Validate a PC build deterministically. Returns OK or error codes (E001 SOCKET_MISMATCH, E002 RAM_GEN_MISMATCH, W001 PSU_LOW_HEADROOM).",
      parameters: Type.Object({ build: Type.Array(Type.Object({ sku: Type.String() })) }),
      async execute(_id, params) {
        // pure function call to Build Compiler package
        const result = compileBuild(params.build);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      },
    });
    // ...detect_errors, repair_build, search_components
  },
});
```

### Tool registration rules
- Tools required (luôn available) hoặc optional (cần `tools.allow` opt-in).
- Mỗi tool phải có manifest `contracts.tools` entry.
- Tool execute **server-side in-process** (pure functions dễ test).
- Optional tools cho side effects; `toolMetadata.<tool>.optional:true`.
- Inspect runtime: `openclaw plugins inspect <id> --runtime --json`.
- Cài local dev: `openclaw plugins install --link ./buildmate-tools` → `openclaw gateway restart`.

### Plugin install sources
`clawhub:<pkg>` / `npm:<pkg>` / `git:...` / local path / `npm-pack:`.
Policy: `plugins.allow` (exclusive allowlist), `plugins.deny` (wins), `plugins.entries.<id>.enabled`.
Hooks: `api.on(...)` (typed, preferred) hoặc `api.registerHook(...)`.

## 5. Skills

> Skills = markdown dạy agent khi nào dùng tool nào. Khác với plugin (code).

- File: `SKILL.md` trong folder, frontmatter `name` + `description`.
- **Loading order** (precedence cao → thấp): workspace `<workspace>/skills` → project-agent `<workspace>/.agents/skills` → personal `~/.agents/skills` → managed `~/.openclaw/skills` → bundled → extra dirs + plugin skills.
- Skill roots hỗ trợ grouped layout (`<root>/personal/foo/SKILL.md` → skill "foo").
- **Per-agent allowlist:** `agents.defaults.skills` (baseline) + `agents.list[].skills` (thay thế, không merge).
- **Gating** qua `metadata.openclaw`: `requires.bins/env/config`, `os`, `primaryEnv`, `install` specs.
- **ClawHub** registry: `openclaw skills install @owner/<slug>` (+ `--global` cho all agents), `openclaw skills update --all`, `openclaw skills verify`.
- Config overrides: `skills.entries.<name>` (`enabled`, `apiKey`, `env`, `config`).
- Env injection: `skills.entries.<key>.env`/`apiKey` inject vào process cho agent run (host, không sandbox).
- Snapshot: skills chụp lúc session start; refresh khi `SKILL.md` đổi hoặc remote node connect.
- Token impact: ~97 chars + name/description/location per skill; compact format khi quá budget.

## 6. Channels

- **Core (ship sẵn):** iMessage, Telegram, **WebChat**.
- **Official plugins** (`openclaw plugins install @openclaw/<id>`): Discord, Feishu, Google Chat, IRC, LINE, Matrix, Mattermost, MS Teams, Nextcloud Talk, Nostr, QQ Bot, Raft, Signal, Slack, SMS, Synology Chat, Tlon, Twitch, Voice Call, WhatsApp, **Zalo**, Zalo Personal.
- **External plugins:** WeChat, Yuanbao, Zalo ClawBot.
- Chạy đồng thời nhiều channel; route per chat.
- DM pairing/allowlist bắt buộc (safety).
- Nhanh nhất setup: Telegram (bot token). WhatsApp cần QR pairing.

→ BuildMate P3 (agent copilot Zalo): dùng **Zalo channel native**, không tự xây adapter.

## 7. Web surfaces

- **Control UI** (Vite + Lit) serve cùng port WebSocket Gateway: default `http://<host>:18789/`. Bật mặc định khi `dist/control-ui` có assets. `gateway.controlUi.basePath` optional.
- **WebChat** = web chat UI over WebSocket (channel core) — BuildMate P1 dùng cái này.
- **Webhooks** khi `hooks.enabled:true`.
- **Admin HTTP RPC:** `POST /api/v1/admin/rpc` (off mặc định, cần plugin `admin-http-rpc`).
- Bind modes: loopback / tailnet / Funnel (public). Non-loopback yêu cầu auth (token/password/trusted-proxy/Tailscale identity).
- TLS: `gateway.tls.enabled:true` → https/wss.

## 8. Browser automation (DOM exec cho BuildMate)

- Built-in tool "browser automation" (agent có thể gọi). Ship kèm skill `browser-automation` (từ browser plugin).
- Dùng cho `read_current_build` / `add_to_build` server-side (primary path ADR-0001).
- Lưu ý: drive trang React có login (phongvu.vn/buildpc) cần verify (xem ADR-0003). Nếu fail → fallback mock trang build PC.

## 9. Multi-agent routing

- **Agent** = full per-persona scope: workspace, auth profiles, model registry, session store.
- **Binding** = map channel account → agent. Deterministic, most-specific wins (exact peer > parent > wildcard > guild > account > channel > default).
- `accountId` = 1 channel instance (vd WhatsApp personal vs biz). `agentId` = 1 "brain".
- DM mặc định collapse về `agent:<agentId>:<mainKey>`.
- Cross-agent QMD search: `agents.list[].memorySearch.qmd.extraCollections`.
- Per-agent sandbox + tool restrictions (`sandbox.mode`, `tools.allow/deny`).
- Lệnh: `openclaw agents add`, `openclaw agents list --bindings`.

## 10. Config essentials (`~/.openclaw/openclaw.json`, JSON5)

```json5
{
  agents: {
    defaults: { workspace: "~/.openclaw/workspace", model: "<provider/model>" },
    list: [ { id: "buildmate", workspace: "~/.openclaw/workspace-buildmate" } ],
  },
  bindings: [ { agentId: "buildmate", match: { channel: "webchat" } } ],
  session: { dmScope: "per-channel-peer", reset: { mode: "idle", idleMinutes: 60 } },
  memory: { backend: "qmd" },
  channels: { /* channel-specific */ },
  tools: { allow: ["compile_build","detect_errors","repair_build","search_components"] },
  plugins: { enabled: true, entries: { "buildmate-tools": { enabled: true } } },
}
```

Paths:
| What | Default |
|---|---|
| Config | `~/.openclaw/openclaw.json` (`OPENCLAW_CONFIG_PATH`) |
| State dir | `~/.openclaw` (`OPENCLAW_STATE_DIR`) |
| Workspace | `~/.openclaw/workspace` |
| Agent dir | `~/.openclaw/agents/<agentId>/agent` |
| Sessions | `~/.openclaw/agents/<agentId>/sessions` |

## 11. Links (đọc thêm khi cần)

- Home: <https://docs.openclaw.ai>
- Multi-agent: `/concepts/multi-agent`
- Session: `/concepts/session`
- Agent runtime: `/concepts/agent`
- Features: `/concepts/features`
- Plugins: `/tools/plugin` · Building plugins: `/plugins/building-plugins`
- Skills: `/tools/skills` · Creating skills: `/tools/creating-skills`
- Channels: `/channels` · WebChat: `/web/webchat`
- Web surfaces: `/web`
- Config: `/gateway/configuration` · Security: `/gateway/security` · Sandboxing: `/gateway/sandboxing`
