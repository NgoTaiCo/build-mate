(function () {
  const intro = document.getElementById("intro");
  const status = document.getElementById("status");

  function show(message, kind) {
    status.textContent = message;
    status.className = kind || "";
  }

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab || !globalThis.BuildMateEligibility.isExactBuildPcUrl(tab.url || "")) {
      intro.textContent = "BuildMate chỉ chạy trên URL chính xác https://phongvu.vn/buildpc.";
      show("Mở URL đó (không www, không query) rồi bấm biểu tượng BuildMate lần nữa.", "warning");
      return;
    }

    intro.textContent = "Panel BuildMate sẽ được mở hoặc đóng trong tab này.";
    chrome.tabs.sendMessage(tab.id, { type: "BUILDMATE_TOGGLE_PANEL" }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        show("Trang đang tải hoặc extension vừa được cài. Refresh tab rồi thử lại.", "warning");
        return;
      }
      show(response.open ? "BuildMate đang mở. Đây là demo cục bộ." : "BuildMate đã đóng.", "ready");
    });
  });
})();
