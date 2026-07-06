# Future — Tương lai cần gì (phased roadmap + gaps)

## Phase 0 — Hackathon (1+1 ngày) ✅ sẵn sàng
Xương OpenClaw + Compiler (5 rule) + MockCatalog + WebChat + extension guide (`docs/extension-phongvu-integration.md`). Scope: ADR-0003.

## Phase 1 — Post-hackathon (1–3 tháng)
| Workstream | Việc cần | Dependency ngoài |
|---|---|---|
| P1 production | MockCatalog → PhongVuApi (real price/stock/promo); Extension overlay production | PhongVuApi access từ Phong Vu |
| P3 agent copilot | Bật Zalo channel native + agent-assist dashboard (human-in-loop) + Crm tool | Zalo API + chat logs + CRM API |
| P2 recommendation | Compiler mở rộng bundle scoring + CDP tool + WebChat dynamic layout | CDP / clickstream access |
| Compiler v2 | Thêm rule: case/GPU length, cooler thermal, form factor, upgrade path, bottleneck score | — |

## Phase 2 — (3–6 tháng)
- **P4 self-service BI**: Query Governor tool (schema + RBAC + SQL safety) + DW adapter + BI console.
- Pattern match BuildMate: NL → structured query → deterministic validate. Cùng thesis ADR-0001 nguyên tắc 2.
- Dependency: DW read access (BigQuery/Snowflake) + data dictionary + RBAC.

## Infrastructure gaps (cần giải để scale)
1. **PhongVuApi access** — catalog/price/stock/promo thật (thay mock). Deal với Phong Vu sớm.
2. **CDP / clickstream** — cho P2 personalization.
3. **Zalo/Meta webhooks + chat logs** — cho P3 agent-assist (fine-tune/few-shot).
4. **DW read access + RBAC** — cho P4.
5. **Selector manifest tooling** — tool discovery + version manifest (phongvu đổi UI → update manifest, không sửa code).
6. **Monitoring/observability** — gateway uptime, model cost, tool latency, error rate (xem maintenance.md).
7. **Compiler rule DSL** — khi rule nhiều (>10), tách sang declarative config + test fixture.

## Technical debt để canh
- Hardcoded selectors (chỉ tạm) → chuyển sang manifest.
- Mock catalog → real API.
- Single Gateway (SPOF) → cần replica khi traffic thật.
- Không có auth/user isolation production-grade → DM isolation `per-channel-peer` đủ cho MVP, cần review cho scale.
