(function () {
  const DEMO_NOTICE = "Demo cục bộ — chưa kết nối dữ liệu Phong Vu";

  const goals = [
    {
      id: "gaming-25m",
      title: "Gaming 2K mượt mà",
      budget: "Khoảng 25 triệu",
      summary: "Ưu tiên FPS ổn định, khả năng nâng cấp và tản nhiệt hợp lý.",
      prompt: {
        vi: "Tư vấn build PC khoảng 25 triệu để chơi game 2K High mượt, FPS ổn định. Ưu tiên 32GB RAM, tản nhiệt tốt và dễ nâng cấp.",
        en: "Build a ~25M VND PC for smooth 1440p High gaming with stable FPS. Prioritize 32GB RAM, good cooling, and upgrade headroom."
      }
    },
    {
      id: "creator-30m",
      title: "Sáng tạo nội dung",
      budget: "Khoảng 30 triệu",
      summary: "Cân bằng CPU đa nhân, RAM và GPU cho dựng video.",
      prompt: {
        vi: "Tư vấn build PC khoảng 30 triệu cho Premiere/DaVinci, Photoshop và dựng video 4K cơ bản. Ưu tiên CPU đa nhân, 32GB RAM, SSD nhanh và GPU acceleration.",
        en: "Build a ~30M VND PC for Premiere/DaVinci, Photoshop, and basic 4K editing. Prioritize a multicore CPU, 32GB RAM, fast SSD, and GPU acceleration."
      }
    },
    {
      id: "study-15m",
      title: "Học tập và làm việc",
      budget: "Khoảng 15 triệu",
      summary: "Tập trung tính ổn định, tiết kiệm điện và nâng cấp dễ dàng.",
      prompt: {
        vi: "Tư vấn build PC khoảng 15 triệu cho lập trình, Office, nhiều tab trình duyệt và chỉnh ảnh nhẹ. Ưu tiên ổn định, SSD, RAM đủ dùng và tiết kiệm điện.",
        en: "Build a ~15M VND PC for programming, Office, many browser tabs, and light photo editing. Prioritize reliability, SSD speed, sufficient RAM, and low power use."
      }
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
