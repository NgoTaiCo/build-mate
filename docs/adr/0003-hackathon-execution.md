# ADR-0003: Hackathon Execution — Scope, Demo & 1-Day Plan

- **Status:** Accepted
- **Date:** 2026-07-06
- **Depends on:** ADR-0001, ADR-0002
- **Supersedes:** draft "2 ngày / 4 scene" cũ (BTC ép xuống 1+1 ngày)

> MOC: xem `README.md`. File này = WHAT/HOW cho hackathon.

---

## 1. Context

BTC ràng buộc: **1 ngày build + 1 ngày demo**. Chọn đúng 1 problem, cover trọn build direction trong 1 demo story.

### Chọn problem
| # | Khả thi 1 ngày? | Lý do |
|---|---|---|
| **P1** | ✅ | BuildMate vốn là P1; data mock được; OpenClaw WebChat native |
| P2 | ❌ | Cần CDP/clickstream — không secure kịp |
| P3 | ❌ | Cần chat logs + CRM; Zalo native nhưng agent-assist surface tốn thời gian |
| P4 | ❌ | Cần DW access + RBAC + Governor — quá tải |

→ **Chọn P1.** P2/P3/P4 = long-term (ADR-0002).

### Extension approach
Cách extension thao tác trên `phongvu.vn/buildpc` đã có guide kỹ thuật (`docs/extension-phongvu-integration.md`): cấu trúc DOM, selector stable/brittle, SyntheticEvent, code patterns. Tuy nhiên Extension vẫn là **stretch cho 1 ngày** (cần custom channel plugin + remote-tool bridge để wire vào OpenClaw). Primary demo = WebChat + browser automation/mock page.

---

## 2. Decision — Demo story & scope

> Demo **1 story liên tục "1AM, khách build PC gaming 25M"**, 4 scene khớp 4 capability P1. MVP = S1+S3 (bắt buộc); S2+S4 = stretch.

### 2.1. Demo story
| Scene | Capability P1 | Tool (ADR-0001 §3) | MVP/stretch |
|---|---|---|---|
| **S1 — Tư vấn** | Answer questions + Retrieve stock/price/promo | `search_components` (MockCatalog đủ field) → `compile_build` → stream | **MVP** |
| **S2 — So sánh** | Compare products | `compare_components` → bảng → recommend | Stretch |
| **S3 — Repair** | (wow, timely assistance) | khách chọn build sai (i5-12400F+B650+DDR4) → `detect_errors` → E001/E002/W001 → `repair_build` → `add_to_build` auto-apply | **MVP** |
| **S4 — Checkout** | Guide checkout | `guide_checkout` → summary + navigate (guide, KHÔNG payment) | Stretch |

### 2.2. KPI mapping
| KPI P1 đề bài | Scene |
|---|---|
| +15-20% conversion | S1+S4: assistance in-context giữ intent mua (after-hours 1AM) |
| -20% drop-off discovery | S1+S2: streaming thoughts + compare giữ user engaged |
| Offload 40% basic inquiry | S1 (specs/stock/price/promo) + S3 (compatibility) |

### 2.3. Scope
**IN (1 ngày):** OpenClaw Gateway + 1 agent + mimo pro; WebChat primary (Extension KHÔNG làm trong 1 ngày); tool plugins `search_components`/`compile_build`/`detect_errors`/`repair_build`/`add_to_build` (+`compare_components`/`guide_checkout` nếu stretch); MockCatalog ~50 linh kiện (đủ field price/stock_status/promo); Compiler 5 rule; DOM exec = OpenClaw browser automation (server-side) hoặc **mock trang build PC** fallback.

**OUT:** Chrome Extension overlay (stretch post-hackathon, có guide kỹ thuật); payment thật; cào 100% catalog; P2/P3/P4.

### 2.4. Triage
1. Trễ nhẹ → cắt S2, giữ S1+S3+S4.
2. Trễ nặng → chỉ S1+S3. **S3 (repair) KHÔNG cắt** — differentiator.
3. Browser automation fail → mock trang build PC + nói rõ "production nối PhongVuApi".

---

## 3. 1-Day Build Plan (Probe-first)

Rủi ro còn lại = "OpenClaw browser automation drive được phongvu.vn không?" + "mimo pro cắm provider được không?". Probe 3h đầu để chứng minh.

```
HOUR 0-3: PROBE (validation gate)
  ├── openclaw gateway + onboard daemon; cắm mimo pro provider.
  ├── WebChat chat "hello" → agent reply (gateway+agent+model OK).
  └── browser automation mở phongvu.vn/buildpc → đọc 1 element (DOM reach).
  ► GATE: PASS → tiếp. FAIL → §4 pivot.

HOUR 3-6: Build Compiler (package riêng, pure functions)
  ├── 5 rule + error codes (E001/E002/W001) + repair plan generator.
  └── ~15 unit test. Compile = trust layer sẵn sàng.

HOUR 6-8: MockCatalogAdapter tool (~50 linh kiện, đủ field price/stock/promo).
  └── expose: search_components, compare_components.

HOUR 8-10: Wire Compiler + Catalog thành OpenClaw tool plugin
  └── api.registerTool: compile_build, detect_errors, repair_build, search_components.
  └── openclaw plugins install --link → restart → verify --runtime.

HOUR 10-12: DOM exec + wire flow S1+S3
  ├── add_to_build qua browser automation (hoặc mock trang fallback).
  └── Rehearse S1 (find+compile) → S3 (detect+repair+add).

HOUR 12-14: UI + rehearse (WebChat embed cạnh trang build PC / mock trang).
HOUR 14-16: Video backup full journey S1→S3 (+S2/S4 nếu kịp).
DAY 2: demo (dùng video nếu mạng yếu).
```

---

## 4. Risks & pivot

| Rủi ro | Giảm nhẹ |
|---|---|
| Browser automation không drive được phongvu.vn thật | Mock trang build PC (ta host) — demo vẫn chứng minh compiler + flow |
| mimo pro không cắm provider | Provider khác (OpenAI/Gemini/Ollama local) |
| OpenClaw chính không chạy | Gọi LLM trực tiếp từ BE nhỏ, giữ Compiler |
| Tất cả fail | Mock agent (script reply), Compiler vẫn thật — demo vẫn thấy IP |

→ 4 lớp fallback, không "mất trắng".

### Open questions (verify trước build)
1. OpenClaw browser automation: drive được trang React có login (phongvu.vn/buildpc)? → Probe §3 trả lời.
2. ~~Deploy OpenClaw: local laptop demo hay VPS?~~ → **Chốt: self-host local** (team laptop / on-prem), không dùng cloud. Demo expose qua Cloudflare Tunnel nếu cần.
3. mimo pro provider ref chính xác? (setup đơn giản, xem `docs/setup.md`)

---

## 5. Alternatives Considered

| Alt | Loại vì |
|---|---|
| 4 problem mỏng trong 1 ngày | Không đủ; mỗi problem 1-2 scene lõng bõng |
| P3 (agent copilot) vì Zalo native | Cần chat logs + agent-assist surface; 1 ngày không đủ |
| P4 (NL2SQL) vì pattern match | Cần DW access + Governor; 1 ngày quá tải |
| Chrome Extension làm primary trong 1 ngày | Có guide kỹ thuật nhưng cần custom channel plugin + remote-tool bridge > 1 ngày; WebChat primary an toàn hơn |
| Không làm S3 repair | Mất differentiator "debugger cho PC build"; S3 là IP, phải có |
