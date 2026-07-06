# Standards — Chuẩn hóa & Governance

## 1. ADR governance
- Mỗi quyết định kiến trúc = 1 ADR, file riêng, đánh số tăng dần trong `docs/adr/`.
- Format: `Status / Date / Deciders / Sources / Context / Decision / Consequences / Alternatives`.
- Sửa ADR cũ = ADR mới đánh dấu `Amends/supersedes: <old>`. Không xóa ADR cũ.
- MOC (`docs/adr/README.md`) luôn cập nhật. Nguồn sự thật kiến trúc = ADR-0001; conflict → ADR số lớn hơn ghi đè scope hẹp hơn.

## 2. Code style
- **Không comment** trừ khi yêu cầu (let code tự nói).
- **Compiler = pure functions**, package riêng, unit-test độc lập (không phụ thuộc OpenClaw runtime).
- **Tool plugin** theo SDK (`api.registerTool`), server-side in-process.
- **Selector**: chỉ text/aria/role trong code; emotion class/dynamic ID/nth-of-type nằm trong manifest JSON (tách rời).
- Không emoji trong code.
- TypeScript ESM cho plugin (theo `docs/openclaw-reference.md` §4).

## 3. Doc style
- Văn phong tiếng Việt + thuật ngữ kỹ thuật giữ English.
- Không để narrative khám phá/thử nghiệm (spike, "đã PASS", "đã xóa") vào doc vĩnh viễn — doc là sự thật tĩnh.
- Mỗi doc có mục đích rõ, không overlap. Tham chiếu chéo bằng link tương đối.
- MOC cho mọi thư mục con.

## 4. Skill usage
- Skills cài toàn cục (xem `AGENTS.md` toolkit table). Invoke khi task khớp description:
  - `understand-anything` — onboarding/hiểu codebase.
  - `repomix` — đóng gói codebase cho LLM/handoff.
  - `boundary-architect` — quyết định ranh giới module.
  - `speckit` — spec/PRD.
  - `rtk` — toolchain wrapper.
- Dùng `find-skills` khi cần capability mới.

## 5. Branch / commit / review
- Branch ngắn, commit message ngắn gọn match repo style.
- Không commit secrets/keys (API key nằm trong `~/.openclaw/openclaw.json`, không trong repo).
- Review trước merge: check test xanh, không phá nguyên tắc vàng (AGENTS.md).
- Không force-push, không amend shared branch.

## 6. Folder structure (chuẩn)
```
docs/
├── adr/                    quyết định kiến trúc (MOC + ADR)
├── roadmap/                định hướng (MOC + goals/future/expansion/maintenance/standards)
├── ideas-problems/         vision gốc + problem set
├── setup.md                cài máy
├── openclaw-reference.md   capability OpenClaw
└── extension-phongvu-integration.md  guide extension ↔ phongvu
AGENTS.md                   system prompt cho AI agent
.opencode/opencode.json     config opencode
```
- Production code (khi có) tách khỏi docs. Code thử nghiệm/POC (nếu có) để `experiments/` hoặc `spikes/`, không trộn production.

## 7. Pre-flight checklist (trước demo/deploy)
- [ ] `node -v` ≥ 22.19, `openclaw --version` OK.
- [ ] `npm test` (Compiler) xanh.
- [ ] `openclaw gateway` chạy, WebChat mở, chat "hello" reply.
- [ ] Video backup journey sẵn sàng.
- [ ] Mock page fallback sẵn sàng.
