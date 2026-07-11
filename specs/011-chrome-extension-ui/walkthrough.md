# Walkthrough: Rich Chat Widgets & UX/i18n Polish

Tôi đã bổ sung các **Khối giao diện tương tác (Rich Widgets)** và tinh chỉnh thiết kế UX dựa trên **Taste Skills**, đồng thời đảm bảo Extension tuân thủ 100% chuẩn đa ngôn ngữ (i18n).

Dưới đây là các nâng cấp nổi bật đã được thực hiện:

## 1. Kịch bản "Đề xuất Sản phẩm Đơn lẻ"
Nếu bạn chat các từ khóa như: `chuột`, `màn hình`, `bàn phím`...
👉 Bot sẽ phản hồi bằng một Widget **Thẻ sản phẩm (Product Card)** chứa:
- Tên sản phẩm đầy đủ và giá bán được làm nổi bật (màu xanh Phong Vũ).
- Nút bấm `[Thêm vào cấu hình]` bo tròn góc 8px (khi nhấn vào sẽ chuyển trạng thái xanh lá báo hiệu "Đã thêm thành công").
- Format giá sẽ tự động được bản địa hoá tuỳ theo ngôn ngữ (VD: `450.000 đ` cho Tiếng Việt và `450,000 VND` cho Tiếng Anh).

## 2. Kịch bản "Đề xuất Toàn bộ Máy"
Nếu bạn chat các từ khóa như: `full máy`, `cả bộ`, `cấu hình`...
👉 Bot sẽ phản hồi bằng một Widget **Cấu hình Đề xuất (Build Card)** chứa:
- Tổng tiền ước tính được thiết kế to, rõ ràng ở góc trên, tách biệt với các dòng text khác.
- Một danh sách lưới (list) chi tiết các linh kiện (CPU, Main, RAM, VGA) phân chia bằng các đường gạch ngang mờ đứt nét tinh tế. Chữ tiêu đề (Label) và tên sản phẩm được căn chỉnh chân chữ (baseline) hoàn hảo.
- Nút bấm `[Áp dụng cấu hình này]` để giả lập việc chốt một dàn máy hoàn chỉnh.
- Toàn bộ các chuỗi văn bản (từ Tiêu đề thẻ cho tới Nhãn nút bấm) đã được loại bỏ hardcode và liên kết hoàn toàn tới bộ từ điển `i18n.js`.

## 3. Tinh chỉnh Layout theo Taste Skills (Anti-Slop UI)
Toàn bộ các Widget mới đều được thiết kế tuân thủ nghiêm ngặt **Taste Skills**: 
- **Header thanh lịch:** Loại bỏ các Text Buttons chật chội và khung bọc thừa thãi. Hệ thống nút giờ đây quy về các Icon Button 32x32px tinh gọn (`[VI]`, `[Trash]`, `[X]`) và được căn lề phải cực kì ngăn nắp.
- **Minimalist Badge:** Xóa khung viền nền xanh của số lượng sản phẩm ở Header, dời con số (ví dụ: `2`) xuống thẳng thanh Tiêu đề của Giỏ hàng, chỉ giữ lại một con số màu xám nhạt hiện đại và không phô trương.
- **Whitespace / Khoảng trống:** Bổ sung `margin` hợp lý giữa các Bong bóng chat và thẻ Gợi ý mục tiêu (Goals) để giao diện không bị ngộp thở.
- **Clean Forms:** Đổ bóng nhẹ `box-shadow` để khối nổi lên thanh thoát so với nền xám của khung chat.

---

> [!TIP]
> **Cách Test Demo mới:**
> 1. Tải lại (Reload) Extension trong `chrome://extensions/`.
> 2. Mở khung chat và gõ thử **"gợi ý chuột"** hoặc **"full build"** (bằng Tiếng Anh nếu đang chọn ngôn ngữ EN) để tự mình trải nghiệm các widget tương tác này nhé!
> 3. Bấm vào nút `[VI] / [EN]` trên Header để kiểm chứng UI hoàn toàn không bị vỡ và mọi thứ đều thay đổi chính xác sang ngôn ngữ tương ứng.
