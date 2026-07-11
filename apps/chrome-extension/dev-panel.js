(function () {
  function mount() {
    if (document.querySelector("#buildmate-dev-panel")) return null;
    const host = document.createElement("aside");
    host.id = "buildmate-dev-panel";
    host.setAttribute("aria-label", "BuildMate developer controls");
    host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:280px;font:13px/1.4 system-ui,sans-serif;color:#172033";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        .panel{background:#fff;border:1px solid #c9d2df;border-radius:8px;box-shadow:0 10px 28px rgba(23,32,51,.18);padding:12px;display:grid;gap:10px}
        .head{display:flex;justify-content:space-between;align-items:center;font-weight:700}.dot{width:9px;height:9px;border-radius:50%;background:#d68a13}.dot.ok{background:#218739}.actions{display:flex;flex-wrap:wrap;gap:8px}.actions button{appearance:none;border:1px solid #9eabbc;background:#fff;color:#172033;border-radius:5px;padding:7px 9px;cursor:pointer;font:inherit}.actions button:hover{background:#edf3f8}.status{margin:0;color:#536275;min-height:36px;overflow-wrap:anywhere}.report{display:none;max-height:180px;overflow:auto;margin:0;padding:8px;background:#f3f6f9;border:1px solid #d9e0e8;border-radius:4px;font:11px/1.35 ui-monospace,SFMono-Regular,monospace;white-space:pre-wrap}.close{border:0;background:none;color:#536275;cursor:pointer;font-size:18px;line-height:1}
      </style>
      <section class="panel">
        <div class="head"><span>BuildMate</span><button class="close" type="button" aria-label="Đóng" title="Đóng">×</button></div>
        <p class="status">Đang kết nối relay...</p>
        <div class="actions">
          <button type="button" data-action="read" title="Đọc cấu hình Build PC">Đọc build</button>
          <button type="button" data-action="vga" title="Thử mở danh sách VGA">Mở VGA</button>
          <button type="button" data-action="probe" title="Kiểm tra DOM contract của trang">Probe DOM</button>
          <button type="button" data-action="modal" title="Kiểm tra dialog đang mở">Probe modal</button>
        </div>
        <pre class="report"></pre>
      </section>`;
    document.documentElement.append(host);
    const status = root.querySelector(".status");
    const report = root.querySelector(".report");
    const dot = document.createElement("span");
    dot.className = "dot";
    root.querySelector(".head").prepend(dot);
    root.querySelector(".close").addEventListener("click", () => host.remove());
    return {
      setConnected(connected) { dot.classList.toggle("ok", connected); status.textContent = connected ? "Relay đã kết nối." : "Relay chưa kết nối."; },
      setStatus(message) { status.textContent = message; },
      setReport(value) { report.textContent = JSON.stringify(value, null, 2); report.style.display = "block"; },
      onRead(handler) { root.querySelector('[data-action="read"]').addEventListener("click", handler); },
      onVga(handler) { root.querySelector('[data-action="vga"]').addEventListener("click", handler); },
      onProbe(handler) { root.querySelector('[data-action="probe"]').addEventListener("click", handler); },
      onModal(handler) { root.querySelector('[data-action="modal"]').addEventListener("click", handler); },
    };
  }

  globalThis.BuildMateDevPanel = { mount };
})();
