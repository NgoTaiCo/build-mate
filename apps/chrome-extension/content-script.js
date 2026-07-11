(function () {
  if (!globalThis.BuildMateEligibility.isExactBuildPcUrl(location.href)) return;
  const panel = globalThis.BuildMatePanel.ensureMounted();
  const trackerStop = globalThis.BuildMateTracker.startBuildTracker({ doc: document, onSnapshot: (snapshot) => panel.setSnapshot(snapshot) });
  const bridge = globalThis.BuildMateBridgeAdapter.createBridgeAdapter({ onCommand: (command) => panel.applyBridgeCommand(command) });

  let actionController = null;

  panel.setHandlers({
    onCancelAction: () => actionController?.abort(),
    onMockCommand: () => bridge.receive({
      v: 1, id: `mock-${Date.now()}`, type: "buildmate.ui.suggest",
      tab: { origin: "https://phongvu.vn", path: "/buildpc" },
      issuedAt: Date.now(), expiresAt: Date.now() + 30000,
      payload: { message: "OpenClaw mock: hãy xác nhận trước khi thêm VGA demo.", category: "VGA" }
    })
  });

  const contextId = crypto.randomUUID();
  let bridgePort;
  let heartbeatTimer;

  function runtimeIsAvailable() {
    return Boolean(globalThis.chrome?.runtime?.id);
  }

  function isInvalidatedContext(error) {
    return error instanceof Error && /extension context invalidated/i.test(error.message);
  }

  function connectBridge() {
    if (!runtimeIsAvailable()) return;
    try {
      bridgePort = chrome.runtime.connect({ name: "buildmate-dom-bridge" });
    } catch (error) {
      if (!isInvalidatedContext(error)) console.warn("[BuildMate] DOM bridge connection failed", error);
      return;
    }
    bridgePort.onMessage.addListener((message) => {
      if (message?.type === "REGISTERED") {
        if (!message.ok) console.warn("[BuildMate] DOM bridge registration failed", message.error);
        else console.info("[BuildMate] DOM bridge connected", { contextId });
      }
    });
    bridgePort.onDisconnect.addListener(() => {
      clearInterval(heartbeatTimer);
      if (runtimeIsAvailable()) setTimeout(connectBridge, 1000);
    });
    try {
      bridgePort.postMessage({ type: "REGISTER", context_id: contextId, page_url: location.href });
    } catch (error) {
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
        if (!isInvalidatedContext(error)) console.warn("[BuildMate] DOM bridge heartbeat failed", error);
      }
    }, 15000);
  }
  connectBridge();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!globalThis.BuildMateEligibility.isExactBuildPcUrl(location.href)) return undefined;
    
    if (message?.type === "BUILDMATE_TOGGLE_PANEL") {
      sendResponse({ ok: true, open: panel.toggle().open });
      return undefined;
    }
    
    if (message?.type === "BUILDMATE_MOCK_NODE_COMMAND") {
      sendResponse(bridge.receive(message.command));
      return undefined;
    }

    if (message?.type === "BUILDMATE_DOM_COMMAND") {
      const command = message.command;
      (async () => {
        if (command?.action === "read_build") {
          return { ok: true, snapshot: globalThis.BuildMateDomAdapter.readBuild() };
        }
        if (command?.action === "add_component") {
          actionController = new AbortController();
          panel.setAction({ type: "START" });
          
          try {
            const result = await globalThis.BuildMateDomAdapter.addComponent(command.component);
            actionController = null;
            if (result.ok) {
              panel.setAction({ type: "SUCCESS", message: `Đã thêm ${command.component.sku} thành công.` });
            } else {
              panel.setAction({ type: "FAILED", code: result.error, message: `Lỗi: ${result.error}` });
            }
            return result;
          } catch (error) {
            actionController = null;
            panel.setAction({ type: "FAILED", code: "EXCEPTION", message: String(error) });
            return { ok: false, error: String(error) };
          }
        }
        return { ok: false, error: "INVALID_ACTION" };
      })().then(sendResponse, (error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
      return true;
    }
    
    return undefined;
  });

  addEventListener("pagehide", () => {
    actionController?.abort();
    trackerStop();
    clearInterval(heartbeatTimer);
    bridgePort?.disconnect();
  }, { once: true });
})();
