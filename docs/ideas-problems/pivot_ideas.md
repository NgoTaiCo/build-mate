## Báo Cáo Định Hướng Kiến Trúc: BuildMate - Hybrid Agentic Pattern

**Mục tiêu:** Tái định hướng (pivot) kiến trúc dự án BuildMate trên DevPost theo mô hình **Hybrid Adapter Pattern**, đảm bảo tính thực chiến cho Hackathon (MVP hoàn thiện nhanh), đồng thời đạt chuẩn doanh nghiệp (dễ bảo trì, khả năng mở rộng sang mọi nền tảng bán lẻ).

---

### 1. Tóm Tắt Quyết Định Pivot (Why Pivot?)

Việc cố gắng hardcode script cào dữ liệu (DOM scraping) hoặc phụ thuộc hoàn toàn vào API chính thức đều mang lại rủi ro cao cho một cuộc thi ngắn ngày. Mô hình Hybrid giải quyết triệt để bài toán này bằng cách **tách rời bộ não suy luận (AI Agent) khỏi tay chân thực thi (Execution Layer)**.

| Tiêu chí | Hướng tiếp cận cũ (Hardcoded DOM / API phụ thuộc) | Hướng Pivot (Hybrid Adapter Pattern) |
| --- | --- | --- |
| **Độ rủi ro Hackathon** | **Cao:** Nếu BTC không cấp API hoặc đổi UI, hệ thống sụp đổ. | **Cực thấp:** Luôn có luồng fallback (dùng API nếu có, tụt xuống DOM RPA nếu không). |
| **Khả năng mở rộng (Scalability)** | Bị khóa cứng (Vendor lock-in) vào một nền tảng duy nhất. | Mở rộng sang GearVN, An Phát... chỉ bằng cách thêm 1 file Adapter mới. |
| **Khả năng bảo trì (Maintainability)** | Logic AI và logic thao tác UI bị trộn lẫn (Spaghetti code). | Chuẩn Clean Architecture: Core Agent độc lập hoàn toàn với lớp UI/DOM. |
| **Trải nghiệm (UX)** | Dễ bị ngắt kết nối do giới hạn Manifest V3 (timeout 30s). | Stream liên tục thời gian thực (SSE/WebSocket), keep-alive extension. |

---

### 2. Kiến Trúc Tầng (Clean Hybrid Architecture)

Hệ thống được chia thành 3 tầng phân định ranh giới rõ ràng, cho phép thay thế hoặc nâng cấp từng module mà không làm ảnh hưởng đến toàn bộ project:

```
[ Chrome Extension (MV3 - UI Overlay) ]
                ↕ (WebSocket / SSE - Streaming Thoughts)
[ Backend Gateway (VPS - Session & Keep-Alive) ]
                ↕ (Internal Routing)
[ OpenClaw Orchestrator (Core Agent Logic) ]
                ↕ (Standardized Tool Calls)
[ Execution Layer: IComponentAdapter (Interface) ]
         ↗                              ↖
[ GeneralDomAdapter (RPA/DOM) ]     [ PhongVuApiAdapter (Official API) ]

```

#### Tầng 1: Client Overlay (Chrome Extension - Manifest V3)

* **Nhiệm vụ:** Hiển thị UI đề xuất in-context, duy trì kết nối mạng để chống ngủ gật (Service Worker timeout).
* **Thiết kế:** Siêu nhẹ (Vanilla JS hoặc Vite/Preact). Chỉ làm 2 việc: Gửi Semantic JSON DOM lên Backend và nhận lệnh thực thi sự kiện (`synthetic click`/`input`) từ Backend trả về.

#### Tầng 2: Core Orchestrator (OpenClaw + Backend Gateway)

* **Nhiệm vụ:** Đóng vai trò là trung tâm điều phối. Nhận context từ user, suy luận, tự quyết định gọi tool nào.
* **Thiết kế:** Chuẩn hóa các Tool thành Interface trừu tượng. Ví dụ: `search_compatible_vga(budget)`, `add_item_to_cart(sku_id)`. OpenClaw **hoàn toàn "mù"** về việc tool đó sẽ được chạy dưới web như thế nào.

#### Tầng 3: Hybrid Execution Layer (Adapters)

* `IComponentAdapter`: Interface định nghĩa chuẩn đầu ra/đầu vào cho các hành động mua sắm.
* `GeneralDomAdapter` *(Ưu tiên MVP)*: Dùng kỹ thuật Bypass React Virtual DOM (bắn `SyntheticEvent` và `MouseEvent` native). Dùng được cho trang `phongvu.vn/buildpc` ngay cả khi không có API.
* `PhongVuApiAdapter` *(Plug-in sau)*: Sẵn sàng đấu nối nếu ban tổ chức cấp Sandbox API và Swagger vào ngày Workshop 8/7.

---

### 3. Phạm Vi MVP Demo (Tối Ưu Cho Hackathon)

Để chứng minh tính hiệu quả trước ban giám khảo mà không bị lầy lội trong các edge-case kỹ thuật, MVP demo cần tuân thủ nguyên tắc **"One Perfect Flow" (Một luồng hoàn hảo)**:

* **ĐƯỢC LÀM (In-Scope):**
1. Tập trung vào **1 luồng duy nhất**: Người dùng đang ở trang Build PC Phong Vũ -> Yêu cầu AI *"Tìm VGA tương thích với CPU hiện tại trong tầm giá 10 triệu và tự thêm vào cấu hình"*.
2. Extension đọc được cấu hình hiện tại (Semantic DOM).
3. OpenClaw suy luận, check nghẽn cổ chai (bottleneck), trả về stream giải thích (Thoughts) cho user xem.
4. Tự động trigger lệnh click trên DOM để chèn đúng VGA đó vào danh sách Build PC.


* **KHÔNG LÀM (Out-of-Scope cho MVP):**
* Không làm tính năng thanh toán (Checkout/Payment).
* Không cào toàn bộ 100% linh kiện trên web (chỉ cần mock database hoặc crawl sẵn một tập mẫu khoảng 50 linh kiện phổ biến nhất để AI tra cứu nhanh).
* Không build UI quá phức tạp cho Extension (chỉ cần 1 sidebar collapsible đơn giản, hiển thị chat và streaming tags).



---

### 4. Lộ Trình Thực Chiến (Action Plan đến 08/07)

```
Giai đoạn 1: Khóa Hạ Tầng & Core Logic (Từ nay -> Trước 08/07)
  ├── 1. Dựng VPS Gateway + setup OpenClaw chạy ổn định.
  ├── 2. Viết xong `GeneralDomAdapter` (Chọc thủng React DOM cho 1 nút "Thêm vào giỏ" trên trang Phong Vũ).
  └── 3. Thi công kết nối WebSocket/SSE từ Extension về BE để chống timeout MV3.

Giai đoạn 2: Tích Hợp & Chuyển Đổi (Trong Workshop 08/07 - 10/7)
  ├── 1. Nhận đề bài và Sandbox API từ BTC (nếu có).
  ├── 2. Nếu có API -> Code thêm `PhongVuApiAdapter` (mất ~2-3 tiếng vì đã có sẵn Interface).
  └── 3. Nếu không có API -> Khóa luồng fallback, tiếp tục dùng `GeneralDomAdapter` đã làm ở Giai đoạn 1.

Giai đoạn 3: Đánh Bóng Demo (Trước Giờ G)
  └── Quay video kịch bản luồng "One Perfect Flow" (luôn có video backup trường hợp mạng sự kiện yếu).

```

---

### 5. Cập Nhật Ngay Vào DevPost Project

Để căn chỉnh lại expectation và ghi điểm với ban giám khảo về tính kiến trúc trên trang DevPost hiện tại, hãy cập nhật phần **"How we built it"** và **"Architecture"** với các từ khóa trọng tâm sau:

* **Agentic Orchestrator Pattern:** *Designed around OpenClaw as an autonomous reasoning engine that orchestrates multi-step component compatibility verification before executing UI actions.*
* **Hybrid Execution (Zero Vendor Lock-in):** *Implemented an Adapter Pattern supporting both Direct Sandbox APIs (for enterprise partnerships) and Native DOM RPA (via React SyntheticEvent injection) as a universal fallback.*
* **Resilient Manifest V3 Architecture:** *Solved the MV3 service worker termination limitation by implementing persistent Server-Sent Events (SSE) streaming, providing real-time "Agent Thoughts" feedback while maintaining connection keep-alive.*