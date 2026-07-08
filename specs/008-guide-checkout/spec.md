# Feature Specification: Hướng dẫn thanh toán — `guide_checkout`

**Feature Branch**: `008-guide-checkout`  
**Created**: 2026-07-08  
**Status**: Draft  
**Input**: User description: "guide_checkout(build) tool: given a compiled+repaired build, produce order summary (component list, total price, stock status, promo applied) and navigation guide to checkout page. Conversational output (may call LLM for prose). NO real payment, NO order submission, NO credit card handling. Stretch goal. Out-of-scope: payment integration, order placement, address autofill."

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Tổng hợp đơn hàng và hướng dẫn đến trang thanh toán (Priority: P1)

Khách đã có một build PC được compile và repair thành công. Khách yêu cầu trợ lý BuildMate đưa ra thông tin để tiến hành thanh toán. Trợ lý gọi `guide_checkout`, nhận về bản tổng hợp đơn hàng (danh sách linh kiện, tổng giá, tình trạng tồn kho, khuyến mãi đã áp dụng) và hướng dẫn đi đến trang checkout, sau đó trình bày bằng ngôn ngữ tự nhiên.

**Why this priority**: Đây là khả năng cốt lõi của feature. Nếu không có bản tổng hợp và hướng dẫn, khách không thể chuyển từ giai đoạn build sang hành động mua hàng (scene S4 trong ADR-0003 §2.1).

**Independent Test**: Có thể test độc lập bằng cách truyền vào một build đã compile+repair và kiểm tra phản hồi có đầy đủ: danh sách linh kiện, tổng giá, trạng thái tồn kho từng món, khuyến mãi, và hướng dẫn đến trang checkout (URL hoặc các bước thao tác).

**Acceptance Scenarios**:

1. **Given** một build gồm 5 linh kiện với giá và khuyến mãi xác định, **When** `guide_checkout` được gọi, **Then** phản hồi liệt kê đầy đủ linh kiện, tổng giá đúng, trạng thái tồn kho, khuyến mãi áp dụng, và hướng dẫn đến trang thanh toán.
2. **Given** một build có ít nhất một linh kiện đang trong tình trạng `in_stock`, **When** `guide_checkout` được gọi, **Then** phản hồi cho phép khách biết build đã sẵn sàng để tiến hành checkout.
3. **Given** một build có linh kiện đang được khuyến mãi, **When** `guide_checkout` được gọi, **Then** khuyến mãi được hiển thị rõ ràng và tổng giá phản ánh mức giảm nếu giá trị giảm giá có sẵn.

---

### User Story 2 — Cảnh báo khi linh kiện hết hàng hoặc thiếu thông tin (Priority: P2)

Build của khách chứa linh kiện hết hàng hoặc thiếu thông tin giá/khuyến mãi. `guide_checkout` vẫn trả về bản tổng hợp, nhưng đánh dấu vấn đề và đề xuất hành động tiếp theo (ví dụ: tìm linh kiện thay thế hoặc xác nhận lại trước khi checkout).

**Why this priority**: Giúp khách tránh mất công đến trang checkout rồi mới phát hiện lỗi, giảm drop-off.

**Independent Test**: Có thể test độc lập bằng cách truyền build có một linh kiện `out_of_stock` và kiểm tra phản hồi gắn cờ vấn đề đó mà không crash.

**Acceptance Scenarios**:

1. **Given** một build có một linh kiện `out_of_stock`, **When** `guide_checkout` được gọi, **Then** phản hồi đánh dấu món đó là hết hàng và kèm theo cảnh báo.
2. **Given** một build có linh kiện thiếu thông tin khuyến mãi, **When** `guide_checkout` được gọi, **Then** phản hồi hiển thị giá hiện tại và ghi chú trạng thái khuyến mãi chưa xác nhận.
3. **Given** một build có tất cả linh kiện đều `out_of_stock`, **When** `guide_checkout` được gọi, **Then** phản hồi khuyến nghị khách không nên tiến hành checkout và nên tìm linh kiện thay thế.

---

### User Story 3 — Trình bày bằng ngôn ngữ tự nhiên (Priority: P3)

Trợ lý sử dụng dữ liệu tổng hợp có cấu trúc để tạo ra đoạn văn mạch lạc, thân thiện, giải thích đơn hàng và các bước tiếp theo.

**Why this priority**: Nâng cao trải nghiệm hội thoại, nhưng phụ thuộc vào dữ liệu từ Story 1.

**Independent Test**: Có thể test độc lập bằng cách kiểm tra tin nhắn cuối cùng của trợ lý là bản diễn giải tự nhiên của summary, không phải JSON thô.

**Acceptance Scenarios**:

1. **Given** một `OrderSummary` hợp lệ, **When** trợ lý định dạng phản hồi, **Then** khách nhận được tin nhắn dễ đọc với tên linh kiện, tổng giá, cảnh báo (nếu có), và các bước checkout.
2. **Given** một `OrderSummary` có cảnh báo, **When** trợ lý định dạng phản hồi, **Then** cảnh báo được giải thích bằng ngôn ngữ tự nhiên.

---

### Edge Cases

- Build rỗng hoặc thiếu linh kiện? → Trả về thông báo rõ ràng rằng không có gì để checkout.
- Linh kiện thiếu giá hoặc thiếu `stock_status`? → Hiển thị placeholder/warning và vẫn xuất bản summary.
- Tất cả linh kiện đều hết hàng? → Cảnh báo và khuyến nghị dừng checkout.
- URL trang checkout không xác định? → Cung cấp hướng dẫn dự phòng (ví dụ: mở `phongvu.vn/buildpc` và nhấn nút thanh toán).
- Khuyến mãi hoặc tồn kho thay đổi sau khi summary được tạo? → Ghi chú rõ giá và khuyến mãi là thông tin lúc summary được tạo.
- Khách yêu cầu thanh toán thật / đặt hàng / nhập thẻ? → Từ chối và nhắc lại rằng tính năng này chỉ hướng dẫn, không thực hiện thanh toán.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `guide_checkout` MUST chấp nhận một build đã được compile và repair thành công làm đầu vào.
- **FR-002**: Hệ thống MUST tạo ra `OrderSummary` bao gồm danh sách linh kiện, giá từng món, trạng thái tồn kho, và khuyến mãi đã áp dụng.
- **FR-003**: Hệ thống MUST tính tổng giá (`total_price`) dựa trên giá các linh kiện, áp dụng mức giảm giá nếu có thông tin giảm giá đầy đủ.
- **FR-004**: Hệ thống MUST cung cấp `CheckoutGuide` để đưa khách đến trang thanh toán, bao gồm URL checkout và/hoặc các bước thao tác cụ thể.
- **FR-005**: Hệ thống MUST trình bày summary và hướng dẫn bằng ngôn ngữ tự nhiên; phần lắp ráp dữ liệu cơ bản MUST là deterministic.
- **FR-006**: Hệ thống MUST KHÔNG thực hiện thanh toán thật, KHÔNG submit đơn hàng, KHÔNG thu thập thông tin thẻ tín dụng, và KHÔNG tự động điền địa chỉ.
- **FR-007**: Hệ thống MUST đánh dấu các linh kiện hết hàng hoặc thiếu thông tin giá/khuyến mãi và đưa cảnh báo vào summary.
- **FR-008**: Hệ thống MUST xử lý gracefully khi URL trang checkout không xác định bằng cách cung cấp hướng dẫn điều hướng chung.
- **FR-009**: Các khả năng ngoài phạm vi (tích hợp cổng thanh toán, đặt hàng, tự động điền địa chỉ) MUST NOT được yêu cầu để tool hoạt động.

### Assumptions

- Build đầu vào đã vượt qua compile và repair; `guide_checkout` không xử lý lỗi compatibility.
- Catalog cung cấp các trường `price`, `stock_status`, và `promotion` cho từng linh kiện.
- "Khuyến mãi đã áp dụng" nghĩa là ưu đãi/flash-sale đang hoạt động của SKU; nếu giá trị giảm giá có sẵn thì tổng giá phản ánh mức giảm, ngược lại khuyến mãi được liệt kê dưới dạng text.
- URL trang checkout là cố định theo kênh bán hàng (ví dụ: `phongvu.vn/buildpc`).
- Feature này là stretch goal; chỉ triển khai sau khi MVP (S1+S3) hoàn thành.
- LLM chỉ được dùng để diễn đạt ngôn ngữ tự nhiên, KHÔNG được dùng để tính giá, tồn kho, hay compatibility.

### Key Entities _(include if feature involves data)_

- **Build**: Cấu hình PC của khách, chứa danh sách linh kiện. Đã được định nghĩa trong feature `001-build-compiler-core`.
- **Component**: Linh kiện trong catalog với các thuộc tính `price`, `stock_status`, `promotion`. Đã được định nghĩa trong feature `002-mock-catalog-adapter`.
- **OrderSummary**: Output có cấu trúc của `guide_checkout`, bao gồm danh sách linh kiện, tổng giá, cảnh báo tồn kho/giá, khuyến mãi, và hướng dẫn checkout.
- **CheckoutGuide**: Thông tin điều hướng đến trang thanh toán (URL và/hoặc danh sách bước thao tác).

### Out of Scope (Explicit)

- Tích hợp cổng thanh toán thật (VNPay, MoMo, thẻ tín dụng, v.v.).
- Submit đơn hàng hoặc tạo đơn hàng trên hệ thống Phong Vu.
- Tự động điền địa chỉ giao hàng, thông tin liên hệ, hoặc thông tin thẻ.
- Thực hiện bất kỳ thao tác DOM nào trên trang checkout (ví dụ: tự động click "Đặt hàng").
- Xử lý lỗi compatibility của build — thuộc về `compile_build`, `detect_errors`, và `repair_build`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Khách nhận được bản tổng hợp đơn hàng trong vòng 5 giây kể từ khi yêu cầu hướng dẫn checkout.
- **SC-002**: Bản summary liệt kê chính xác 100% linh kiện trong build kèm giá, trạng thái tồn kho, và khuyến mãi.
- **SC-003**: Tổng giá tính toán khớp với tổng giá linh kiện sau khi áp dụng khuyến mãi đã biết trong 100% trường hợp test.
- **SC-004**: 100% phản hồi đều chứa hướng dẫn điều hướng đến trang checkout (URL hoặc các bước dự phòng).
- **SC-005**: Không có khách nào có thể hoàn tất thanh toán thật hoặc submit đơn hàng qua tool này; các yêu cầu như vậy đều bị từ chối.
- **SC-006**: Ít nhất 95% trường hợp linh kiện hết hàng hoặc thiếu thông tin nhận được cảnh báo rõ ràng thay vì fail silently.
- **SC-007**: Phần giải thích ngôn ngữ tự nhiên phản ánh chính xác dữ liệu `OrderSummary`, không bịa đặt giá, khuyến mãi, hay thông tin compatibility.

