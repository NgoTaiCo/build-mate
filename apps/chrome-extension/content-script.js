(function () {
  const supported = () => {
    const url = new URL(location.href);
    return (url.protocol === "https:" && ["phongvu.vn", "www.phongvu.vn"].includes(url.hostname) && url.pathname === "/buildpc") ||
      (url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port === "8781" && url.pathname === "/mock-buildpc");
  };
  if (!supported()) return;

  const contextId = crypto.randomUUID();
  const panel = globalThis.BuildMateDevPanel.mount();
  panel?.onRead(() => {
    const snapshot = globalThis.BuildMateDomAdapter.readBuild();
    panel.setStatus(`Đọc ${snapshot.components.length} linh kiện, tổng ${snapshot.total ?? 0} VND.`);
  });
  panel?.onVga(async () => {
    panel.setStatus("Đang mở danh sách VGA...");
    const result = await globalThis.BuildMateDomAdapter.openCategory("gpu");
    panel.setStatus(result.ok ? "Đã mở danh sách VGA." : `Không thể mở VGA: ${result.error}`);
  });
  panel?.onProbe(async () => {
    panel.setStatus("Đang kiểm tra DOM contract...");
    const report = globalThis.BuildMateDomProbe.pageReport();
    panel.setReport(report);
    const found = report.checks.category_actions_found;
    panel.setStatus(`DOM probe xong: ${found}. Mở VGA thủ công rồi bấm Probe modal.`);
    console.info("[BuildMate] DOM contract report", report);
  });
  panel?.onModal(() => {
    const report = globalThis.BuildMateDomProbe.modalReport();
    panel.setReport(report);
    panel.setStatus(report.modal_contract.visible ? "Modal semantic đã xác minh." : "Modal semantic chưa xác minh; xem diagnostic candidates.");
    console.info("[BuildMate] DOM modal report", report);
  });
  let bridgePort;
  let heartbeatTimer;

  function runtimeIsAvailable() {
    return Boolean(globalThis.chrome?.runtime?.id);
  }

  function isInvalidatedContext(error) {
    return error instanceof Error && /extension context invalidated/i.test(error.message);
  }

  function connectBridge() {
    // Reloading an unpacked extension invalidates the old content-script
    // context before Chrome replaces it on a reloaded page.
    if (!runtimeIsAvailable()) {
      panel?.setConnected(false);
      return;
    }
    try {
      bridgePort = chrome.runtime.connect({ name: "buildmate-dom-bridge" });
    } catch (error) {
      panel?.setConnected(false);
      if (!isInvalidatedContext(error)) console.warn("[BuildMate] DOM bridge connection failed", error);
      return;
    }
    bridgePort.onMessage.addListener((message) => {
      if (message?.type !== "REGISTERED") return;
      panel?.setConnected(Boolean(message.ok));
      if (!message.ok) console.warn("[BuildMate] DOM bridge registration failed", message.error);
      else console.info("[BuildMate] DOM bridge connected", { contextId });
    });
    bridgePort.onDisconnect.addListener(() => {
      clearInterval(heartbeatTimer);
      panel?.setConnected(false);
      if (runtimeIsAvailable()) setTimeout(connectBridge, 1000);
    });
    try {
      bridgePort.postMessage({ type: "REGISTER", context_id: contextId, page_url: location.href });
    } catch (error) {
      panel?.setConnected(false);
      if (!isInvalidatedContext(error)) console.warn("[BuildMate] DOM bridge registration failed", error);
      return;
    }
    heartbeatTimer = setInterval(() => {
      if (!runtimeIsAvailable()) {
        clearInterval(heartbeatTimer);
        return;
      }
      try {
        bridgePort?.postMessage({ type: "HEARTBEAT" });
      } catch (error) {
        clearInterval(heartbeatTimer);
        panel?.setConnected(false);
        if (!isInvalidatedContext(error)) console.warn("[BuildMate] DOM bridge heartbeat failed", error);
      }
    }, 15000);
  }
  connectBridge();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "BUILDMATE_DOM_COMMAND") return undefined;
    const command = message.command;
    (async () => {
      if (command?.action === "read_build") return { ok: true, snapshot: globalThis.BuildMateDomAdapter.readBuild() };
      if (command?.action === "add_component") return globalThis.BuildMateDomAdapter.addComponent(command.component);
      return { ok: false, error: "INVALID_ACTION" };
    })().then(sendResponse, (error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  });
  addEventListener("pagehide", () => {
    clearInterval(heartbeatTimer);
    bridgePort?.disconnect();
  }, { once: true });
})();
