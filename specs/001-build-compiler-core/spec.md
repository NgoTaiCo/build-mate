# Feature Specification: Build Compiler Deterministic Core

**Feature Branch**: `001-build-compiler-core`  
**Created**: 2026-07-07  
**Status**: Draft  
**Input**: User description: "Build Compiler deterministic core: 5 compatibility rules (socket CPU↔mainboard, RAM generation vs CPU IMC, PSU wattage vs TDP sum+headroom, cooler clearance vs case height, form-factor mainboard vs case+PSU), error codes E001 SOCKET_MISMATCH / E002 RAM_GEN_MISMATCH / W001 PSU_TIGHT / E003 MISSING_COMPONENT, repair-plan generator returning concrete fixes per error, ~15 unit tests (5 rules x ~3 cases each), pure functions with zero OpenClaw runtime dependency so testable standalone. Input = build object with components; output = errors[] + repair_plan[]. Out-of-scope: RGB sync, aesthetic matching, price optimization."

## Clarifications

### Session 2026-07-07

- Q: Storage có phải linh kiện bắt buộc cho `E003` (build không boot được OS nếu thiếu)? → A: Có — thêm storage vào danh sách bắt buộc (7 loại: CPU, mainboard, RAM, PSU, cooler, case, storage), không yêu cầu capacity tối thiểu (Option A).
- Q: Có nên thêm rule monitor↔GPU (màn 4K mà máy không kéo được)? → A: Không — giữ 5 rule hiện tại; monitor capability/performance = LLM suggestion (không deterministic), out of trust layer scope (Option B).
- Q: TDP tổng tính linh kiện nào để so PSU wattage? → A: Sum tất cả component có thuộc tính `tdp` (>0); linh kiện không khai TDP thì bỏ qua (không giả định default 0, không giả định default theo type) (Option A).
- Q: PSU efficiency rating (80 Plus White/Gold/Platinum) có được check trong W001 không? → A: Không — efficiency rating = AC→DC transfer efficiency (semantics), KHÔNG ảnh hưởng DC wattage capacity mà W001 so; rating = LLM advisory, out of deterministic core scope (Option B).
- Q: Trường `tdp` của PSU có bị loại trừ khỏi tổng TDP không (PSU tự cấp điện, không tải DC hệ thống)? → A: Có — loại trừ PSU khỏi tập sum TDP (PSU cấp điện chứ không tải DC hệ thống; PSU功耗 = AC inefficiency đã loại khỏi W001 scope theo Q4) (Option A).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Phát hiện build không tương thích (Priority: P1)

Khách chọn một build PC gồm các linh kiện. Hệ thống kiểm tra tính tương thích vật lý theo 5 quy tắc deterministic và trả về danh sách lỗi kèm mã ổn định (`E001 SOCKET_MISMATCH`, `E002 RAM_GEN_MISMATCH`, `E003 MISSING_COMPONENT`, và mã cho cooler/form-factor). Khi build sai socket hoặc sai RAM generation, hệ thống từ chối build và báo mã lỗi chính xác — không bao giờ "đoán" bằng LLM.

**Why this priority**: Đây là IP cốt lõi của BuildMate — trust layer xác định được. Khách không bao giờ nhận được build không thể lắp ráp. Khác biệt so với chatbot thường = deterministic, không hallucinate (ADR-0001 §3, Constitution Principle II).

**Independent Test**: Cho build chứa CPU socket LGA1700 + mainboard socket AM5 → hệ thống trả `E001 SOCKET_MISMATCH`. Cho build đúng → trả 0 lỗi. Test chạy độc lập, không cần agent/chat runtime.

**Acceptance Scenarios**:

1. **Given** build có CPU socket LGA1700 và mainboard socket AM5, **When** hệ thống kiểm tra, **Then** trả về `E001 SOCKET_MISMATCH`.
2. **Given** build có CPU hỗ trợ DDR4 và RAM DDR5, **When** hệ thống kiểm tra, **Then** trả về `E002 RAM_GEN_MISMATCH`.
3. **Given** build thiếu PSU, **When** hệ thống kiểm tra, **Then** trả về `E003 MISSING_COMPONENT` cho PSU.
4. **Given** build thỏa mãn mọi quy tắc, **When** hệ thống kiểm tra, **Then** trả về `errors[]` rỗng.

---

### User Story 2 - Sinh kế hoạch sửa build cụ thể (Priority: P2)

Khi build có lỗi, hệ thống sinh `repair_plan` chứa fix cụ thể cho từng lỗi — chỉ ra thuộc tính nào cần đổi thành giá trị nào để lỗi biến mất. Khách không phải đoán "thay gì", mà nhận hành động cụ thể (ví dụ: "đổi CPU sang socket AM5" hoặc "tăng PSU lên ≥750W").

**Why this priority**: S3 (repair) là differentiator của demo (ADR-0003 §2.4: "S3 KHÔNG cắt"). Repair plan biến lỗi từ "báo sao" thành "hướng dẫn sửa" — giữ intent mua, giảm drop-off.

**Independent Test**: Cho build lỗi `E001` (CPU LGA1700 + mainboard AM5) → `repair_plan` chứa ≥1 fix cho `E001` chỉ ra đổi CPU socket thành AM5 HOẶC đổi mainboard socket thành LGA1700. Áp dụng fix → re-validate → `E001` biến mất.

**Acceptance Scenarios**:

1. **Given** build có `E001 SOCKET_MISMATCH`, **When** hệ thống sinh `repair_plan`, **Then** `repair_plan` chứa ≥1 fix cho `E001` và fix chỉ rõ giá trị socket cần đạt.
2. **Given** build có 2 lỗi (`E001` + `E002`), **When** hệ thống sinh `repair_plan`, **Then** `repair_plan` có fix cho từng lỗi (không bỏ sót).
3. **Given** `repair_plan` được áp dụng đầy đủ vào build, **When** re-validate, **Then** tất cả lỗi đã sửa biến mất.

---

### User Story 3 - Cảnh báo margin PSU & build thiếu linh kiện (Priority: P3)

Hệ thống phân biệt **error** (build không lắp được) vs **warning** (build lắp được nhưng rủi ro). PSU wattage dưới TDP tổng + headroom → `W001 PSU_TIGHT` (warning, không chặn build). Build thiếu linh kiện bắt buộc → `E003 MISSING_COMPONENT` (error, chặn). Khách nhận thông tin để quyết định, không bị chặn sai chỗ.

**Why this priority**: `W001` thể hiện "timely assistance" — cảnh báo PSU chật là giá trị thực (build boot được nhưng OC/load nặng risk). `E003` đảm bảo build tối thiểu khả thi. Priority thấp hơn P1/P2 vì demo story chính = `E001`/`E002` + repair.

**Independent Test**: Cho build PSU 550W, TDP tổng 500W, headroom 20% (cần 600W) → `W001 PSU_TIGHT`. Cho build PSU 750W, TDP 500W → không có `W001`. Cho build thiếu cooler → `E003`.

**Acceptance Scenarios**:

1. **Given** build PSU 550W, TDP tổng 500W, headroom yêu cầu 20% (cần 600W), **When** kiểm tra, **Then** trả về `W001 PSU_TIGHT` (warning, không chặn).
2. **Given** build PSU 750W, TDP tổng 500W, **When** kiểm tra, **Then** không có `W001`.
3. **Given** build thiếu cooler, **When** kiểm tra, **Then** trả về `E003 MISSING_COMPONENT` (error, chặn).

---

### Edge Cases

- Build rỗng (không linh kiện) → `E003` cho tất cả loại linh kiện bắt buộc.
- Build thiếu 1 loại (vd. không có PSU) → `E003` cho PSU; các rule cần PSU (PSU wattage) không chạy, không sinh lỗi ảo.
- Linh kiện thiếu thuộc tính bắt buộc (vd. CPU không có trường socket) → coi như không hợp lệ cho rule đó, báo lỗi thuộc tính thiếu (không crash, không giả định giá trị).
- Build có nhiều lỗi cùng lúc (socket + RAM + thiếu cooler) → trả về TẤT CẢ lỗi, không dừng ở lỗi đầu.
- PSU wattage đúng bằng TDP + headroom (boundary) → pass (không warn); dưới bất kỳ khoảng nào → `W001`.
- Cooler height đúng bằng case max clearance (boundary) → pass; quá bất kỳ khoảng nào → lỗi clearance.
- Linh kiện không thuộc 5 rule (vd. storage, GPU discrete) → bỏ qua cho compatibility, nhưng TDP vẫn tính vào tổng cho PSU rule.
- Build pass hết → `errors[]` rỗng, `repair_plan[]` rỗng.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Hệ thống MUST kiểm tra socket CPU khớp socket mainboard và trả `E001 SOCKET_MISMATCH` khi khác.
- **FR-002**: Hệ thống MUST kiểm tra RAM generation khớp CPU supported memory generation (IMC) và trả `E002 RAM_GEN_MISMATCH` khi không khớp.
- **FR-003**: Hệ thống MUST tính tổng TDP = sum tất cả linh kiện có thuộc tính `tdp` (>0) **ngoại trừ PSU** (PSU cấp điện, không tải DC hệ thống), so với PSU wattage, và trả `W001 PSU_TIGHT` (warning) khi PSU wattage < TDP tổng + headroom. Linh kiện không khai `tdp` (vd. mainboard, case, fans không có trường tdp) → bỏ qua, không giả định default.
- **FR-004**: Hệ thống MUST kiểm tra cooler height ≤ case max cooler clearance và trả lỗi clearance khi cooler vượt clearance.
- **FR-005**: Hệ thống MUST kiểm tra mainboard form-factor được case hỗ trợ VÀ tương thích PSU form-factor, trả lỗi form-factor khi mismatch.
- **FR-006**: Hệ thống MUST phát hiện thiếu loại linh kiện bắt buộc và trả `E003 MISSING_COMPONENT` cho từng loại thiếu.
- **FR-007**: Hệ thống MUST trả `errors[]` có mã ổn định, phân biệt error (`E00x`, chặn) vs warning (`W00x`, không chặn) để caller branch deterministic.
- **FR-008**: Hệ thống MUST sinh `repair_plan[]` chứa fix cụ thể cho mỗi lỗi — fix chỉ ra thuộc tính cần đổi và giá trị cần đạt để lỗi biến mất.
- **FR-009**: Hệ thống MUST chạy deterministic: cùng input luôn ra cùng output, không phụ thuộc thời gian/trạng thái/agent runtime.
- **FR-010**: Hệ thống MUST nhận input là build object chứa `components` và trả output có cấu trúc `errors[]` + `repair_plan[]`.
- **FR-011**: Hệ thống MUST có thể được verify độc lập (test suite chạy mà không cần chat/agent platform) — trust layer tách rời AI.
- **FR-012**: Hệ thống MUST có ≥3 test case cho mỗi rule trong 5 rule (≥15 test tổng), cover pass/fail/boundary.
- **FR-013**: Hệ thống MUST NOT thực hiện RGB sync, aesthetic matching, price optimization, monitor↔GPU performance matching, hay PSU efficiency rating check (out of scope — monitor capability 4K/ultrawide vs GPU driving power và PSU 80 Plus rating là LLM suggestion layer, không deterministic trust layer; W001 so sánh DC wattage vs TDP×1.2, không branch trên efficiency rating).

### Key Entities _(include if feature involves data)_

- **Build**: input object chứa tập linh kiện (`components`). Mỗi component có `type` + các thuộc tính theo type.
- **Component**: linh kiện thuộc 1 type (CPU/mainboard/RAM/PSU/cooler/case/storage). Thuộc tính phụ thuộc type: CPU(`socket`, `ram_gen_supported`, `tdp`), Mainboard(`socket`, `ram_gen_supported`, `form_factor`), RAM(`generation`), PSU(`wattage`, `form_factor`), Cooler(`height`), Case(`max_cooler_height`, `supported_mb_form_factors`, `supported_psu_form_factors`), Storage(chỉ `type`+`id` — không có thuộc tính compatibility; optional `tdp` nếu có thì tính vào tổng).
- **Error**: một vấn đề phát hiện, có: `code` ổn định (`E001`/`E002`/`E003`/`E004`/`E005`/`W001`), `severity` (error/warning), tham chiếu đến linh kiện gây lỗi, `message` người-đọc-được.
- **RepairPlan**: một fix cụ thể cho 1 error: chỉ ra `component` cần đổi, `attribute` cần đổi, `target_value` cần đạt (constraint, không phải SKU cụ thể — SKU do Catalog tool resolve sau).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Không khách nào nhận build chứa incompatibility vật lý (100% incompatibility bị chặn trước khi build được trình bày là hợp lệ) — verify bằng test suite.
- **SC-002**: Mỗi khách nộp build lỗi nhận ≥1 hành động sửa cụ thể mà khi áp dụng sẽ giải quyết lỗi đó — verify bằng test (apply repair → re-validate → lỗi biến mất).
- **SC-003**: Compatibility core verify được 100% mà không cần chat/agent platform chạy — verify bằng việc chạy test suite standalone.
- **SC-004**: ≥15 test case cover tất cả 5 rule trên input hợp lệ/lỗi/boundary (≥3 case/rule).
- **SC-005**: Mỗi error type có mã ổn định, documented, để assistant giải thích chính xác vấn đề và route đúng repair.
- **SC-006**: Build đúng-yêu-cầu được accept với 0 error và 0 repair step.

## Assumptions

- **Linh kiện bắt buộc cho `E003`**: CPU, mainboard, RAM, PSU, cooler, case, storage (7 loại). Trong đó 6 loại (CPU/mainboard/RAM/PSU/cooler/case) được 5 compatibility rule tham chiếu; storage bắt buộc vì lý do boot-completeness (không storage → không cài OS → máy không hoạt động). Build thiếu bất kỳ loại nào → `E003` cho loại đó. Storage không yêu cầu capacity tối thiểu — chỉ cần có ≥1 storage (bất kỳ SSD/HDD/NVMe).
- **Mã lỗi cho 2 rule không được nêu trong input**: cooler clearance → `E004 COOLER_CLEARANCE_MISMATCH` (error, build không lắp vừa); form-factor → `E005 FORM_FACTOR_MISMATCH` (error, mainboard/PSU không vừa case). Theo pattern `E00x` đã có (`E001`/`E002`/`E003`).
- **PSU headroom**: 20% TDP tổng (industry-standard recommendation). PSU wattage < TDP × 1.2 → `W001`. Boundary: wattage = TDP × 1.2 → pass. **Efficiency rating (80 Plus White/Bronze/Gold/Platinum) KHÔNG ảnh hưởng W001** — rating = AC→DC transfer efficiency (semantics), không đổi DC wattage capacity mà W001 so; rating do LLM advisory, không thuộc deterministic core.
- **Repair plan format**: constraint-based (chỉ ra thuộc tính + giá trị cần đạt), không phải SKU cụ thể — vì Compiler không có catalog nội bộ; Catalog tool resolve SKU sau.
- **Boundary = pass**: cooler height = case max → pass; PSU = TDP + headroom → pass. Vượt quá (bất kỳ khoảng nào) → lỗi/warn.
- **Linh kiện thiếu thuộc tính bắt buộc**: coi như không hợp lệ cho rule đó, báo lỗi thuộc tính thiếu (không crash, không giả định giá trị).
- **GPU**: không thuộc 5 rule compatibility và không bắt buộc (E003 không check GPU), nhưng nếu khai `tdp` thì tính vào tổng TDP cho PSU rule. **Storage**: bắt buộc cho `E003` (boot-completeness) nhưng không thuộc 5 compatibility rule; nếu khai `tdp` (thường nhỏ ~5-10W) thì tính vào tổng TDP cho PSU rule. **TDP tổng scope**: sum tất cả component có `tdp` > 0 bất kể type (CPU/GPU/RAM stick/storage/fans nếu khai) **ngoại trừ PSU** (PSU cấp điện, không tải DC hệ thống;功耗 PSU = AC inefficiency đã loại khỏi W001 scope) — linh kiện không khai `tdp` (vd. mainboard, case) bỏ qua, không giả định default 0 cũng không default theo type.
- **`W001` là warning (không chặn build)**: build vẫn "valid" nhưng kèm cảnh báo. `E001`/`E002`/`E003`/`E004`/`E005` là error (chặn).
