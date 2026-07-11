const RELAY_URL = "http://127.0.0.1:8781";
const contexts = new Map();

async function post(path, body) {
  const response = await fetch(`${RELAY_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Relay returned HTTP ${response.status}`);
  return response.json();
}

async function poll(contextId) {
  const context = contexts.get(contextId);
  if (!context || context.polling) return;
  context.polling = true;
  try {
    while (contexts.has(contextId)) {
      const response = await fetch(`${RELAY_URL}/commands?context_id=${encodeURIComponent(contextId)}`);
      if (!response.ok) throw new Error(`Relay returned HTTP ${response.status}`);
      const { command } = await response.json();
      if (!command) continue;

      let result;
      try {
        result = await chrome.tabs.sendMessage(context.tabId, { type: "BUILDMATE_DOM_COMMAND", command });
      } catch (error) {
        result = { ok: false, error: error instanceof Error ? error.message : "TAB_UNAVAILABLE" };
      }
      await post(`/commands/${encodeURIComponent(command.command_id)}/result`, result);
    }
  } catch (error) {
    console.warn("[BuildMate] relay disconnected", error);
  } finally {
    const current = contexts.get(contextId);
    if (current) {
      current.polling = false;
      setTimeout(() => void poll(contextId), 1500);
    }
  }
}

async function registerContext({ contextId, pageUrl, tabId }) {
  if (typeof contextId !== "string" || typeof pageUrl !== "string") {
    return { ok: false, error: "INVALID_CONTEXT" };
  }
  contexts.set(contextId, { tabId, pageUrl, polling: false, lastHeartbeatAt: Date.now() });
  try {
    await post("/contexts", { context_id: contextId, page_url: pageUrl });
    void poll(contextId);
    return { ok: true, context_id: contextId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: "BUILDMATE_TOGGLE_PANEL" }).catch(() => {
      // Ignore errors if the content script is not loaded
    });
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "buildmate-dom-bridge" || !port.sender?.tab?.id) return;
  let contextId = null;

  port.onMessage.addListener((message) => {
    if (message?.type === "REGISTER") {
      contextId = message.context_id;
      void registerContext({ contextId, pageUrl: message.page_url, tabId: port.sender.tab.id })
        .then((result) => port.postMessage({ type: "REGISTERED", ...result }));
      return;
    }
    if (message?.type === "HEARTBEAT" && contextId) {
      const context = contexts.get(contextId);
      if (context) {
        context.lastHeartbeatAt = Date.now();
        void poll(contextId);
      }
    }
  });

  port.onDisconnect.addListener(() => {
    if (contextId) contexts.delete(contextId);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "BUILDMATE_CHAT_MESSAGE") {
    // Append context_id and snapshot as a system instruction so the LLM knows it and can call MCP tools or answer directly
    const snapshotStr = message.snapshot ? JSON.stringify(message.snapshot) : "None";
    const payloadMessage = `${message.text}\n\n[System: User is on BuildPC page. Your context_id for MCP tools is "${message.sessionId}". Current build state: ${snapshotStr}]`;
    fetch("https://administrators-carlo-received-nascar.trycloudflare.com/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: payloadMessage, sessionId: message.sessionId, currentBuild: message.snapshot })
    })
    .then(r => r.json())
    .then(data => sendResponse({ ok: true, reply: data.reply }))
    .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (message?.type !== "BUILDMATE_USER_INTENT") return undefined;

  // The production worker forwards this envelope to BE over its authenticated
  // bridge. It must never invoke a local DOM command or MCP client directly.
  sendResponse({ ok: false, error: "BACKEND_NOT_CONNECTED" });
  return undefined;
});
