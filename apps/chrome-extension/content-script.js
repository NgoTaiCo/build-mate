(function () {
  const DEFAULT_CHAT_URL = "https://madrid-award-brunswick-manually.trycloudflare.com/chat";
  if (!globalThis.BuildMateEligibility.isExactBuildPcUrl(location.href)) return;
  const panel = globalThis.BuildMatePanel.ensureMounted();
  const trackerStop = globalThis.BuildMateTracker.startBuildTracker({ doc: document, onSnapshot: (snapshot) => panel.setSnapshot(snapshot) });
  
  let contextId = null;
  try { contextId = localStorage.getItem("buildmate_session_id"); } catch(e) {}
  if (!contextId) {
    contextId = crypto.randomUUID();
    try { localStorage.setItem("buildmate_session_id", contextId); } catch(e) {}
  }
  
  const bridge = globalThis.BuildMateBridgeAdapter.createBridgeAdapter({ onCommand: (command) => panel.applyBridgeCommand(command) });
  let actionInFlight = false;
  let chatAbortController = null;

  async function executeAdd(component) {
    if (actionInFlight) return { ok: false, error: "ACTION_IN_PROGRESS" };
    actionInFlight = true;
    panel.setAction({ type: "START" });
    try {
      const result = await globalThis.BuildMateDomAdapter.addComponent(component);
      const isVi = globalThis.BuildMateI18n?.getLang() === 'vi';
      if (result.ok) {
        panel.setSnapshot(result.snapshot);
        panel.setAction({ type: "SUCCESS", message: isVi ? `Đã thêm ${component.sku} thành công.` : `Successfully added ${component.sku}.`, component, revision: result.snapshot?.revision ?? null });
      } else {
        panel.setAction({ type: "FAILED", code: result.error, message: isVi ? `Lỗi: ${result.error}` : `Error: ${result.error}` });
      }
      return result;
    } catch (error) {
      panel.setAction({ type: "FAILED", code: "EXCEPTION", message: String(error) });
      return { ok: false, error: String(error) };
    } finally {
      actionInFlight = false;
    }
  }

  async function executeRemove(component, expectedRevision) {
    if (actionInFlight) return { ok: false, error: "ACTION_IN_PROGRESS" };
    actionInFlight = true;
    panel.setAction({ type: "REVERT_START" });
    try {
      const result = await globalThis.BuildMateDomAdapter.removeComponent(component, expectedRevision);
      const isVi = globalThis.BuildMateI18n?.getLang() === 'vi';
      if (result.ok) {
        panel.setSnapshot(result.snapshot);
        panel.setAction({ type: "REVERT_SUCCESS", message: isVi ? `Đã hoàn tác ${component.sku}.` : `Reverted ${component.sku}.` });
      } else {
        panel.setAction({ type: "FAILED", code: result.error, message: isVi ? `Không thể hoàn tác: ${result.error}` : `Cannot revert: ${result.error}` });
      }
      return result;
    } catch (error) {
      panel.setAction({ type: "FAILED", code: "EXCEPTION", message: String(error) });
      return { ok: false, error: String(error) };
    } finally {
      actionInFlight = false;
    }
  }

  async function sendUserIntent(intent) {
    const response = await chrome.runtime.sendMessage({
      type: "BUILDMATE_USER_INTENT",
      context_id: contextId,
      page: { origin: location.origin, path: location.pathname },
      intent,
    });
    if (!response?.ok) throw new Error(response?.error ?? "BACKEND_NOT_CONNECTED");
  }

  panel.setHandlers({
    onRequestAdd: async () => {
      panel.setAction({ type: "REQUESTED" });
      try {
        await sendUserIntent({ type: "request_add", category: "gpu", user_confirmed: true });
      } catch (error) {
        panel.setAction({ type: "FAILED", code: "BACKEND_NOT_CONNECTED", message: String(error) });
      }
    },
    onRequestRevert: async (component, expectedRevision) => {
      if (!component) return;
      const isVi = globalThis.BuildMateI18n?.getLang() === 'vi';
      panel.setAction({ type: "REQUESTED", message: isVi ? "Đã gửi yêu cầu hoàn tác tới OpenClaw." : "Revert request sent to OpenClaw." });
      try {
        await sendUserIntent({ type: "request_revert", component, expected_revision: expectedRevision ?? undefined, user_confirmed: true });
      } catch (error) {
        panel.setAction({ type: "FAILED", code: "BACKEND_NOT_CONNECTED", message: String(error) });
      }
    },
    onMockCommand: () => {
      const isVi = globalThis.BuildMateI18n?.getLang() === 'vi';
      return bridge.receive({
        v: 1, id: `mock-${Date.now()}`, type: "buildmate.ui.suggest",
        tab: { origin: "https://phongvu.vn", path: "/buildpc" },
        issuedAt: Date.now(), expiresAt: Date.now() + 30000,
        payload: { message: isVi ? "OpenClaw mock: hãy xác nhận trước khi thêm VGA demo." : "OpenClaw mock: please confirm before adding VGA demo.", category: "VGA" }
      });
    },
    onChatMessage: async (text, snapshot, onProgress) => {
      chatAbortController?.abort();
      const controller = new AbortController();
      chatAbortController = controller;
      const data = await chrome.storage.local.get("chatUrl");
      const chatUrl = typeof data.chatUrl === "string" && data.chatUrl.trim() ? data.chatUrl.trim() : DEFAULT_CHAT_URL;
      const snapshotStr = snapshot ? JSON.stringify(snapshot) : "None";
      const payloadMessage = `${text}\n\n[System: User is on BuildPC page. Your context_id for MCP tools is "${contextId}". Current build state: ${snapshotStr}]`;
      try {
        const response = await fetch(chatUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream, application/x-ndjson, application/json",
          },
          body: JSON.stringify({ message: payloadMessage, sessionId: contextId, currentBuild: snapshot }),
          signal: controller.signal,
        });
        return await globalThis.BuildMateChatStream.readChatStream(response, (event) => {
          if (event.kind === "delta") onProgress?.(event.text);
        });
      } finally {
        if (chatAbortController === controller) chatAbortController = null;
      }
    },
    onClearChat: () => {
      chatAbortController?.abort();
      contextId = crypto.randomUUID();
      try { localStorage.setItem("buildmate_session_id", contextId); } catch(e) {}
      clearInterval(heartbeatTimer);
      bridgePort?.disconnect();
      connectBridge();
    }
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
    if (!runtimeIsAvailable()) { panel.setConnected(false); return; }
    try {
      bridgePort = chrome.runtime.connect({ name: "buildmate-dom-bridge" });
    } catch (error) {
      panel.setConnected(false);
      if (!isInvalidatedContext(error)) console.warn("[BuildMate] DOM bridge connection failed", error);
      return;
    }
    bridgePort.onMessage.addListener((message) => {
      if (message?.type === "REGISTERED") {
        panel.setConnected(Boolean(message.ok));
        if (!message.ok) console.warn("[BuildMate] DOM bridge registration failed", message.error);
        else console.info("[BuildMate] DOM bridge connected", { contextId });
      }
    });
    bridgePort.onDisconnect.addListener(() => {
      clearInterval(heartbeatTimer);
      panel.setConnected(false);
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
          return executeAdd(command.component);
        }
        if (command?.action === "remove_component") {
          return executeRemove(command.component, command.expected_revision);
        }
        return { ok: false, error: "INVALID_ACTION" };
      })().then(sendResponse, (error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
      return true;
    }
    
    return undefined;
  });

  addEventListener("pagehide", () => {
    trackerStop();
    clearInterval(heartbeatTimer);
    bridgePort?.disconnect();
  }, { once: true });
})();
