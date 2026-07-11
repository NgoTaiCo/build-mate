# Feature Specification: Chrome Extension DOM Demo

**Feature Branch**: `008-chrome-extension-ui`  
**Created**: 2026-07-11  
**Status**: Draft  
**Input**: User description: "Tích hợp Chrome Extension vào `https://phongvu.vn/buildpc` để demo bấm nút tìm/chọn sản phẩm trong UI Build PC; extension tự theo dõi và hiển thị build; xác định bridge để OpenClaw cập nhật UI bằng user interaction simulation."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Xem BuildMate đúng trên trang Build PC (Priority: P1)

Người demo mở đúng trang Build PC chính thức và thấy chatbot/panel BuildMate tự xuất hiện mà không xuất hiện ở bất cứ trang Phong Vu nào khác.

**Why this priority**: Giới hạn chính xác trang là điều kiện an toàn và giúp demo không gây nhiễu trải nghiệm mua sắm khác.

**Independent Test**: Cài extension unpacked, mở `https://phongvu.vn/buildpc` để xác nhận panel xuất hiện; mở product page, homepage, URL `www` hoặc URL path khác để xác nhận panel không được mount.

**Acceptance Scenarios**:

1. **Given** URL chính xác là `https://phongvu.vn/buildpc`, **When** trang tải xong, **Then** launcher BuildMate xuất hiện và có thể mở chatbot panel.
2. **Given** tab đang ở bất kỳ URL nào khác, **When** trang tải xong, **Then** extension không chèn launcher, panel hoặc thay đổi UI trang.

---

### User Story 2 - Thêm sản phẩm demo bằng thao tác do người dùng khởi tạo (Priority: P1)

Người demo bấm một nút rõ ràng trong BuildMate để extension tìm category card đồ họa, mở chooser của Phong Vu, chờ danh sách tải, rồi chọn sản phẩm hợp lệ đầu tiên để thể hiện luồng add-to-build.

**Why this priority**: Đây là “wow moment” chứng minh chatbot có thể biến gợi ý thành thao tác trong Build PC mà không đi tới checkout.

**Independent Test**: Trên một Build PC trống, bấm `Thêm VGA demo`; xác nhận modal/category tương ứng mở, một sản phẩm được chọn và trạng thái BuildMate báo thành công hoặc lỗi có thể hiểu được.

**Acceptance Scenarios**:

1. **Given** user bấm nút `Thêm VGA demo`, **When** category và danh sách product có thể thao tác, **Then** extension chọn một product trong category VGA và hiển thị kết quả trong panel.
2. **Given** category, modal hoặc product không tìm thấy trong thời hạn hợp lý, **When** flow dừng, **Then** panel báo rõ bước thất bại và không click bất kỳ control không liên quan nào.
3. **Given** user chưa bấm nút xác nhận demo, **When** panel hiển thị gợi ý, **Then** extension không tự thêm sản phẩm.

---

### User Story 3 - Theo dõi build hiện tại để làm chatbot context (Priority: P1)

Khi user thay đổi Build PC hoặc khi demo action hoàn tất, chatbot tự cập nhật một tóm tắt read-only về linh kiện đang thấy trên trang.

**Why this priority**: Chatbot chỉ hữu ích khi phản ánh build hiện tại; phần này cũng là input an toàn cho agent ở phase sau.

**Independent Test**: Thay đổi build trong UI Phong Vu hoặc chạy demo add, sau đó xác nhận panel cập nhật summary mà không bấm checkout hay ghi dữ liệu ngoài trang.

**Acceptance Scenarios**:

1. **Given** danh sách build trên trang thay đổi, **When** thay đổi ổn định, **Then** panel cập nhật số linh kiện và thông tin đọc được từ UI.
2. **Given** cấu trúc trang không còn đọc được, **When** tracker không thể tạo snapshot, **Then** panel thông báo cần refresh/kiểm tra selector, không suy đoán dữ liệu.

---

### User Story 4 - Nhận lệnh giao diện từ OpenClaw một cách kiểm soát (Priority: P2)

Khi OpenClaw đã được cấu hình ở phase integration, agent có thể gửi gợi ý hoặc yêu cầu action sang extension; mọi thao tác làm thay đổi Build PC vẫn cần confirmation ngay trên panel.

**Why this priority**: Tách agent reasoning khỏi browser action, đồng thời giữ quyền quyết định ở user và không tạo session store mới trong extension.

**Independent Test**: Đưa một command demo vào adapter extension và xác nhận panel hiển thị gợi ý; command yêu cầu add chỉ hiện nút confirm, không tự click trang.

**Acceptance Scenarios**:

1. **Given** extension nhận một command gợi ý hợp lệ, **When** command được xử lý, **Then** chatbot cập nhật UI bằng nội dung và trạng thái rõ ràng.
2. **Given** command yêu cầu add component, **When** user chưa confirm trên panel, **Then** extension không mô phỏng bất kỳ click nào trên trang.
3. **Given** command không nằm trong allowlist hoặc hết hạn, **When** extension nhận command, **Then** extension từ chối và hiển thị lỗi an toàn.

### Edge Cases

- Người dùng refresh hoặc chuyển route trong khi demo action đang chờ modal/product.
- Phong Vu đổi selector semantic hoặc modal tải chậm/rỗng.
- User bấm action nhiều lần liên tiếp.
- Product/category đã được chọn hoặc không còn available.
- Gateway OpenClaw chưa chạy, không có model/provider, hoặc bridge chưa được pair.
- Extension nhận command từ source không được xác thực.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Extension MUST mount UI chỉ khi hostname là `phongvu.vn` và pathname là chính xác `/buildpc`.
- **FR-002**: Extension MUST hiển thị chatbot/panel và trạng thái action rõ ràng trên trang được hỗ trợ.
- **FR-003**: Extension MUST chỉ khởi động add demo sau explicit click/confirmation của user trong panel.
- **FR-004**: Add demo MUST tìm category, modal và product bằng semantic text, role, aria hoặc data attributes; không phụ thuộc emotion class, dynamic ID hoặc positional selector.
- **FR-005**: Add demo MUST chờ product list thực sự sẵn sàng, xác nhận kết quả bằng snapshot mới hoặc báo lỗi theo bước.
- **FR-006**: Extension MUST theo dõi read-only trạng thái build sau các thay đổi và hiển thị snapshot hoặc trạng thái không đọc được.
- **FR-007**: Extension MUST NOT click checkout, payment, navigation hoặc multi-tab controls.
- **FR-008**: Extension MUST giới hạn command từ bridge vào allowlist gồm cập nhật status/gợi ý và yêu cầu add có confirmation; command không hợp lệ phải bị từ chối.
- **FR-009**: OpenClaw MUST tiếp tục là nguồn sự thật session/memory; extension không persist chat/session hoặc tự quyết compatibility.
- **FR-010**: Khi bridge OpenClaw chưa available, demo local MUST vẫn hoạt động và UI phải biểu thị đúng trạng thái disconnected.

### Key Entities

- **Build Snapshot**: Tóm tắt read-only từ UI Build PC, gồm component/category đọc được và thời điểm cập nhật.
- **Demo Action**: Lệnh user khởi tạo để chọn product demo trong một category, có trạng thái pending/success/failure.
- **Extension Command**: Command ngắn từ bridge để cập nhật UI hoặc yêu cầu user confirm một action.
- **Command Allowlist**: Tập command được extension chấp nhận trong phase này.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Extension chỉ render trên URL chính xác `https://phongvu.vn/buildpc` trong 100% các URL smoke test được định nghĩa.
- **SC-002**: User có thể hoàn thành demo add hoặc nhận một failure message cụ thể trong dưới 10 giây sau click.
- **SC-003**: 100% demo action được bắt đầu bằng explicit user confirmation và không bao giờ kích hoạt checkout/payment/navigation/multi-tab.
- **SC-004**: Build snapshot trong panel phản ánh thay đổi nhìn thấy được trên trang trong vòng 2 giây hoặc báo trạng thái không đọc được.
- **SC-005**: Command bridge không nằm trong allowlist không gây thay đổi UI Build PC.

## Assumptions

- Extension được dùng cho Chrome desktop demo nội bộ, ở trang non-www canonical do user chỉ định.
- Product demo là product hợp lệ đầu tiên hiển thị trong chooser VGA; đây không phải recommendation, stock hay compatibility claim.
- Bridge OpenClaw được thiết kế như một extension channel/remote-tool bridge paired sau phase DOM demo; Gateway và OpenClaw native session/memory không bị thay thế.
- Không triển khai bypass anti-bot/captcha, checkout/payment, persistent extension chat history hoặc auto-add không có confirmation.
