# Research: Build Compiler Deterministic Core

**Branch**: `001-build-compiler-core` | **Date**: 2026-07-07
**Phase**: 0 — resolve technical unknowns before design
**Clarification session 2026-07-07 propagated**: §9-§12 (storage required, monitor rule rejected, TDP-PSU exclusion, PSU rating rejected).

## Research Tasks

| # | Unknown / Choice | Resolved in § |
|---|---|---|
| R1 | Language: TypeScript vs JavaScript cho pure trust layer | §1 |
| R2 | Test runner: framework ngoài vs Node built-in | §2 |
| R3 | Repair plan format: SKU-based vs constraint-based | §3 |
| R4 | Linh kiện thiếu thuộc tính bắt buộc: crash vs error vs skip | §4 |
| R5 | Multi-instance linh kiện (2× RAM, multi-GPU): array vs single | §5 |
| R6 | PSU headroom value: hardcoded vs configurable | §6 |
| R7 | Error severity model: error/warning enum + caller branching | §7 |
| R8 | Package layout: monorepo workspace vs flat src/ | §8 |
| R9 | Storage có phải linh kiện bắt buộc cho `E003`? (clarification Q1) | §9 |
| R10 | Có nên thêm rule monitor↔GPU (màn 4K vs GPU driving)? (clarification Q2) | §10 |
| R11 | TDP tổng tính linh kiện nào + PSU có bị loại trừ? (clarification Q3+Q5) | §11 |
| R12 | PSU efficiency rating (80 Plus) có branch trong W001? (clarification Q4) | §12 |

---

## §1. Language: TypeScript vs JavaScript

**Decision**: TypeScript 5.x (strict mode).

**Rationale**: Compiler = "IP cốt lõi" (Constitution Principle II) + deterministic trust layer. Type system enforce ở compile-time rằng:
- `Component` discriminated union theo `type` → không truyền CPU socket vào rule RAM.
- `CompilerError.code` là union literal `E001`/`E002`/.../`E006`/`W001` → caller branch deterministic, không typo string.
- Pure-function signature `(build: Build) => CompilerError[]` → không side-effect type-level.
JavaScript thuần = đúng nhưng mất compile-time guarantee cho trust layer; refactor rủi ro hơn.

**Alternatives considered**:
- JavaScript thuần + JSDoc: ít deps hơn nhưng weaker enforcement; lỗi typo code string khó bắt.
- Rust/WASM: overkill cho 5 rule trivial computation; tăng build toolchain complexity vi phạm time-box.

---

## §2. Test runner: external framework vs Node built-in

**Decision**: `node:test` (Node built-in) + `node:assert/strict`. Zero external test dependency.

**Rationale**: FR-011 yêu cầu "verify độc lập, không cần chat/agent platform". Node 22.17 LTS có `node:test` stable + `--test` flag. Zero external dep = test chạy trên mọi máy có Node, không `npm install` framework. Constitution Quality Gate = `npm test` → script `"test": "node --test"` (qua `tsx` loader cho TS). Tối giản, fit time-box.

**Alternatives considered**:
- Vitest: feature-rich nhưng thêm dependency + config; overkill cho 15 unit test pure.
- Jest: heavy (jest-runtime + jsdom mặc định), không cần cho pure function.
- node:assert + custom runner: reinvent `node:test` đã có sẵn.

---

## §3. Repair plan format: SKU-based vs constraint-based

**Decision**: **Constraint-based**. Mỗi `RepairPlan` chỉ ra `component` (ref), `attribute` cần đổi, `target_value` (constraint, không phải SKU).

**Rationale**: Compiler KHÔNG có catalog nội bộ (separation of concern — Catalog là tool riêng, ADR-0001 §3). SKU resolution = việc của Catalog tool (`search_components`) sau khi repair plan cho biết constraint. Vd: repair `E001` = "đổi `cpu.socket` thành `AM5` HOẶC đổi `mainboard.socket` thành `LGA1700`" — 2 alternative fix, mỗi fix là 1 constraint. Catalog tool mới tìm SKU thỏa constraint.

**Format chi tiết** (xem `contracts/compiler-api.md` + `data-model.md`):
- `error_code`: mã lỗi cần sửa.
- `fixes`: mảng các alternative fix (OR) — áp dụng 1 là đủ.
- Mỗi fix: `{ component_ref, attribute, target_value, rationale }`.
- Multi-attribute fix (vd. đổi CPU thì phải khớp cả socket lẫn RAM gen mới) = 1 fix chứa ≥1 `change`.

**Alternatives considered**:
- SKU-based (trả SKU thay thế cụ thể): vi phạm separation — Compiler phải embed catalog; không deterministic nếu catalog đổi; phạm vi vượt feature.
- Free-text "hướng dẫn": LLM đoán = vi phạm Principle II.

---

## §4. Linh kiện thiếu thuộc tính bắt buộc

**Decision**: Báo lỗi thuộc tính thiếu (không crash, không giả định giá trị, không skip silent).

**Rationale**: Spec edge case: "Linh kiện thiếu thuộc tính bắt buộc → coi như không hợp lệ cho rule đó, báo lỗi thuộc tính thiếu (không crash, không giả định giá trị)". Rule cần thuộc tính (vd. `cpu.socket`) mà thiếu → không chạy logic so sánh, trả lỗi mới `E006 MISSING_ATTRIBUTE` (error) chỉ ra component + attribute thiếu. Lý do thêm `E006`: 6 code trong spec cover compatibility/missing-component, chưa cover malformed-data; trust layer phải detect malformed input deterministic.

**Code assignment** (continuing `E00x` pattern):
- `E006 MISSING_ATTRIBUTE` — component có nhưng thiếu thuộc tính bắt buộc cho rule.

**Alternatives considered**:
- Skip rule silent: ẩn lỗi, việt "trả TẤT CẢ lỗi" (edge case spec).
- Giả định default (vd. socket = "unknown"): vi phạm deterministic + hallucinate.
- Crash/throw: không graceful, caller không recover deterministic.

---

## §5. Multi-instance linh kiện (2× RAM stick, multi-GPU)

**Decision**: `components` là **array**; rule RAM/PSU/TDP xử lý multi-instance. RAM rule kiểm tra **mọi** RAM stick khớp CPU IMC (1 stick sai gen → `E002`). TDP tổng = **sum tất cả** linh kiện có `tdp` (CPU + mỗi GPU + mỗi RAM stick nếu có tdp).

**Rationale**: Build PC thực có 2-4 RAM stick, multi-GPU. Spec Key Entities nói `components` là "tập linh kiện" → array tự nhiên. `E003 MISSING_COMPONENT` check = "có ≥1 component type X" (không phải "đúng 1"). PSU rule TDP tổng cần sum multi-instance.

**Alternatives considered**:
- Single-instance object (`{ cpu, mainboard, ram, ... }`): không model được 2 RAM stick; ép hack array vào 1 slot.
- Array nhưng chỉ check first: bỏ sót stick sai gen — việt "trả TẤT CẢ lỗi".

---

## §6. PSU headroom value

**Decision**: Headroom = **20%** TDP tổng, hardcoded constant trong `codes.ts`/config常量. Boundary (`psu.wattage === tdp_total * 1.2`) = pass.

**Rationale**: Spec Assumption đã ghi 20% (industry-standard recommendation). Hardcode constant (không param runtime) giữ deterministic + đơn giản cho MVP. Nếu sau cần configurable (P2 bundle scoring, ADR-0002), expose param sau — không break pure signature (thêm optional param default 0.2).

**Alternatives considered**:
- Configurable param mỗi call: tăng complexity không cần cho MVP; caller truyền sai = non-deterministic feel.
- 30% headroom: too conservative cho mid-range build, nhiều false `W001`.

---

## §7. Error severity model

**Decision**: `severity: "error" | "warning"` enum trên `CompilerError`. `E00x` = error (chặn build), `W00x` = warning (không chặn). Caller (agent/tool plugin) branch deterministic: `errors.some(e => e.severity === "error")` → build invalid; warning → present nhưng vẫn valid.

**Rationale**: FR-007 yêu cầu "phân biệt error (chặn) vs warning (không chặn) để caller branch deterministic". Enum union literal (TS) enforce compile-time. Spec Assumption: `W001` warning, `E001`-`E005` error, `E006` error (malformed data chặn).

**Code catalog** (final, sau clarifications):
| Code | Name | Severity | Rule |
|---|---|---|---|
| E001 | SOCKET_MISMATCH | error | socket CPU↔mainboard |
| E002 | RAM_GEN_MISMATCH | error | RAM gen vs CPU IMC |
| E003 | MISSING_COMPONENT | error | thiếu loại bắt buộc (7 loại incl. storage) |
| E004 | COOLER_CLEARANCE_MISMATCH | error | cooler height > case max |
| E005 | FORM_FACTOR_MISMATCH | error | mainboard/PSU form-factor vs case |
| E006 | MISSING_ATTRIBUTE | error | component thiếu thuộc tính rule cần |
| W001 | PSU_TIGHT | warning | PSU wattage < (TDP tổng excl. PSU) × 1.2 |

**Alternatives considered**:
- Prefix-only (`E` vs `W`): parser string, weaker type; caller dễ branch sai.
- Separate `errors[]` + `warnings[]` array: tách nhưng caller vẫn cần check cả 2; union enum gọn hơn.

---

## §8. Package layout: monorepo workspace vs flat src/

**Decision**: `packages/compiler/` self-contained package, repo root sẽ setup npm workspaces ở feature wire-up sau (feature này chỉ tạo package folder + local `package.json`).

**Rationale**: ADR-0001 §4.4 "Tách Compiler thành package riêng, test độc lập (không phụ thuộc OpenClaw runtime)". Folder `packages/` = signal rõ ranh giới vật lý (boundary-architect: Tool plugin layer). Feature này tập trung Compiler pure; wire-up thành OpenClaw tool plugin (`api.registerTool`) = feature sau (HOUR 8-10 ADR-0003). Repo root `package.json` với workspaces config sẽ tạo ở feature wire-up, không phải feature này — tránh premature root config.

**Alternatives considered**:
- Flat `src/compiler/` trong root: không enforce boundary vật lý; dễ import lẫn với OpenClaw runtime code sau.
- Root package.json ngay bây giờ: premature; chưa biết wire-up shape; feature này scope = Compiler core only.

---

## §9. Storage có phải linh kiện bắt buộc cho `E003`? (clarification Q1)

**Decision**: **Có** — thêm storage vào danh sách bắt buộc. 7 loại: CPU, mainboard, RAM, PSU, cooler, case, **storage**. Không yêu cầu capacity tối thiểu — chỉ cần có ≥1 storage (bất kỳ SSD/HDD/NVMe).

**Rationale**: User chỉ ra: không storage → không cài OS → máy không hoạt động được. Build "không boot được" = không khả thi như build thiếu PSU/cooler. Boot-completeness = same severity class với 5 compatibility rule (physical impossibility). Chi phí implement thấp: thêm 1 type vào tập `E003` check, không thêm rule phức tạp, fit time-box. Storage KHÔNG thuộc 5 compatibility rule (no attribute so sánh) — chỉ thuộc `E003` required-set.

**Alternatives considered**:
- Giữ 6 loại, storage optional (Option B): sai về technical correctness — build thiếu storage không khả thi, trust layer phải chặn.
- Storage bắt buộc + yêu cầu capacity tối thiểu (Option C): over-engineer; capacity requirement phụ thuộc use-case (gaming cần 1TB+, office 256GB đủ) — không deterministic nếu không có user-intent context.

---

## §10. Có nên thêm rule monitor↔GPU? (clarification Q2)

**Decision**: **Không** — giữ 5 rule hiện tại. Monitor capability 4K/ultrawide vs GPU driving power = **LLM suggestion layer**, không deterministic trust layer.

**Rationale**: Spec gốc giới hạn 5 rule **physical compatibility** (socket/RAM/missing/cooler/form-factor). Monitor↔GPU = **performance adequacy**, cần benchmark data (fps@resolution cho mỗi GPU model) — không deterministic nếu chỉ dựa vào TDP/c Spec. Thêm rule = scope creep vi phạm ADR-0003 time-box + vi phạm Principle II (LLM đoán performance). Trust layer = deterministic only; performance suggestion = LLM advisory (caller branch trên `W001` hoặc free-form recommend). FR-013 updated explicit: monitor↔GPU performance matching = out of scope.

**Alternatives considered**:
- Thêm rule thứ 6 (Option A): 5 rule → 6 rule, vi phạm "5 rule" trong spec gốc; cần benchmark data table; vượt time-box.
- `W002 MONITOR_HEADROOM` heuristic (Option C): vẫn cần heuristic threshold (GPU TDP ≥ X cho 4K) — heuristic arbitrary, không "physical truth" như socket mismatch; better làm LLM suggestion.

---

## §11. TDP tổng scope + PSU exclusion (clarification Q3 + Q5)

**Decision**: TDP tổng = **sum mọi component có thuộc tính `tdp` > 0, bất kể type, NGOẠI TRỪ PSU**. Linh kiện không khai `tdp` (vd. mainboard, case, fans không có trường) → bỏ qua, không giả định default 0, không default theo type.

**Rationale (Q3 — TDP scope)**: User chính xác "mọi linh kiện đều tốn điện". Sum-all-tdp vật lý đúng nhất + tránh PSU tight ảo (nếu chỉ tính CPU+GPU thì TDP tổng thấp → W001 sai chiều, build overstress PSU vẫn pass). Linh kiện điển hình có `tdp`: CPU, GPU, RAM stick, storage (SSD/HDD), fans. Thiếu `tdp` → skip (không fake data) giữ deterministic.

**Rationale (Q5 — PSU exclusion)**: PSU **cấp điện** (source), không **tải DC** (load) từ hệ thống.功耗 PSU chính = AC inefficiency (loss do rating, đã loại khỏi W001 scope theo §12). Cộng `tdp` PSU vào sum sẽ inflate TDP giả tạo → W001 sai (PSU 650W Gold tự "tiêu thụ" 650W rồi self-flag tight). Loại trừ `type === "psu"` khỏi tập sum = vật lý đúng + testable + deterministic.

**Implementation**: trong `rules/psu.ts`, filter `components.filter(c => c.type !== "psu" && typeof c.tdp === "number" && c.tdp > 0)` rồi `reduce((sum, c) => sum + c.tdp, 0)`. Test case: build có PSU khai `tdp: 50` (malformed catalog) → PSU tdp KHÔNG vào sum, verify.

**Alternatives considered**:
- Chỉ tính CPU+GPU+RAM (Option B): bỏ sót storage/fans TDP → TDP tổng thấp giả tạo → W001 sai chiều.
- Default TDP cho linh kiện thiếu (Option C): heuristic (fan=5W, SSD=8W) — không deterministic nếu default thay đổi; fake data việt pure-function principle.
- Vẫn tính PSU nếu khai `tdp` (Option B cho Q5): xử lý "nhất quán" theo Q3 nhưng sai vật lý — PSU không tải DC hệ thống.

---

## §12. PSU efficiency rating (80 Plus) có branch trong W001? (clarification Q4)

**Decision**: **Không** — efficiency rating (White/Bronze/Gold/Platinum) KHÔNG ảnh hưởng W001. W001 so sánh **DC wattage capacity** (PSU rated wattage) vs **TDP tổng DC load** × 1.2. Rating = **AC→DC transfer efficiency** (semantics), không đổi DC capacity.

**Rationale**: User nhầm lẫn common — 80 Plus rating không phải "chất lượng cấp điện DC" mà là "hiệu suất chuyển đổi AC→DC". PSU 650W Gold cung cấp 650W DC y như PSU 650W White; khác = Gold kéo ~780W từ ổ cắm (85% efficiency), White kéo ~870W (75% efficiency). TDP hệ thống = DC load, PSU rated wattage = DC capacity → so sánh trực tiếp, rating không can thiệp. Thêm rating vào W001 = scope creep + cần data table rating→efficiency% (semantics, không physical truth). FR-013 updated explicit: PSU efficiency rating check = out of scope. Rating do LLM advisory (recommend "Gold cho tiết kiệm điện") — không vào trust layer.

**Implementation note**: PSU schema **KHÔNG** có trường `efficiency_rating` trong core (xem `data-model.md` §2.4) — ngăn data sai từ catalog trigger non-deterministic branch. Nếu catalog có rating, caller (LLM layer) consume, không pass vào Compiler.

**Alternatives considered**:
- Thêm rule: White/Bronze cần +10% headroom (Option A): 5 rule → 6 rule, vi phạm spec; rating threshold arbitrary; data table cần maintain.
- Thêm trường `efficiency_rating` pass-through (Option C): data có sẵn nhưng không branch — vẫn import semantics vào pure layer, rủi ro ro future scope creep; besser không có trường trong schema core.

---

## Phase 0 Summary

Tất cả 12 unknown đã resolve (8 technical + 4 clarification). Không còn NEEDS CLARIFICATION. Decisions feed vào:
- `data-model.md`: Build/Component/CompilerError/RepairPlan types + **Storage entity** (§9), **PSU no-tdp field** (§11, §12), TDP scope (§11), ErrorCode catalog (§7).
- `contracts/compiler-api.md`: 3 public function + examples với storage + non-goals mở rộng (§10, §12).
- `quickstart.md`: `npm test` standalone + smoke test với storage component (§9).
- tasks.md (Phase 2 sau): implement theo §1-§12.
