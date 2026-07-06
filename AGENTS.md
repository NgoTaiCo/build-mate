# AGENTS.md — Hướng dẫn cho AI agent khi làm việc trong project BuildMate

> File này được load làm system prompt (qua `opencode.json → instructions`). Mọi AI mở project này ĐỌC FILE NÀY TRƯỚC.

## BuildMate là gì
AI **PC Build Compiler** cho Phong Vu retail: khách mô tả nhu cầu → build hợp lệ → tự chèn linh kiện → guide checkout. Khác biệt cốt lõi = **Build Compiler deterministic** (LLM không đoán compatibility) + **repair workflow** kiểu debugger (`E001 SOCKET_MISMATCH`…). Backend = OpenClaw (gateway + embedded agent + durable sessions).

## Đọc trước (knowledge base)
| Tài liệu | Mục đích |
|---|---|
| `docs/adr/README.md` | MOC — index ADR. Đọc 0001 → 0002 → 0003 theo thứ tự. |
| `docs/adr/0001-architecture-foundation.md` | Kiến trúc kỹ thuật (openclaw-native). Nguồn sự thật kiến trúc. |
| `docs/adr/0002-retail-track-vision.md` | Tầm nhìn dài hạn P1–P4. |
| `docs/adr/0003-hackathon-execution.md` | Scope + demo + plan 1+1 ngày + risks. |
| `docs/roadmap/` | Định hướng dài hạn: goals, future, expansion, maintenance, standards (MOC `docs/roadmap/README.md`). |
| `docs/openclaw-reference.md` | Capability OpenClaw (verify từ docs.openclaw.ai). |
| `docs/extension-phongvu-integration.md` | Cách extension Chrome thao tác trên phongvu.vn/buildpc (guide kỹ thuật). |
| `docs/ideas-problems/` | Vision gốc + 4 problem Phong Vu. |

## Kiến trúc trong 1 câu
4 lớp trên xương OpenClaw: **Channel** (WebChat primary, Extension stretch) → **OpenClaw Gateway+Agent+Session+Memory** (native, durable) → **Tool plugins** (Build Compiler + Catalog + DOM exec) → **Model provider** (mimo pro). Chi tiết: ADR-0001.

## Quy tắc vàng (KHÔNG vi phạm)
1. **OpenClaw owns session/memory** — KHÔNG tự xây SessionStore riêng. Session durable trên disk (`~/.openclaw/agents/<id>/sessions/`).
2. **Build Compiler = deterministic pure functions** — LLM KHÔNG được đoán compatibility. Mỗi rule phải có unit test.
3. **Model là provider config**, không phải layer orchestrator riêng.
4. **WebChat là channel primary**; Extension = stretch (xem `docs/extension-phongvu-integration.md`).
5. **Ngôn ngữ docs**: văn phong tiếng Việt + thuật ngữ kỹ thuật giữ English.

## Skills toolkit (đã cài toàn cục — invoke khi task khớp)
Khi mở project, các skill dưới đây tự xuất hiện trong `available_skills`. Đọc description của từng skill và invoke khi task khớp:

| Skill | Dùng khi |
|---|---|
| `understand-anything` (family: understand/chat/dashboard/diff/explain/onboard) | onboarding, hiểu kiến trúc codebase, phân tích diff/PR |
| `repomix` | đóng gói codebase thành 1 file text cho LLM (handoff/team, nạp context) |
| `boundary-architect` | quyết định ranh giới module / tách kiến trúc |
| `speckit` | viết spec/PRD (xem SKILL.md) |
| `ponytail` | (xem SKILL.md) |
| `rtk` | CLI toolchain wrapper (xem `~/.claude/RTK.md`) |
| Built-in `customize-opencode` | sửa `.opencode/`, agents, skills, permission |
| Built-in `find-skills` | tìm thêm skill khi cần capability mới |

## Cài máy (AI PHẢI verify khi vào project — assume máy trống)
Khi bắt đầu làm việc trong project này, AI kiểm tra từng prerequisite, **cài nếu thiếu**:

1. **Node.js** — chạy `node -v`. Cần **≥ 22.19** (LTS) hoặc 24. Nếu thiếu hoặc cũ:
   ```powershell
   winget install OpenJS.NodeJS.LTS   # hoặc tải https://nodejs.org (LTS)
   ```
   Sau khi cài, mở terminal mới rồi verify lại `node -v`.
2. **OpenClaw** — chạy `openclaw --version`. Nếu lỗi (chưa cài):
   ```powershell
   npm install -g openclaw@latest
   openclaw onboard --install-daemon
   ```
3. **Chrome** — kiểm tra `Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"` (hoặc `Get-Command chrome -ErrorAction SilentlyContinue`). Nếu thiếu → **cảnh báo user** (cần Chrome cho extension testing; không tự cài được thì nhờ user cài).
4. **Model API key** — check `~/.openclaw/openclaw.json` có `agents.defaults.model` + provider key (mimo pro). Nếu thiếu → **prompt user cung cấp key**, rồi cấu hình provider vào `openclaw.json`.

Sau khi đủ, verify end-to-end:
```powershell
openclaw gateway                       # start gateway
# mở http://127.0.0.1:18789/ → WebChat UI → chat "hello" → agent reply = OK
```
Chi tiết cấu hình: `docs/setup.md`.

## Trạng thái hiện tại
Hackathon: **P1, 1 ngày build + 1 ngày demo**. MVP = **S1** (find+compile) + **S3** (repair). S2/S4 = stretch. Chi tiết: ADR-0003.

## Convention
- ADR ở `docs/adr/`, format ADR chuẩn, đánh số, có MOC (README.md).
- Compiler package phải là pure functions, unit-test độc lập (không phụ thuộc OpenClaw runtime).
- Không emoji trong code/docs trừ khi yêu cầu.
- Code thử nghiệm / POC (nếu có) để riêng, không trộn production code.
