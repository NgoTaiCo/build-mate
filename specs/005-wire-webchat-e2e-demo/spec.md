# Feature Specification: Wire WebChat end-to-end demo

**Feature Branch**: `005-wire-webchat-e2e-demo`  
**Created**: 2026-07-07  
**Status**: Draft  
**Input**: User description: "Wire end-to-end demo flow in WebChat native: S1 (search_components → compile_build → stream result to user) then S3 (user submits intentionally broken build → detect_errors returns E001/E002 → repair_build generates fix plan → add_to_build auto-applies suggested component). Rehearse full journey ≥1 time. S3 repair is non-negotiable differentiator. Out-of-scope: S2 compare, S4 checkout, Extension channel."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Khách mô tả nhu cầu và nhận cấu hình đã biên dịch (Priority: P1)

Khách hàng mô tả nhu cầu sử dụng PC (mục đích, ngân sách, yêu cầu đặc biệt) trong WebChat. BuildMate tìm kiếm linh kiện phù hợp, biên dịch thành một cấu hình hợp lệ dựa trên quy tắc tương thích xác định, và trình bày kết quả cho khách hàng.

**Why this priority**: Đây là luồng cốt lõi S1 (find + compile) của MVP hackathon. Nếu chỉ có story này, demo vẫn mang lại giá trị cơ bản: khách hàng nhận được cấu hình PC khả thi.

**Independent Test**: Có thể kiểm thử độc lập bằng cách mở một phiên WebChat, mô tả nhu cầu, và xác nhận nhận được cấu hình đầy đủ với thông tin tương thích và giá tổng.

**Acceptance Scenarios**:

1. **Given** khách hàng đang ở trong kênh WebChat và chưa có cấu hình nào, **When** khách mô tả nhu cầu PC (ví dụ: "gaming 20 triệu"), **Then** BuildMate trả về danh sách linh kiện đề xuất và một cấu hình đã được biên dịch hợp lệ.
2. **Given** cấu hình đã được biên dịch, **When** kết quả được gửi đến khách hàng, **Then** khách hàng nhìn thấy danh sách linh kiện theo vai trò (CPU, mainboard, RAM, v.v.), trạng thái tương thích, và tổng giá ước tính.

---

### User Story 2 - Khách cố tình gửi cấu hình lỗi và BuildMate sửa chữa (Priority: P1)

Khách hàng (hoặc người demo) gửi một cấu hình có lỗi tương thích cố ý, ví dụ sai socket CPU hoặc nguồn không đủ công suất. BuildMate phát hiện lỗi (E001 / E002), giải thích nguyên nhân, đề xuất linh kiện thay thế, tự động áp dụng sửa chữa sau khi được đồng ý, và trình bày cấu hình đã sửa.

**Why this priority**: S3 repair là điểm khác biệt không thể đàm phán của BuildMate. Story này minh họa khả năng "debugger" cho PC build, nâng cao niềm tin của khách hàng vào kết quả.

**Independent Test**: Có thể kiểm thử độc lập bằng cách gửi một cấu hình lỗi đã chuẩn bị và xác nhận quy trình detect → repair → apply hoàn tất trong WebChat.

**Acceptance Scenarios**:

1. **Given** một cấu hình có lỗi tương thích (ví dụ: CPU và mainboard khác socket, hoặc PSU không đủ watt), **When** khách hàng gửi cấu hình đó, **Then** BuildMate trả về mã lỗi E001 (socket mismatch) hoặc E002 (power insufficient) kèm theo giải thích dễ hiểu.
2. **Given** lỗi đã được phát hiện, **When** BuildMate lập kế hoạch sửa chữa, **Then** hệ thống đề xuất một linh kiện thay thế khắc phục đúng lỗi đó.
3. **Given** đề xuất sửa chữa đã được hiển thị, **When** khách hàng đồng ý áp dụng, **Then** BuildMate cập nhật cấu hình và trình bày cấu hình đã sửa cùng với lý do thay đổi.

---

### User Story 3 - Đội demo diễn tập toàn bộ hành trình trước khi trình diễn (Priority: P2)

Trước khi demo chính thức, đội ngũ vận hành demo chạy ít nhất một lần toàn bộ hành trình S1 → S3 trong môi trường WebChat để đảm bảo mọi bước hoạt động mượt mà và không cần can thiệp thủ công.

**Why this priority**: Đảm bảo độ tin cậy cho hackathon demo, giảm thiểu rủi ro kỹ thuật khi trình diễn trước ban giám khảo.

**Independent Test**: Có thể kiểm thử độc lập bằng cách thực hiện một lần chạy rehearsal có ghi lại kết quả, với kịch bản S1 và S3 cụ thể.

**Acceptance Scenarios**:

1. **Given** môi trường demo WebChat đã được chuẩn bị, **When** đội demo chạy kịch bản S1 → S3 theo hướng dẫn, **Then** toàn bộ luồng hoàn thành mà không cần workaround thủ công.
2. **Given** kết quả rehearsal có lỗi, **When** đội demo ghi nhận vấn đề, **Then** họ sửa lỗi và chạy lại rehearsal cho đến khi đạt ít nhất một lần thành công.

---

### Edge Cases

- Khách hàng mô tả nhu cầu mơ hồ hoặc thiếu thông tin: BuildMate cần đặt câu hỏi làm rõ trước khi tìm kiếm linh kiện.
- Catalog không có linh kiện phù hợp với yêu cầu: BuildMate thông báo rõ và đề xuất điều chỉnh ngân sách hoặc yêu cầu.
- Cấu hình lỗi chứa nhiều lỗi cùng lúc: BuildMate phát hiện và xử lý từng lỗi (hoặc liệt kê tất cả) theo thứ tự có thể sửa được.
- Đề xuất sửa chữa bị khách hàng từ chối: BuildMate giữ cấu hình cũ và giải thích hậu quả, hoặc đề xuất phương án thay thế khác.
- Mô hình / gateway gặp độ trễ: người dùng nhận được thông báo tiến trình thay vì im lặng.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: WebChat channel PHẢI hỗ trợ cuộc trò chuyện đa lượt để khách hàng mô tả nhu cầu build PC.
- **FR-002**: BuildMate PHẢI tìm kiếm linh kiện trong catalog dựa trên nhu cầu của khách hàng (ngân sách, mục đích sử dụng, sở thích).
- **FR-003**: BuildMate PHẢI biên dịch cấu hình PC hợp lệ bằng quy tắc tương thích xác định (không để LLM đoán tương thích).
- **FR-004**: BuildMate PHẢI trình bày cấu hình đã biên dịch cho khách hàng, bao gồm danh sách linh kiện, trạng thái tương thích, và tổng giá ước tính.
- **FR-005**: Khách hàng PHẢI có khả năng gửi một cấu hình cố tình vi phạm tương thích (ví dụ: sai socket, nguồn không đủ công suất) để phục vụ demo S3.
- **FR-006**: BuildMate PHẢI phát hiện lỗi tương thích và trả về ít nhất hai mã lỗi E001 (socket mismatch) và E002 (power insufficient).
- **FR-007**: BuildMate PHẢI tạo kế hoạch sửa chữa giải thích lỗi và linh kiện thay thế cần thiết.
- **FR-008**: BuildMate PHẢI tự động áp dụng linh kiện đề xuất vào cấu hình sau khi khách hàng đồng ý, và trình bày cấu hình đã sửa.
- **FR-009**: Đội demo PHẢI có thể diễn tập toàn bộ hành trình S1 → S3 ít nhất một lần từ đầu đến cuối trước khi demo.
- **FR-010**: S2 compare, S4 checkout, và Extension channel PHẢI nằm ngoài phạm vi của feature này.

### Key Entities _(include if feature involves data)_

- **User Need**: mô tả nhu cầu của khách hàng về mục đích sử dụng, ngân sách, và yêu cầu ưu tiên.
- **Component Catalog**: danh mục linh kiện có sẵn với các thuộc tính kỹ thuật (socket, TDP, công suất, form factor, giá).
- **Build Configuration**: tập hợp linh kiện được chọn theo vai trò (CPU, mainboard, RAM, GPU, PSU, lưu trữ, case).
- **Compatibility Error**: lỗi tương thích được mã hóa (E001, E002), bao gồm linh kiện bị ảnh hưởng và giải thích.
- **Repair Plan**: kế hoạch sửa chữa gồm tham chiếu lỗi, linh kiện thay thế đề xuất, và lý do.
- **Fixed Build**: cấu hình sau khi đã áp dụng sửa chữa.

## Dependencies & Assumptions

- Catalog linh kiện và các quy tắc tương thích đã có sẵn từ các spec / package trước đó.
- Kênh WebChat native và OpenClaw gateway đã sẵn sàng để tích hợp.
- Người vận hành demo có thể chuẩn bị trước các cấu hình lỗi cố ý và kịch bản rehearsal.
- Tính năng "auto-apply" yêu cầu một bước xác nhận của khách hàng trong chat trước khi thay đổi cấu hình.
- Phạm vi lỗi trong feature này giới hạn ở E001 và E002; các lỗi khác có thể được xử lý nếu đã có nhưng không bắt buộc.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Khách hàng có thể hoàn thành S1 (từ nhu cầu đến cấu hình đã biên dịch) trong một phiên WebChat dưới 5 phút.
- **SC-002**: Ít nhất 95% các cấu hình lỗi cố ý được gửi đi trả về đúng mã lỗi E001 hoặc E002.
- **SC-003**: Ít nhất 95% các kế hoạch sửa chữa sau khi áp dụng tự động tạo ra cấu hình tương thích trong rehearsal.
- **SC-004**: Đội demo hoàn thành ít nhất một lần rehearsal toàn bộ S1 → S3 mà không cần can thiệp thủ công.
- **SC-005**: Người dùng có thể hiểu lý do cấu hình bị sửa mà không cần giải thích kỹ thuật sâu (đo lường định tính qua phản hồi của người demo).
