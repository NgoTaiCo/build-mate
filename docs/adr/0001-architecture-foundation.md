# ADR-0001: Architecture Foundation & Operational Behavior

- **Status:** Accepted
- **Date:** 2026-07-06
- **Deciders:** BuildMate team
- **Sources:** [docs.openclaw.ai](https://docs.openclaw.ai), `docs/ideas-problems/`, `docs/extension-phongvu-integration.md`

> MOC: xem `README.md`. File này = nguồn sự thật kiến trúc + hành vi vận hành.

---

## 1. Context

BuildMate là AI **PC Build Compiler** cho Phong Vu retail. Điểm khác biệt = **Build Compiler deterministic** (LLM không đoán compatibility) + **repair workflow** kiểu debugger (`E001 SOCKET_MISMATCH`…).

### Sửa giả định sai từ draft cũ
Draft cũ (`first_shower_ideas.md`, `pivot_ideas.md`) coi OpenClaw là "reasoning layer" hoặc "chat gateway mỏng" cần Backend Gateway + SessionStore riêng. **Sai.** Docs chính thức xác nhận OpenClaw là **self-hosted gateway + embedded agent runtime** tích hợp, owns durable sessions + QMD memory + 35+ model providers + WebChat + Zalo native + tool plugin SDK + browser automation + compaction.

→ Kiến trúc thực tế đơn giản hơn nhiều: OpenClaw gánh gateway/session/memory/channel/keep-alive; ta chỉ build **tool plugin** (Compiler + Catalog) + **DOM execution**.

---

## 2. OpenClaw capabilities (verified)

| Khả năng | Chi tiết | Tác động BuildMate |
|---|---|---|
| Sessions durable | `~/.openclaw/agents/<agentId>/sessions/sessions.json` + `<sessionId>.jsonl` | Không tự xây SessionStore (xem §4) |
| DM isolation | `session.dmScope: "per-channel-peer"` | Mỗi khách 1 session, an toàn đa user |
| Cross-session recall | QMD memory backend + `sessions_history` tool | Khách quay lại sau reset → vẫn nhớ |
| WebChat | Web UI + WebSocket native, port 18789 | Channel P1 sẵn dùng, mọi browser |
| Zalo channel | Plugin official | P3 native, không tự xây adapter |
| Model providers | 35+ (OpenAI/Anthropic/OpenAI-compatible/self-hosted) | mimo pro cắm ở đây |
| Tool plugin SDK | `api.registerTool(...)`, server-side in-process | Compiler + Catalog = tool plugin |
| Browser automation | Tool built-in | Auto-add linh kiện (primary path) |
| Compaction + pruning | Tự tóm tắt hội thoại dài | Kiểm soát token cost |
| Daemon mode | `openclaw onboard --install-daemon` | Auto-restart khi crash |

---

## 3. Decision — Kiến trúc 4 lớp trên xương OpenClaw

```
┌──────────────────────────────────────────────────────────────────┐
│  CHANNEL LAYER                                                   │
│  WebChat (primary, mọi browser) │ Chrome Extension (stretch)    │
│  Zalo (P3) │ WhatsApp/Telegram… (long-term)                     │
└──────────────────────────┬───────────────────────────────────────┘
                           │ WebSocket native (port 18789)
┌──────────────────────────┴───────────────────────────────────────┐
│  OPENCLAW GATEWAY + EMBEDDED AGENT + SESSION + MEMORY            │
│  • nguồn sự thật duy nhất cho session/routing/channel            │
│  • agent runtime: tool dispatch, prompt assembly, streaming      │
│  • session durable trên disk + QMD memory + compaction           │
│  • KHÔNG tự xây Backend Gateway / SessionStore                   │
└──────────────────────────┬───────────────────────────────────────┘
                           │ tool dispatch (in-process, server-side)
┌──────────────────────────┴───────────────────────────────────────┐
│  TOOL PLUGINS (ta xây — pure functions, dễ unit test)            │
│  ┌─ Build Compiler (DETERMINISTIC, IP cốt lõi) ───────────────┐ │
│  │  compile_build · detect_errors · repair_build              │ │
│  │  → E001 SOCKET_MISMATCH / E002 RAM_GEN_MISMATCH / W001…    │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌─ Catalog ────────────┐  ┌─ Checkout ───────────────────┐    │
│  │  search_components   │  │  guide_checkout              │    │
│  │  compare_components  │  │  (guide, KHÔNG payment)       │    │
│  └──────────────────────┘  └──────────────────────────────┘    │
│  ┌─ DOM execution ────────────────────────────────────────────┐ │
│  │  read_current_build · add_to_build                         │ │
│  │  primary: OpenClaw browser automation (server-side)        │ │
│  │  stretch: Extension remote-tool bridge (in-tab DOM)        │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────────┘
                           │ provider config
┌──────────────────────────┴───────────────────────────────────────┐
│  MODEL PROVIDER                                                  │
│  mimo pro (opencode Go plan) — OpenAI-compatible endpoint        │
└──────────────────────────────────────────────────────────────────┘
```

### 5 nguyên tắc kiến trúc
1. **OpenClaw owns session/memory** — không tự xây Backend Gateway hay SessionStore.
2. **Build Compiler = deterministic trust layer** = tool plugin server-side, pure functions, unit-testable. LLM **không** đoán compatibility.
3. **Model là provider config**, không phải layer orchestrator riêng.
4. **Channel = OpenClaw native** (WebChat primary). Chrome Extension là **stretch** (xem `docs/extension-phongvu-integration.md`).
5. **Ngôn ngữ docs**: văn phong tiếng Việt + thuật ngữ kỹ thuật giữ English.

### Tool inventory (server-side tool plugins)
| Tool | Layer | Deterministic? |
|---|---|---|
| `search_components(criteria)` | Catalog (Mock → PhongVuApi) | Yes |
| `compare_components(skus)` | Catalog | Yes |
| `compile_build(build)` | Compiler | Yes (pure) |
| `detect_errors(build)` | Compiler | Yes (pure) |
| `repair_build(build, errors)` | Compiler | Yes (pure) |
| `guide_checkout(build)` | Checkout | Conversational |
| `read_current_build` | DOM exec | Browser/Extension |
| `add_to_build(sku)` | DOM exec | Browser/Extension |

---

## 4. Hành vi vận hành (operational behavior)

### 4.1. Session & Memory — giải quyết dứt điểm bởi OpenClaw native
- **Store:** `~/.openclaw/agents/<agentId>/sessions/sessions.json` + transcripts `.jsonl`.
- **Session ID stable**, Gateway là nguồn sự thật duy nhất.
- **DM isolation** `session.dmScope: "per-channel-peer"` → mỗi khách session riêng.
- **Cross-session recall:** QMD memory + `sessions_history` (bounded, redacted).
- **Lifecycle:** daily reset (mặc định `atHour:4`) hoặc idle reset hoặc `/new`.

| Tình huống | Hệ quả | Mất dữ liệu? |
|---|---|---|
| User treo máy / đóng tab → quay lại (chưa reset) | Session tiếp tục | Không |
| User quay lại sau reset | QMD memory + sessions_history recall | Không (recall) |
| OpenClaw Gateway crash | Daemon auto-restart; session trên disk resume | Không |
| Đứt mạng giữa turn | OpenClaw queue/steering xử lý | Không |

→ **Trí nhớ/phiên đã giải.** Không cần SessionStore/idempotency layer tự xây cho MVP.

### 4.2. Resilience
- Gateway crash → daemon auto-restart; session durable → resume.
- Single Gateway = SPOF (1 process). MVP chấp nhận; mitigate = daemon + video backup.
- Model provider down → configure `agents.defaults.models` fallback (1 model rẻ dự phòng).
- Compiler = pure function → nếu Gateway lên là Compiler chạy, 0 dependency ngoài.

### 4.3. Cost
- WebSocket: dùng native OpenClaw WebChat (không tự xây keep-alive). Idle/daily reset tự đóng session.
- LLM: **không gọi model cho check deterministic** (Compiler làm free); two-tier model (rẻ cho intent/Q&A, mimo pro cho synthesis); compaction native; cache câu hỏi lặp.

### 4.4. Compiler correctness (dễ nhất)
- Deterministic = unit test. 5 rule × ~3 case = ~15 test. Gate `npm test` xanh trước demo.
- Tách Compiler thành package riêng, test độc lập (không phụ thuộc OpenClaw runtime).

---

## 5. Consequences

### Tích cực
- Giảm ~70% code (OpenClaw làm gateway/session/memory/keep-alive/WebChat).
- Durable sessions + memory free; "treo máy" giải native.
- WebChat = mọi browser, thoát MV3 constraint.
- Multi-channel ready (Zalo cho P3).
- Compiler pure functions → trust layer xác định được.
- Extension approach có guide kỹ thuật (`docs/extension-phongvu-integration.md`): DOM cấu trúc, selector stable/brittle, SyntheticEvent, code patterns.

### Tiêu cực / Trade-off
- Browser automation server-side cần xử lý auth Phong Vu → verify (ADR-0003).
- Extension stretch cần custom channel plugin + remote-tool bridge — hoãn sau hackathon.
- Single Gateway = SPOF (mitigate: daemon + video backup).

---

## 6. Alternatives Considered

| Alt | Loại vì |
|---|---|
| 3-tier cũ (Extension + Backend Gateway + OpenClaw + Adapters tự xây) | Over-build; nhân bản công việc OpenClaw đã có; cao rủi ro MV3 |
| Pure chat, không auto-add | Mất "wow" auto-execute |
| External orchestrator (LangChain/LangGraph) | OpenClaw đã có embedded agent runtime; thêm layer ngoài = phức tạp |
| Tự xây Backend SessionStore (draft ADR-0004 cũ) | Sai — OpenClaw đã owns session durable |
