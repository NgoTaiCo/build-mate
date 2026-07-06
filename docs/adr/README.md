# ADR — Architecture Decision Records

Map of Content (MOC) cho tập hợp ADR của BuildMate. **Đọc theo thứ tự.**

## Danh sách ADR

| ADR | Tên | Mục đích | Phạm vi |
|---|---|---|---|
| [0001](./0001-architecture-foundation.md) | Architecture Foundation & Operational Behavior | Kiến trúc + hành vi vận hành (session/memory/resilience/cost). **Nguồn sự thật.** | WHAT + HOW hệ thống hoạt động |
| [0002](./0002-retail-track-vision.md) | Retail Track Vision | Tầm nhìn dài hạn P1–P4 trên xương OpenClaw. | WHY dài hạn (không phải scope hackathon) |
| [0003](./0003-hackathon-execution.md) | Hackathon Execution | Scope + demo + plan 1+1 ngày + risks. | WHAT/HOW cho hackathon |

## Thứ tự đọc
1. **0001** — hiểu kiến trúc & OpenClaw (đặc biệt §4 hành vi vận hành: session/memory/resilience).
2. **0002** — hiểu bức tranh dài hạn (P1–P4). Không phải scope hackathon.
3. **0003** — hiểu cái sẽ build/demo trong 1+1 ngày + risks.

## Quy ước
- Mỗi ADR: 1 quyết định chính, có `Status / Date / Context / Decision / Consequences / Alternatives`.
- File mới = số tăng dần. Sửa ADR cũ = ADR mới đánh dấu `amends/supersedes`.
- **Nguồn sự thật kiến trúc = 0001.** Nếu conflict giữa các file, file có số lớn hơn ghi đè scope hẹp hơn.

## Tài liệu liên quan
- [`docs/openclaw-reference.md`](../openclaw-reference.md) — capability OpenClaw (verify từ docs.openclaw.ai).
- [`docs/extension-phongvu-integration.md`](../extension-phongvu-integration.md) — cách extension Chrome thao tác trên phongvu.vn/buildpc (guide kỹ thuật).
- [`docs/setup.md`](../setup.md) — cài máy.
- [`../../AGENTS.md`](../../AGENTS.md) — system prompt cho AI agent (overview project + skills toolkit + check máy).
- [`docs/ideas-problems/`](../ideas-problems/) — vision gốc + 4 problem Phong Vu.
- [`docs/roadmap/`](../roadmap/) — định hướng dài hạn (goals, future, expansion, maintenance, standards).
