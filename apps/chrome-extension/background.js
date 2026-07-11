/**
 * BuildMate extension service worker — DOM executor bridge client.
 *
 * Transport: an outbound **WebSocket** per BuildPC tab to the BE bridge
 * (docs/dom-executor-bridge-contract.md §3). The worker never exposes a port;
 * Chrome only needs to reach out. Flow per context (tab):
 *
 *   open        -> send { type: "dom.register", context_id, page_url }
 *   bridge push -> { type: "dom.command", command_id, command }
 *   execute via content script, then reply { type: "dom.result", command_id, ... }
 *
 * The bridge URL defaults to the local chat-backend and can be overridden via
 * chrome.storage.local `bridgeUrl` (see README). If you change the host, add it
 * to manifest `host_permissions`.
 */
const DEFAULT_BRIDGE_URL = "ws://127.0.0.1:8790/dom-bridge";

/** context_id -> { contextId, pageUrl, tabId, url, ws, closed, reconnectTimer } */
const contexts = new Map();

async function resolveBridgeUrl() {
  try {
    const { bridgeUrl } = await chrome.storage.local.get("bridgeUrl");
    return typeof bridgeUrl === "string" && bridgeUrl.trim() ? bridgeUrl.trim() : DEFAULT_BRIDGE_URL;
  } catch {
    return DEFAULT_BRIDGE_URL;
  }
}

function connect(ctx) {
  let ws;
  try {
    ws = new WebSocket(ctx.url);
  } catch (error) {
    console.warn("[BuildMate] bridge connect failed", error);
    scheduleReconnect(ctx);
    return;
  }
  ctx.ws = ws;

  ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ type: "dom.register", context_id: ctx.contextId, page_url: ctx.pageUrl }));
  });

  ws.addEventListener("message", async (event) => {
    let msg;
    try {
      msg = JSON.parse(typeof event.data === "string" ? event.data : "");
    } catch {
      return;
    }
    if (msg.type !== "dom.command" || !msg.command) return;

    // Never run selectors here — hand the semantic command to the content
    // script's DOM adapter, which owns all page interaction and verification.
    let result;
    try {
      result = await chrome.tabs.sendMessage(ctx.tabId, {
        type: "BUILDMATE_DOM_COMMAND",
        command: msg.command,
      });
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.message : "TAB_UNAVAILABLE" };
    }
    try {
      ws.send(JSON.stringify({ type: "dom.result", command_id: msg.command_id, ...result }));
    } catch (error) {
      console.warn("[BuildMate] failed to send dom.result", error);
    }
  });

  ws.addEventListener("close", () => scheduleReconnect(ctx));
  ws.addEventListener("error", () => {
    try {
      ws.close();
    } catch {
      /* noop */
    }
  });
}

function scheduleReconnect(ctx) {
  if (ctx.closed) return;
  if (ctx.reconnectTimer) return;
  ctx.reconnectTimer = setTimeout(() => {
    ctx.reconnectTimer = null;
    if (!ctx.closed) connect(ctx);
  }, 1500);
}

async function registerContext({ contextId, pageUrl, tabId }) {
  if (typeof contextId !== "string" || typeof pageUrl !== "string") {
    return { ok: false, error: "INVALID_CONTEXT" };
  }
  teardown(contextId); // drop any prior socket for this tab
  const ctx = {
    contextId,
    pageUrl,
    tabId,
    url: await resolveBridgeUrl(),
    ws: null,
    closed: false,
    reconnectTimer: null,
  };
  contexts.set(contextId, ctx);
  connect(ctx);
  return { ok: true, context_id: contextId };
}

function teardown(contextId) {
  const ctx = contexts.get(contextId);
  if (!ctx) return;
  ctx.closed = true;
  if (ctx.reconnectTimer) clearTimeout(ctx.reconnectTimer);
  try {
    ctx.ws?.close();
  } catch {
    /* noop */
  }
  contexts.delete(contextId);
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: "BUILDMATE_TOGGLE_PANEL" }).catch(() => {
      // Content script not loaded on this tab — ignore.
    });
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "buildmate-dom-bridge" || !port.sender?.tab?.id) return;
  let contextId = null;

  port.onMessage.addListener((message) => {
    if (message?.type === "REGISTER") {
      contextId = message.context_id;
      void registerContext({
        contextId,
        pageUrl: message.page_url,
        tabId: port.sender.tab.id,
      }).then((result) => port.postMessage({ type: "REGISTERED", ...result }));
      return;
    }
    if (message?.type === "HEARTBEAT" && contextId) {
      // Keep the socket (and the MV3 worker) warm.
      const ctx = contexts.get(contextId);
      if (ctx?.ws && ctx.ws.readyState === WebSocket.OPEN) {
        try {
          ctx.ws.send(JSON.stringify({ type: "dom.ping" }));
        } catch {
          /* noop */
        }
      }
    }
  });

  port.onDisconnect.addListener(() => {
    if (contextId) teardown(contextId);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "BUILDMATE_USER_INTENT") return undefined;
  // Production forwards this envelope to BE over its authenticated bridge; it
  // must never invoke a DOM command or MCP client directly from the page.
  sendResponse({ ok: false, error: "BACKEND_NOT_CONNECTED" });
  return undefined;
});
