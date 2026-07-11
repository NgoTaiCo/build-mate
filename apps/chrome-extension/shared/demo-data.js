(function () {
  const DEMO_NOTICE = "Demo cục bộ — chưa kết nối dữ liệu Phong Vu";

  const goals = [
    {
      id: "gaming-25m",
      title: "Gaming 2K mượt mà",
      budget: "Khoảng 25 triệu",
      summary: "Ưu tiên FPS ổn định, khả năng nâng cấp và tản nhiệt hợp lý."
    },
    {
      id: "creator-30m",
      title: "Sáng tạo nội dung",
      budget: "Khoảng 30 triệu",
      summary: "Cân bằng CPU đa nhân, RAM và GPU cho dựng video."
    },
    {
      id: "study-15m",
      title: "Học tập và làm việc",
      budget: "Khoảng 15 triệu",
      summary: "Tập trung tính ổn định, tiết kiệm điện và nâng cấp dễ dàng."
    }
  ];

  const build = {
    totalLabel: "24.890.000 đ",
    reviewStatus: "attention",
    reviewMessage: "Demo phát hiện 1 điểm cần xem lại trước khi chốt build.",
    components: [
      { category: "CPU", name: "AMD Ryzen 5 7600", status: "Đã chọn" },
      { category: "Mainboard", name: "B650M WiFi", status: "Đã chọn" },
      { category: "RAM", name: "32GB DDR5", status: "Đã chọn" },
      { category: "GPU", name: "RTX 4060 Ti", status: "Đã chọn" }
    ]
  };

  globalThis.BuildMateDemoData = { DEMO_NOTICE, goals, build };
  if (typeof module !== "undefined") {
    module.exports = globalThis.BuildMateDemoData;
  }
})();
