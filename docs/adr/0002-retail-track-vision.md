# ADR-0002: Retail Track Vision — P1–P4 trên xương OpenClaw

- **Status:** Accepted (vision dài hạn, **không phải scope hackathon** — xem ADR-0003)
- **Date:** 2026-07-06
- **Depends on:** ADR-0001

> MOC: xem `README.md`. File này = WHY dài hạn.

---

## 1. Context

Phong Vu retail track nêu 4 problems (`docs/ideas-problems/phongvu_problems.md`). Chúng chia sẻ xương OpenClaw (gateway+agent+session+memory) + pattern "tool plugin". Không build 4 silo — build 1 xương, instantiate theo problem.

| # | Problem | Channel OpenClaw native? | Tool tự xây chính |
|---|---|---|---|
| P1 | AI sales agent (web/app) | **WebChat** (+ Extension stretch) | Compiler + Catalog + DOM exec + guide_checkout |
| P2 | Recommendation/cross-sell | WebChat | Compiler mở rộng (bundle scoring) + CDP tool |
| P3 | Agent copilot (social) | **Zalo native** + agent dashboard | Agent-assist surface + Crm tool |
| P4 | Self-service BI (NL2SQL) | WebChat/Control UI | Query Governor + DW tool |

---

## 2. Decision — 1 xương OpenClaw, 4 instantiation

### Mapping problem → instantiation

| Lớp (ADR-0001 §3) | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| **Channel** | WebChat (+ Extension stretch) | WebChat dynamic | **Zalo native** + agent dashboard | WebChat/Control UI |
| **Agent+session+memory** | dùng chung | dùng chung | dùng chung | dùng chung |
| **Model provider** | mimo pro | mimo pro | mimo pro | mimo pro |
| **Tool plugin tự xây** | Compiler + Catalog + DOM + guide_checkout | + `score_bundles` + `get_customer_profile` (CDP) | + `search_kb` + `lookup_order` (CRM) | + `generate_sql` + `validate_query` (Governor) + `run_query` (DW) |
| **Trust layer** | Compiler (compatibility) | Compiler + bundle scoring | Compiler (chế độ suggest, human-in-loop) | Query Governor (schema+RBAC) |
| **KPI đề bài** | +15-20% conv, -20% drop, offload 40% inquiry | +12-15% AOV, +10% retention, +30% rec engagement | -50% response time, +40% capacity, +15% CSAT | -70% report time, -50% IT ad-hoc |

### Điểm khác biệt cốt lõi
- **P1 vs P3:** cùng agent, khác channel (WebChat customer vs Zalo agent-assist) + khác chế độ thực thi (auto-execute vs human-in-loop suggest).
- **P2** = mở rộng Compiler từ "valid/invalid" thành "score bundle theo AOV/affinity" + data CDP.
- **P4** = **pattern match** BuildMate: NL → structured build → deterministic validate ↔ NL → SQL → Governor validate. Cùng thesis ADR-0001 nguyên tắc 2.

### Tái dụng (Reuse ROI)
| Component | Build lần đầu (Phase) | Tái dụng cho |
|---|---|---|
| OpenClaw gateway+agent+session+memory | Phase 0 | P1, P2, P3, P4 (100%) |
| Tool plugin pattern + Compiler | Phase 0 (P1) | P2 (extend), P3 (suggest mode), P4 (governor analog) |
| WebChat channel | Phase 0 | P1, P2, P4 |
| Zalo channel (native, không build) | — | P3 |
| DOM execution (browser automation) | Phase 0 | P1, P2 (dynamic layout) |

→ Tiết kiệm ước tính **60-70% effort** Phase 1-2 so với 4 silo.

---

## 3. Roadmap phân pha

```
PHASE 0 — HACKATHON (1+1 ngày): P1 MVP  ← xem ADR-0003
  └── Xương OpenClaw + Compiler + Catalog + DOM exec + WebChat.
      Seed P2: repair plan = cross-sell (latent).
      Seed P3: cùng agent, chỉ đổi channel (Zalo) — verify native.

PHASE 1 — POST-HACKATHON (1-3 tháng): P1 production + P3 + P2
  ├── P3: bật Zalo channel native + agent-assist surface (human-in-loop) + Crm tool.
  ├── P2: mở rộng Compiler → bundle scoring + CDP tool + WebChat dynamic layout.
  └── P1: thay MockCatalog → PhongVuApi, Extension overlay (stretch → primary).

PHASE 2 — (3-6 tháng): P4
  └── Query Governor tool + DW tool + BI console. Chứng minh platform generalize.
```

---

## 4. Consequences

### Tích cực
- 3/4 lớp dùng chung, chỉ channel + tool thay đổi → tái dụng cao.
- 1 xương OpenClaw = dữ liệu đồng bộ (cùng session store, cùng memory).
- Trust pattern nhất quán (deterministic validate) cho cả customer-facing (P1/P2/P3) lẫn internal (P4).
- Zalo native → P3 thực chiến hơn draft cũ tưởng.

### Tiêu cực / Trade-off
- Bỏ P2/P3/P4 trong hackathon — mitigate: DevPost 1 slide "Platform Vision" (file này §2) + P1 live demo.
- Phase 1 cần data readiness từ Phong Vu (CDP, CRM, DW). Mitigate: Phase 0 mock đủ; Phase 1 deal dữ liệu.

---

## 5. Alternatives Considered

| Alt | Loại vì |
|---|---|
| 4 solution silo | 4× effort, 4× debt, không tận dụng xương OpenClaw chung |
| Chỉ P1, bỏ P2/P3/P4 hẳn | Mất narrative enterprise; lãng phí pattern match (đặc biệt P4) |
| 4 problem cùng lúc trong hackathon | 1+1 ngày không thể (xem ADR-0003) |
| Platform-first (build xong 4 lớp rồi mới P1) | Over-engineer, trễ deadline. Đúng cách: P1 MVP trước, generalize dần |
