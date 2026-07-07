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

## Skills toolkit (invoke khi task khớp)
Skills tải từ `.opencode/skills/` (project-local, đăng ký qua `opencode.json → skills.paths`) + global (`~/.agents/skills`, `~/.claude/skills`). Khi mở project, các skill tự xuất hiện trong `available_skills` — đọc description và invoke khi task khớp.

| Skill | Scope | Dùng khi |
|---|---|---|
| `boundary-architect` | project (`.opencode/skills/`) | quyết định ranh giới module / tách kiến trúc theo ADR-0001 (4 layer + 5 nguyên tắc). Custom skill của BuildMate. |
| `speckit-*` (10 skill: constitution/specify/clarify/plan/tasks/implement/analyze/baseline/checklist/taskstoissues) | project (`.opencode/skills/`) | Spec-Driven Development — phân rã sản phẩm thành feature nhỏ có goal. Xem workflow bên dưới. |
| `understand-anything` (family: understand/chat/dashboard/diff/explain/onboard) | global | onboarding, hiểu kiến trúc codebase, phân tích diff/PR |
| `remotion-best-practices` | global | không liên quan BuildMate, bỏ qua |
| `customize-opencode` | built-in | sửa `.opencode/`, agents, skills, permission |
| `find-skills` | built-in | tìm thêm skill khi cần capability mới |
| `repomix` / `ponytail` | CHƯA cài | nếu cần: `npm exec -y -- skills find repomix` rồi `skills add <owner/repo> --copy -y` |
| `rtk` | CLI wrapper (xem `~/.claude/RTK.md`) | chỉ dùng trong Claude Code, KHÔNG dùng trong opencode bash (bị rewrite sai thành `npm`) |

### Speckit SDD workflow (phân rã feature cho hackathon)
speckit = Spec-Driven Development. Workflow chuẩn (`.specify/memory/constitution.md` đã pre-fill goal + 5 nguyên tắc BuildMate):

1. **Constitution** → goal + nguyên tắc (ĐÃ pre-fill từ ADR-0001/0003 — skip `/speckit.constitution` trừ khi amend).
2. `/speckit.specify <mô tả feature>` → tạo `specs/NNN-<tên>/spec.md` + branch `NNN-<tên>`.
3. `/speckit.clarify` (optional) → resolve ambiguity.
4. `/speckit.plan` → `plan.md` + `research.md` + `data-model.md` + `contracts/`.
5. `/speckit.tasks` → `tasks.md` (dependency-ordered).
6. `/speckit.implement` → execute tasks.
7. `/speckit.analyze` (optional) → consistency check.

Commands opencode (trong `.opencode/command/`): `/speckit.specify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.implement`, `/speckit.clarify`, `/speckit.analyze`, `/speckit.checklist`, `/speckit.constitution`, `/speckit.taskstoissues`.
Commands BuildMate custom: `/boundary` (boundary review theo ADR-0001), `/hackathon` (decompose 1-day features có goal + time-box theo ADR-0003).

### Lưu ý bash trên Windows
speckit scripts nằm ở `.specify/scripts/bash/*.sh` (bash-only). Trên Windows, chạy qua **Git bash** (`C:\Program Files\Git\bin\bash.exe`, Windows paths):
```powershell
bash .specify/scripts/bash/create-new-feature.sh --json --short-name "user-auth" "Add user authentication"
```
KHÔNG dùng `C:\Windows\system32\bash.exe` (WSL — Linux paths `/mnt/d/...` sẽ làm hỏng path output JSON).

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

## Active Technologies
- TypeScript 5.x trên Node.js 22.17 LTS (LTS đã cài, Constitution Quality Gate = `npm test`) + zero runtime dependency (pure functions); dev-only: `typescript`, `tsx` (chạy TS test), `@types/node` (001-build-compiler-core)
- TypeScript 5.x trên Node.js 22.17 LTS + OpenClaw tool plugin SDK (`openclaw/plugin-sdk`) + `@buildmate/compiler`, `@buildmate/catalog` (workspace/local), `@sinclair/typebox` (parameter schemas); dev-only: `typescript`, `tsx`, `@types/node` (003-wire-openclaw-plugins)
- N/A — pure functions, không persist, không I/O (001-build-compiler-core)
- N/A — plugin stateless, không persist, không I/O; OpenClaw owns session/memory (003-wire-openclaw-plugins)

## Recent Changes
- 001-build-compiler-core: Added TypeScript 5.x trên Node.js 22.17 LTS (LTS đã cài, Constitution Quality Gate = `npm test`) + zero runtime dependency (pure functions); dev-only: `typescript`, `tsx` (chạy TS test), `@types/node`
- 003-wire-openclaw-plugins: Added OpenClaw tool plugin package `@buildmate/openclaw-tools` wrapping `compile_build`, `detect_errors`, `repair_build`, `search_components`; install via `openclaw plugins install --link`; runtime verify via `openclaw plugins inspect buildmate-tools --runtime --json`
