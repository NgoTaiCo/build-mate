# Research Notes: `guide_checkout` (008-guide-checkout)

**Date**: 2026-07-08  
**Purpose**: Resolve design unknowns trước khi viết data-model và contracts.

---

## R1 — Vị trí của logic deterministic summary

**Decision**: Đặt logic deterministic trong module `packages/openclaw-tools/src/checkout/` (không tạo package riêng).

**Rationale**:
- `guide_checkout` là một tool đơn giản trong OpenClaw tool plugin layer.
- Việc tách module đủ để giữ ranh giới pure-function vs wrapper tool plugin, đồng thời tránh overhead của một package npm mới.
- Pattern này nhất quán với cách `compare_components` (007) tách comparator logic, nhưng ở đây logic đơn giản hơn nhiều nên không cần package riêng.

**Alternatives considered**:
- Tạo `packages/checkout-guide/` riêng → rejected vì overkill cho stretch goal, tăng thởi gian setup workspaces và publish link.
- Nhúng summary logic trực tiếp vào `src/tools/guide-checkout.ts` → rejected vì khó unit test độc lập và làm mờ ranh giới pure function vs tool wrapper.

---

## R2 — LLM prose: trong tool hay ở agent layer?

**Decision**: Tool `guide_checkout` trả về JSON có cấu trúc (`OrderSummary` + `CheckoutGuide`). Phần diễn đạt ngôn ngữ tự nhiên do OpenClaw agent/model layer thực hiện thông qua provider config.

**Rationale**:
- Constitution Principle II yêu cầu tool plugin deterministic. Nếu tool tự gọi LLM, output sẽ non-deterministic và khó unit test.
- Constitution Principle III: model là provider config, không phải layer orchestrator trong tool.
- Agent layer đã có khả năng render tool result thành prose (OpenClaw embedded agent runtime).

**Alternatives considered**:
- Tool gọi LLM trực tiếp để trả về prose → rejected vì vi phạm Principle II/III và làm tool phụ thuộc model provider.
- Tool trả về cả structured data lẫn prose template → rejected vì prose template vẫn non-deterministic; để agent layer render là sạch nhất.

---

## R3 — Checkout URL và navigation guide

**Decision**: Sử dụng URL cố định `https://phongvu.vn/buildpc` (configurable qua plugin config) và cung cấp fallback steps khi URL không xác định. Không thực hiện DOM automation trên trang checkout.

**Rationale**:
- `docs/extension-phongvu-integration.md` xác nhận trang build PC của Phong Vu là `https://phongvu.vn/buildpc`.
- Flow checkout thật (login, giỏ hàng, địa chỉ, thanh toán) nằm ngoài scope và có thể thay đổi; hướng dẫn bằng text là an toàn.
- Feature chỉ "guide", không "exec" checkout. DOM exec trên checkout sẽ vượt scope (payment/order submission out-of-scope).

**Alternatives considered**:
- Deep-link đến trang checkout với build pre-filled → rejected vì URL pattern không ổn định và có thể cần session/login.
- Tự động click nút "Đặt hàng" qua browser automation → rejected vì vi phạm out-of-scope (order submission, payment).

---

## R4 — Cách xử lý promotion / discount

**Decision**: Nếu catalog cung cấp `promotion.discountAmount` (hoặc `discountPercent` có thể chuyển đổi), áp dụng vào giá linh kiện để tính tổng. Nếu chỉ có nhãn khuyến mãi (`promotion.label`), hiển thị nhãn và dùng giá gốc, kèm ghi chú "giảm giá chưa được phản ánh".

**Rationale**:
- Mock catalog có thể chỉ có promo label (ví dụ "Giảm 10%") mà không có giá trị cụ thể.
- Tool vẫn hoạt động gracefully khi dữ liệu khuyến mãi không đầy đủ.
- Tránh đoán giá trị giảm giá từ text (ví dụ parse "10%"), vì điều đó dễ sai và không deterministic.

**Alternatives considered**:
- Yêu cầu catalog luôn cung cấp `discountAmount` → rejected vì mock catalog có thể chưa có field này.
- Parse khuyến mãi từ string (ví dụ "Giảm 500K") → rejected vì brittle và non-deterministic.

---

## R5 — Stock status values và cảnh báo

**Decision**: Chấp nhận hai giá trị chính `in_stock` và `out_of_stock`. Mọi giá trị khác hoặc thiếu đều được đánh dấu là `unknown` và kèm warning.

**Rationale**:
- Catalog hiện tại dùng enum rõ ràng; hai giá trị này đủ cho MVP/stretch.
- Giá trị `unknown` giúp tool không crash khi catalog thay đổi schema.

**Alternatives considered**:
- Hỗ trợ thêm `low_stock`, `pre_order` → rejected vì tăng scope không cần thiết; có thể mở rộng sau.

---

## R6 — Tool registration pattern

**Decision**: Đăng ký `guide_checkout` trong `packages/openclaw-tools/src/index.ts` cùng cách thức với 4 tool hiện có (`compile_build`, `detect_errors`, `repair_build`, `search_components`). Cập nhật `openclaw.plugin.json` để thêm tool vào `contracts.tools`.

**Rationale**:
- `docs/openclaw-reference.md` §4 mô tả pattern `definePluginEntry` + `api.registerTool`.
- Thống nhất với 003 giúp giảm cognitive load và dễ runtime verify (`openclaw plugins inspect buildmate-tools --runtime --json`).

**Alternatives considered**:
- Tạo plugin riêng cho `guide_checkout` → rejected vì tăng số lượng plugin cần cài đặt và quản lý.

---

## R7 — Input/output schema

**Decision**: Input = `{ build: Build }` (tái sử dụng type `Build` từ `@buildmate/compiler`). Output = `{ orderSummary: OrderSummary, checkoutGuide: CheckoutGuide }` dưới dạng JSON text trong OpenClaw tool result.

**Rationale**:
- Tái sử dụng `Build` type giảm duplication và đảm bảo tính nhất quán với compiler/repair tools.
- Output có cấu trúc rõ ràng giúp agent layer dễ render prose và dễ test.

**Alternatives considered**:
- Input chỉ là array SKU → rejected vì mất thông tin component type, quantity, và không nhất quán với các tool khác.
- Output là markdown string → rejected vì agent khó trích xuất dữ liệu để xử lý tiếp (ví dụ: cảnh báo hết hàng).
