# Goals — Mục tiêu & Success Metrics

## Mục tiêu hackathon (ngắn hạn)
**P1 MVP demo** trong 1 ngày build + 1 ngày demo: chứng minh thesis "AI build compiler" — khách mô tả nhu cầu → build hợp lệ → repair sai → tự chèn linh kiện → guide checkout.
- MVP = **S1** (find+compile) + **S3** (repair, E001/E002/W001). S2/S4 = stretch.
- Demo story: "1AM, khách build PC gaming 25M".

### Success metrics hackathon
- Demo chạy mượt (S1→S3) trên WebChat + mock page (hoặc browser automation).
- Giám khảo thấy được 2 differentiator: **deterministic compiler** (không hallucinate) + **repair workflow kiểu debugger**.
- Có video backup phòng mạng yếu.

## Mục tiêu post-hackathon (Phase 1, 1–3 tháng)
P1 production + P3 (agent copilot Zalo) + P2 (recommendation/cross-sell).
- P1: thay MockCatalog → PhongVuApi thật; Extension overlay (stretch → primary nếu làm).
- P3: bật Zalo channel native (OpenClaw) + agent-assist surface (human-in-loop) + Crm tool.
- P2: mở rộng Compiler → bundle scoring (AOV/affinity) + CDP tool.

## North star dài hạn
**AI-native decision layer cho retail Phong Vu** (từ `docs/ideas-problems/first_shower_ideas.md`):
- Khách mua tự tin (config hợp lệ, budget khôn, next action rõ).
- Sales bắt lead tốt (after-hours, quote/lead capture).
- Retailer giảm friction trong high-consideration purchase.

### North star metrics (theo Phong Vu problems)
| Metric | Nguồn problem | Mục tiêu |
|---|---|---|
| Conversion rate web/app | P1 | +15–20% trong 6 tháng |
| Drop-off product discovery | P1 | −20% |
| Basic inquiry offload | P1/P3 | −40% tải sales |
| Average Order Value | P2 | +12–15% |
| Retention / repeat purchase | P2 | +10% |
| Agent response time | P3 | −50% |
| Ticket capacity | P3 | +40% không thêm headcount |
| Report turnaround | P4 | −70% (NL2SQL) |

→ Mỗi metric map về 1 ADR/tính năng cụ thể, đo được, có baseline.
