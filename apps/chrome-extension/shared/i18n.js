(function () {
  const translations = {
    vi: {
      // Panel header
      panelTitle: "Trợ lý build PC",
      clearChat: "Xoá chat",
      closePanel: "Đóng BuildMate",
      openAssistant: "Trợ lý AI",

      // Status bar
      statusOffline: "Demo local — Gateway chưa kết nối",
      statusOnline: "Đã kết nối DOM bridge demo",

      // Welcome
      welcome: "Chatbot đang theo dõi Build PC read-only. Chọn mục tiêu mẫu hoặc nhập yêu cầu của bạn dưới đây.",

      // Cart / tracker
      cartTitle: "Giỏ hàng hiện tại",
      cartEmpty: "Chưa có linh kiện nào được chọn",
      cartUnavailable: "Chưa đọc được giỏ hàng. Thử tải lại trang.",

      // Chat input
      chatPlaceholder: "Nhắn với BuildMate...",
      sendLabel: "Gửi",
      processing: "Đang xử lý...",

      // VGA demo action
      actionReady: "Sẵn sàng thêm VGA demo.",
      actionLocating: "Đang tìm category VGA…",
      actionSuccess: "Đã chọn VGA demo vào Build PC.",
      actionUnverified: "Đã click chọn nhưng chưa xác minh được build.",
      actionCancelled: "Đã huỷ demo action.",
      
      // Action status maps
      action_locating_category: "Đang tìm category VGA…",
      action_opening_modal: "Đang mở danh sách VGA…",
      action_waiting_products: "Đang chờ sản phẩm tải…",
      action_selecting_product: "Đang chọn VGA demo…",
      action_verifying: "Đang xác nhận thay đổi build…",
      action_reverting: "Đang hoàn tác linh kiện…",
      action_reverted: "Đã hoàn tác linh kiện.",
      action_success: "Đã chọn VGA demo vào Build PC.",
      action_unverified: "Đã click chọn nhưng chưa xác minh được build.",
      action_failed: "Lỗi thêm VGA.",
      action_cancelled: "Đã huỷ thao tác demo.",

      // Error codes
      error_CANCELLED: "Đã huỷ thao tác.",
      error_MODAL_TIMEOUT: "Danh sách VGA không mở kịp.",
      error_PRODUCT_TIMEOUT: "Danh sách chưa có sản phẩm có thể chọn.",
      error_PAGE_CHANGED: "Trang đã thay đổi, vui lòng thử lại.",
      error_VGA_ROW_NOT_FOUND: "Không tìm thấy category VGA trên trang.",
      error_CATEGORY_BUTTON_NOT_FOUND: "Không tìm thấy nút Chọn/Sửa VGA.",
      error_REVERT_CONFLICT: "Build đã thay đổi, không thể hoàn tác an toàn.",
      error_REMOVE_BUTTON_NOT_FOUND: "Không tìm thấy nút Xóa linh kiện.",
      error_COMPONENT_NOT_SELECTED: "Linh kiện không còn trong cấu hình.",
      error_REMOVE_VERIFY_TIMEOUT: "Không xác minh được thao tác hoàn tác.",

      confirmTitle: "Xác nhận thêm VGA demo?",
      confirmBody: "Extension mở category VGA và chọn product đầu tiên hiển thị. Không checkout.",
      confirmBtn: "Xác nhận",
      cancelBtn: "Huỷ",
      addVgaBtn: "Thêm VGA demo",
      revertBtn: "Hoàn tác",
      cancelRunningBtn: "Huỷ",

      // Product / build widgets
      addToConfig: "Thêm vào cấu hình",
      addedSuccess: "Đã thêm thành công ✓",
      applyBuild: "Áp dụng cấu hình này",
      appliedBuild: "Đã áp dụng cấu hình ✓",
      buildCardTitle: "Cấu hình đề xuất",
      totalCost: "Tổng chi phí",

      // Fallback replies
      fallbacks: [
        'Bạn có thể thử: gõ "VGA" để xem demo thêm card đồ họa, "chuột" để tìm phụ kiện, hoặc "full máy" để xem gợi ý cấu hình hoàn chỉnh.',
        'Tôi đang ở chế độ Demo. Thử gõ "cấu hình gaming" hoặc "gợi ý màn hình" để xem các tính năng tương tác nhé!',
        'Demo mode đang hoạt động. Bạn muốn tôi tư vấn VGA, phụ kiện, hay gợi ý cả bộ máy?',
        'Câu hỏi hay! Hiện tôi chưa kết nối Gateway. Hãy thử các từ khoá như "VGA", "chuột gaming", hoặc "build 15 triệu" để xem UI demo.'
      ],

      // Product recommendation triggers (check lowerCase input)
      triggers: {
        vga: ["vga"],
        peripheral: ["chuột", "màn hình", "bàn phím"],
        fullBuild: ["full", "máy", "cả bộ", "cấu hình"]
      },

      // Product recommendations
      peripheralReply: "Tôi tìm thấy sản phẩm này rất phù hợp với nhu cầu của bạn:",
      fullBuildReply: "Dựa trên yêu cầu của bạn, tôi đề xuất cấu hình tối ưu sau:",
      
      // Goals
      goals: {
        'gaming-25m': { title: 'Gaming 2K mượt mà', budget: 'Khoảng 25 triệu' },
        'creator-30m': { title: 'Sáng tạo nội dung', budget: 'Khoảng 30 triệu' },
        'study-15m': { title: 'Học tập và làm việc', budget: 'Khoảng 15 triệu' }
      }
    },

    en: {
      // Panel header
      panelTitle: "PC Build Assistant",
      clearChat: "Clear chat",
      closePanel: "Close BuildMate",
      openAssistant: "AI Assistant",

      // Status bar
      statusOffline: "Local demo — Gateway not connected",
      statusOnline: "Demo DOM bridge connected",

      // Welcome
      welcome: "BuildMate is monitoring your Build PC (read-only). Pick a goal below or type your requirements.",

      // Cart / tracker
      cartTitle: "Current build",
      cartEmpty: "No components selected yet",
      cartUnavailable: "Cannot read cart. Try reloading the page.",

      // Chat input
      chatPlaceholder: "Message BuildMate...",
      sendLabel: "Send",
      processing: "Processing...",

      // VGA demo action
      actionReady: "Ready to add VGA demo.",
      actionLocating: "Locating VGA category…",
      actionSuccess: "VGA demo added to Build PC.",
      actionUnverified: "Clicked but could not verify the build update.",
      actionCancelled: "Demo action cancelled.",
      
      // Action status maps
      action_locating_category: "Locating VGA category…",
      action_opening_modal: "Opening VGA list…",
      action_waiting_products: "Waiting for products to load…",
      action_selecting_product: "Selecting demo VGA…",
      action_verifying: "Verifying build update…",
      action_reverting: "Reverting component…",
      action_reverted: "Component reverted.",
      action_success: "VGA demo added to Build PC.",
      action_unverified: "Clicked but could not verify build update.",
      action_failed: "Failed to add VGA.",
      action_cancelled: "Demo action cancelled.",

      // Error codes
      error_CANCELLED: "Action was cancelled.",
      error_MODAL_TIMEOUT: "VGA list took too long to open.",
      error_PRODUCT_TIMEOUT: "No selectable products loaded.",
      error_PAGE_CHANGED: "Page changed, please try again.",
      error_VGA_ROW_NOT_FOUND: "VGA category not found on page.",
      error_CATEGORY_BUTTON_NOT_FOUND: "Select/Edit button not found.",
      error_REVERT_CONFLICT: "Build changed, so the component cannot be safely reverted.",
      error_REMOVE_BUTTON_NOT_FOUND: "Remove component button not found.",
      error_COMPONENT_NOT_SELECTED: "The component is no longer in the build.",
      error_REMOVE_VERIFY_TIMEOUT: "Could not verify the revert action.",

      confirmTitle: "Confirm add VGA demo?",
      confirmBody: "Extension opens the VGA category and selects the first displayed product. No checkout.",
      confirmBtn: "Confirm",
      cancelBtn: "Cancel",
      addVgaBtn: "Add VGA demo",
      revertBtn: "Revert",
      cancelRunningBtn: "Cancel",

      // Product / build widgets
      addToConfig: "Add to build",
      addedSuccess: "Added successfully ✓",
      applyBuild: "Apply this build",
      appliedBuild: "Build applied ✓",
      buildCardTitle: "Recommended build",
      totalCost: "Total Cost",

      // Fallback replies
      fallbacks: [
        'You can try: type "VGA" to demo adding a graphics card, "mouse" for accessories, or "full build" for a complete config suggestion.',
        'I\'m in Demo mode. Try typing "gaming build" or "monitor recommendation" to see interactive features!',
        'Demo mode active. Want me to suggest a VGA, peripheral, or a full PC build?',
        'Great question! I\'m not connected to the Gateway yet. Try keywords like "VGA", "gaming mouse", or "budget 15M" to see the UI demo.'
      ],

      // Product recommendation triggers
      triggers: {
        vga: ["vga"],
        peripheral: ["mouse", "monitor", "keyboard"],
        fullBuild: ["full", "build", "whole", "config", "setup"]
      },

      // Product recommendations
      peripheralReply: "I found a product that fits your needs perfectly:",
      fullBuildReply: "Based on your requirements, here's the optimal build I recommend:",
      
      // Goals
      goals: {
        'gaming-25m': { title: 'Smooth 2K Gaming', budget: 'Around 25M VND' },
        'creator-30m': { title: 'Content Creator', budget: 'Around 30M VND' },
        'study-15m': { title: 'Study & Work', budget: 'Around 15M VND' }
      }
    }
  };

  let currentLang = (navigator.language || 'vi').startsWith('en') ? 'en' : 'vi';

  function t(key) {
    return (translations[currentLang] || translations['vi'])[key] ?? key;
  }

  function setLang(lang) {
    if (translations[lang]) currentLang = lang;
  }

  function getLang() { return currentLang; }

  globalThis.BuildMateI18n = { t, setLang, getLang, translations };
  if (typeof module !== 'undefined') module.exports = globalThis.BuildMateI18n;
})();
