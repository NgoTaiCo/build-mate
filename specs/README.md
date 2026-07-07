# Specs MOC — Hackathon BuildMate

> Index + tracking cho 8 feature spec. Source of truth: ADR-0001 (kiến trúc) + ADR-0003 (scope/16h plan) + `.specify/memory/constitution.md` (5 nguyên tắc).
>
> Mục tiêu pre-hackathon: mỗi feature có đủ `spec.md` + `plan.md` + `tasks.md` (clarify/analyze optional). Ngày build chỉ chạy `/speckit.implement` theo tasks.

## Trạng thái tổng quan

| # | Branch | Feature | MVP/Stretch | Time-box | Specify | Clarify | Plan | Tasks | Analyze | Implement | Boundary |
|---|---|---|---|---|---|---|---|---|---|---|---|
| — | — | Probe (prerequisite) | MVP gate | 0-3h | n/a | n/a | n/a | n/a | n/a | chạy tay | n/a |
| 001 | `001-build-compiler-core` | Compiler core (pure fn) | **MVP** | 3-6h | DONE | ? | DONE | DONE | ? | pending | APPROVED |
| 002 | `002-mock-catalog` | MockCatalog + search | **MVP** | 6-8h | pending | — | — | — | — | pending | APPROVED |
| 003 | `003-tool-plugin-wiring` | Wire Compiler+Catalog vào OpenClaw | **MVP** | 8-10h | pending | — | — | — | — | pending | APPROVED |
| 004 | `004-dom-exec` | DOM exec + mock fallback | **MVP** | 10-12h | pending | — | — | — | — | pending | APPROVED |
| 005 | `005-flow-rehearse` | Flow S1+S3 end-to-end WebChat | **MVP** | 12-14h | pending | — | — | — | — | pending | APPROVED |
| 006 | `006-demo-video` | Video backup demo journey | **MVP** safety | 14-16h | pending | — | — | — | — | pending | APPROVED |
| 007 | `007-compare-components` | compare_components + recommend | Stretch | nếu rảnh | pending | — | — | — | — | pending | APPROVED |
| 008 | `008-guide-checkout` | guide_checkout (no payment) | Stretch | nếu rảnh | pending | — | — | — | — | pending | APPROVED |

**Chú thích**: DONE = artifact có trên branch; ? = chưa rõ (check `spec.md` có `## Clarifications` section không); pending = chưa làm; — = không áp dụng.

## Dependency graph

```
001 Compiler core (pure fn)  ─┐
002 Mock Catalog (pure fn)   ─┤
                              ├─→ 003 Tool plugin wiring ─┐
004 DOM exec (browser auto)  ─┼───────────────────────────┤
                              │                           ├─→ 005 Flow rehearse S1+S3 ─→ 006 Demo video
007 Compare (stretch)        ─┘ (cần 002+003)             │
008 Guide checkout (stretch) ── (cần 003)                 │
                                                          │
Probe (0-3h, không speckit) ──────────────────────────────┘
```

| Feature | Phụ thuộc | Song song được? |
|---|---|---|
| 001 Compiler | không | song song 002, 004, probe |
| 002 Catalog | không | song song 001, 004, probe |
| 003 Wiring | 001 + 002 | phải đợi 001+002 |
| 004 DOM exec | không (browser auto) | song song 001, 002, probe |
| 005 Flow | 001 + 002 + 003 + 004 | cuối MVP |
| 006 Video | 005 | sau 005 |
| 007 Compare | 002 + 003 | stretch |
| 008 Checkout | 003 | stretch |

## 16h build plan (ADR-0003 §3)

```
HOUR 0-3:   PROBE (validation gate) — openclaw gateway + mimo pro + WebChat hello + browser automation đọc 1 element
HOUR 3-6:   001 Compiler core (5 rule + error codes + repair-plan + ~15 unit test)
HOUR 6-8:   002 MockCatalog (~50 linh kiện, search_components)
HOUR 8-10:  003 Wire plugin (api.registerTool: compile_build/detect_errors/repair_build/search_components)
HOUR 10-12: 004 DOM exec (add_to_build + read_current_build, fallback mock page)
HOUR 12-14: 005 Flow rehearse S1→S3 trong WebChat
HOUR 14-16: 006 Video backup full journey
DAY 2:      demo (dùng video nếu mạng yếu)
```

## Code structure đề xuất (giảm git conflict)

```
build-mate-pv/
├── packages/
│   ├── compiler/              # 001 — pure fn, package.json riêng, npm test độc lập
│   │   ├── src/rules/         # socket.ts, ram-gen.ts, psu-wattage.ts, cooler-clearance.ts, form-factor.ts
│   │   ├── src/repair.ts
│   │   ├── test/*.test.ts     # ~15 test
│   │   └── package.json
│   └── catalog/               # 002 — mock data + search
│       ├── src/data.ts        # ~50 linh kiện
│       ├── src/search.ts
│       └── package.json
├── openclaw-plugin/           # 003 — wiring (import compiler + catalog)
│   ├── tools/                 # compile_build.ts, detect_errors.ts, repair_build.ts, search_components.ts
│   └── plugin.json
├── tools/
│   ├── dom-exec.ts            # 004 — browser automation
│   ├── compare.ts             # 007 stretch
│   └── checkout.ts            # 008 stretch
├── demo/
│   └── flow-s1-s3.ts          # 005 — rehearse script
├── video/                     # 006 — demo backup
└── specs/                     # blueprint (all branches merge here)
    ├── README.md              # file này
    ├── 001-build-compiler-core/
    ├── 002-mock-catalog/
    └── ...
```

Mỗi feature thêm module riêng → git conflict tối thiểu. 003 là chỗ duy nhất import chéo (compiler + catalog) → merge sau 001+002.

## Merge strategy (hackathon ngày build)

Branch speckit chỉ là workspace cô lập để sinh artifact. Workflow:

```text
# Pre-hackathon (làm bây giờ):
branch NNN-short-name:
  /speckit.specify → /speckit.clarify (optional) → /speckit.plan → /speckit.tasks → /speckit.analyze (optional)
git checkout main
git merge NNN-short-name --no-ff     # merge specs/NNN-* vào main
git branch -d NNN-short-name         # xóa branch đã merge
# repeat cho 002-008

# Hackathon ngày build:
git checkout -b hackathon-build      # integration branch
/speckit.implement                   # per feature, theo dependency order
git merge feature/001-impl --no-ff   # merge code implement theo dependency
```

Merge order implement (theo dependency):

1. 001 + 002 + 004 (song song)
2. 003 (sau 001+002)
3. 005 (sau 003+004)
4. 006 (sau 005)
5. 007 / 008 (stretch, nếu rảnh)

## Phân công team gợi ý (2-3 người)

| Người | Phase 1 (0-6h) | Phase 2 (6-10h) | Phase 3 (10-14h) | Phase 4 (14-16h) |
|---|---|---|---|---|
| A | Probe (0-3h) → assist 001 | 003 wiring | 005 rehearse | 006 video |
| B | 001 Compiler core (3-6h) | 003 wiring (cùng A) | 005 rehearse + 006 video | backup |
| C | 002 Catalog (3-6h) | 004 DOM exec (6-10h) | 005 rehearse | backup |

## Triage (ADR-0003 §2.4)

1. Trễ nhẹ → cắt S2 (007), giữ S1+S3+S4.
2. Trễ nặng → chỉ S1+S3. **S3 (repair) KHÔNG cắt** — differentiator.
3. Browser automation fail → mock trang build PC + nói rõ "production nối PhongVuApi".

## Boundary verdict (chạy boundary-architect skill)

Tất cả 8 feature **APPROVED** — không feature nào vi phạm 5 nguyên tắc:
- Không rebuild SessionStore / Backend Gateway.
- LLM không đoán compatibility (Compiler = pure fn, nguyên tắc #2).
- WebChat native, không xây channel plumbing (nguyên tắc #4).
- Không payment thật (008 guide-only).
- Không external orchestrator (LangChain/LangGraph).

## OUT of scope (ADR-0003 §2.3)

Chrome Extension overlay, payment thật, cào 100% catalog, P2/P3/P4. Không speckit feature nào chạm vào các mục này.

## Cập nhật file này

Mỗi lần hoàn thành 1 phase (specify/plan/tasks/implement) của 1 feature, update dòng tương ứng trong bảng "Trạng thái tổng quan" (DONE/pending/?). File này là single source of truth cho progress tracking.
