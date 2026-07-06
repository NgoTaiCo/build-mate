# Expansion — Mở rộng ra sao

## Nguyên tắc nền: platform pattern
4 lớp dùng chung (ADR-0001), **instantiate theo problem/retailer/category** — không build silo.

```
[ Channel ]   +   [ Tool plugin ]   =   1 problem mới
 (OpenClaw)        (ta xây)
```

## 1. Thêm problem mới (P2/P3/P4)
| Cần thêm | Reuse |
|---|---|
| Channel mới (vd Zalo cho P3) | OpenClaw native đã có Zalo; agent + session + memory dùng chung |
| Tool plugin mới (vd `score_bundles`, `generate_sql`) | Tool plugin SDK, Compiler/trust pattern |
| Trust layer mới (vd Query Governor cho P4) | Cùng pattern "LLM plans, deterministic validates" |

→ 3/4 lớp reuse, chỉ channel + tool thay. Tiết kiệm ~60–70% effort (chi tiết ADR-0002 §2.3).

## 2. Thêm retailer mới (GearVN, An Phát…)
- OpenClaw gateway + agent + Compiler **giữ nguyên**.
- Chỉ thêm **selector manifest mới** cho site đó (mỗi site DOM khác).
- Extension content script đọc manifest → cùng `syntheticClick`/`findVgaRow` pattern (`docs/extension-phongvu-integration.md`).
- Tức: 1 site mới = 1 file manifest JSON + adapter tool, không sửa core.

## 3. Thêm category linh kiện mới (cooler, case, monitor, peripheral…)
- Thêm **Compiler rule** (pure function + unit test) — ví dụ `check_cooler_thermal(cpu_tdp, cooler_rating)`.
- Thêm data vào catalog (MockCatalog → PhongVuApi field).
- Không động kiến trúc.

## 4. Thêm channel mới (Facebook, WhatsApp…)
- OpenClaw plugin official có sẵn → `openclaw plugins install @openclaw/<id>`.
- Bind agent → channel. Không code.

## Khi nào abstract (rule of three)
- ≥3 problem cùng dùng 1 lớp → abstract lớp đó (đã làm: OpenClaw gateway, Compiler pattern).
- ≥3 site cùng pattern → abstract adapter (selector manifest + discovery tool).
- Đừng abstract sớm — KISS cho hackathon.

## Bát kỳ mở rộng nào cũng phải
1. Không phá nguyên tắc vàng (AGENTS.md): OpenClaw owns session, Compiler deterministic, model là provider config.
2. Có ADR ghi quyết định mở rộng.
3. Có test cho mảnh mới (Compiler rule = unit test; adapter = discovery + smoke test).
