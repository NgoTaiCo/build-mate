# BuildMate Constitution

<!-- Sync Impact Report
- Version change: (new) → 1.0.0
- Source: pre-filled from ADR-0001 (5 nguyên tắc) + ADR-0003 (hackathon scope) on 2026-07-07.
- Added sections: Core Principles (5), Hackathon Constraints, Quality Gates, Governance.
- Templates requiring updates: none (initial adoption).
- Follow-up TODOs: none.
-->

## Core Principles

### I. OpenClaw owns Session & Memory

OpenClaw Gateway + embedded agent runtime là nguồn sự thật duy nhất cho session, routing, channel, memory, compaction. KHÔNG tự xây Backend Gateway, SessionStore, idempotency layer, hay keep-alive. Session durable trên disk tại `~/.openclaw/agents/<agentId>/sessions/`. DM isolation `per-channel-peer`. Cross-session recall qua QMD memory + `sessions_history`.

Rationale: OpenClaw đã có toàn bộ capability này; tự xây = nhân bản + tăng rủi ro.

### II. Build Compiler = Deterministic Trust Layer

Build Compiler là tool plugin server-side, pure functions, unit-testable độc lập (không phụ thuộc OpenClaw runtime). LLM KHÔNG được đoán compatibility. Mỗi rule có unit test. Error codes chuẩn: `E001 SOCKET_MISMATCH`, `E002 RAM_GEN_MISMATCH`, `W001`... Repair workflow kiểu debugger.

Rationale: Đây là IP cốt lõi; deterministic = trust layer xác định được + giảm token cost (không gọi model cho check).

### III. Model = Provider Config

mimo pro (opencode Go plan, OpenAI-compatible endpoint) là provider config trong `~/.openclaw/openclaw.json`, KHÔNG phải layer orchestrator riêng. Không thêm LangChain / LangGraph ngoài OpenClaw.

Rationale: OpenClaw đã có embedded agent runtime; thêm layer ngoài = phức tạp không cần thiết.

### IV. WebChat = Channel Primary

WebChat native (port 18789, mọi browser) là channel primary. Chrome Extension là stretch (xem `docs/extension-phongvu-integration.md`). Zalo = P3.

Rationale: WebChat thoát MV3 constraint + chạy mọi browser; Extension cần custom channel plugin + remote-tool bridge > 1 ngày.

### V. Docs Tiếng Việt + English Thuật Ngữ

Văn phong docs = tiếng Việt; thuật ngữ kỹ thuật giữ English. ADR ở `docs/adr/`, format chuẩn, đánh số, có MOC. Compiler package = pure functions, unit-test độc lập. Không emoji trong code/docs trừ khi yêu cầu. Code thử nghiệm để riêng, không trộn production.

Rationale: Team Phong Vu retail Việt Nam; giữ rõ ràng thuật ngữ kỹ thuật chuẩn quốc tế.

## Hackathon Constraints (ADR-0003)

- **Time-box**: 1 ngày build + 1 ngày demo. Mọi feature phải fit trong 16h plan: Probe 0-3h → Compiler 3-6h → MockCatalog 6-8h → Wire plugin 8-10h → DOM exec 10-12h → UI rehearse 12-14h → Video backup 14-16h.
- **MVP**: S1 (tư vấn: `search_components` → `compile_build` → stream) + S3 (repair: `detect_errors` → E001/E002/W001 → `repair_build` → `add_to_build`). S3 KHÔNG cắt — differentiator.
- **Stretch**: S2 (`compare_components`), S4 (`guide_checkout`).
- **OUT**: Chrome Extension overlay, payment thật, cào 100% catalog, P2/P3/P4.
- **Fallback layers**: browser automation fail → mock trang build PC; mimo pro fail → provider khác; OpenClaw fail → BE nhỏ giữ Compiler; tất cả fail → mock agent + Compiler thật.

## Quality Gates

- `npm test` phải xanh trước demo (Compiler ~15 unit test, 5 rule × ~3 case).
- Mọi code Tool-plugin-layer deterministic phải có unit test độc lập (không phụ thuộc OpenClaw runtime).
- Mỗi feature mới: chạy `boundary-architect` skill (`.opencode/skills/boundary-architect`) để verify ranh giới layer trước khi implement.
- Feature decomposition: dùng speckit SDD workflow — `/speckit.constitution` (skip, đã pre-fill) → `/speckit.specify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`.
- Git branch theo speckit: `NNN-short-name` (3-digit number tự tăng).

## Governance

Constitution supersedes all other practices. Amendments require: ADR mới hoặc update ADR-0001, approval, migration plan. Version bump theo semver: MAJOR (principle removal/redefinition), MINOR (new principle/section), PATCH (clarification/wording). Mọi PR/review phải verify compliance với 5 nguyên tắc.

**Version**: 1.0.0 | **Ratified**: 2026-07-06 | **Last Amended**: 2026-07-07
