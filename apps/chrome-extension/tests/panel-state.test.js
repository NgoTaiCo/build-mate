const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { isExactBuildPcUrl } = require("../shared/eligibility.js");
const { initialPanelState, reducePanelState } = require("../shared/panel-state.js");
const { initialActionState, reduceActionState } = require("../shared/action-state.js");
const { validateCommand } = require("../shared/command-policy.js");
const { snapshotKey } = require("../shared/snapshot.js");
const { createSseDecoder, mergeStreamText, readChatStream } = require("../shared/chat-stream.js");

test("only recognises the exact canonical Phong Vu Build PC URL", () => {
  assert.equal(isExactBuildPcUrl("https://phongvu.vn/buildpc"), true);
  assert.equal(isExactBuildPcUrl("https://phongvu.vn/buildpc?profile=1"), false);
  assert.equal(isExactBuildPcUrl("https://www.phongvu.vn/buildpc"), false);
  assert.equal(isExactBuildPcUrl("https://phongvu.vn/buildpc/anything"), false);
});

test("keeps demo add actions explicit and typed", () => {
  const started = reduceActionState(initialActionState, { type: "START" });
  assert.equal(started.status, "locating_category");
  assert.equal(reduceActionState(initialActionState, { type: "REQUESTED" }).status, "requested");
  assert.equal(reduceActionState(started, { type: "FAILED", code: "MODAL_TIMEOUT", message: "Không mở được." }).errorCode, "MODAL_TIMEOUT");
  assert.equal(reduceActionState(started, { type: "CANCEL" }).status, "cancelled");
});

test("accepts only fresh allowlisted bridge commands for the exact tab", () => {
  const now = 1000;
  const valid = { v: 1, id: "request-1", type: "buildmate.build.request-add", tab: { origin: "https://phongvu.vn", path: "/buildpc" }, expiresAt: now + 1, payload: { message: "Xác nhận thêm VGA", category: "VGA" } };
  assert.deepEqual(validateCommand(valid, now), { ok: true });
  assert.equal(validateCommand({ ...valid, type: "run.javascript" }, now).reason, "INVALID_COMMAND");
  assert.equal(validateCommand({ ...valid, tab: { origin: "https://example.com", path: "/" } }, now).reason, "WRONG_TAB");
  assert.equal(validateCommand({ ...valid, expiresAt: now }, now).reason, "EXPIRED");
});

test("normalizes snapshots before deciding they changed", () => {
  const first = snapshotKey({ status: "ready", components: [{ category: "VGA", name: " RTX 4060 " }], total: " 10.000.000 đ " });
  const second = snapshotKey({ status: "ready", components: [{ category: "VGA", name: " RTX 4060 " }], total: " 10.000.000 đ " });
  assert.equal(first, second);
});

test("opens and closes the panel without persistent state", () => {
  const opened = reducePanelState(initialPanelState, { type: "OPEN" });
  assert.equal(opened.open, true);
  assert.equal(opened.activeView, "chat");
  assert.equal(opened.messages.length, 1);
  assert.equal(reducePanelState(opened, { type: "CLOSE" }).open, false);
});

test("selects a local goal and enters review", () => {
  const goal = reducePanelState(initialPanelState, { type: "SELECT_GOAL", goalId: "gaming-25m" });
  assert.equal(goal.open, true);
  assert.equal(goal.activeView, "chat");
  assert.equal(goal.selectedGoalId, "gaming-25m");
  assert.equal(reducePanelState(goal, { type: "OPEN_REVIEW" }).activeView, "review");
});

test("updates a streamed assistant message without changing its position", () => {
  const withMessage = reducePanelState(initialPanelState, {
    type: "ADD_MESSAGE",
    message: { id: "assistant-1", role: "assistant", type: "text", content: "Đang" },
  });
  const updated = reducePanelState(withMessage, {
    type: "UPDATE_MESSAGE",
    id: "assistant-1",
    patch: { content: "Đang tư vấn cấu hình..." },
  });
  assert.equal(updated.messages.at(-1).content, "Đang tư vấn cấu hình...");
  assert.equal(updated.messages.length, withMessage.messages.length);
});

test("decodes the chat-backend SSE contract, including split chunks", async () => {
  const decoder = createSseDecoder();
  assert.deepEqual(decoder.push('event: chunk\ndata: {"text":"Xin ch'), []);
  assert.deepEqual(decoder.push('ào"}\n\n'), [{ kind: "delta", text: "Xin chào" }]);

  const response = new Response(
    'event: chunk\ndata: {"text":"Xin "}\n\nevent: done\ndata: {"sessionId":"demo","reply":"Xin chào","runId":"run-1"}\n\n',
    { headers: { "content-type": "text/event-stream" } },
  );
  const events = [];
  const result = await readChatStream(response, (event) => events.push(event));
  assert.deepEqual(events, [{ kind: "delta", text: "Xin " }, { kind: "final", text: "Xin chào" }]);
  assert.deepEqual(result, { reply: "Xin chào", streamed: true });
});

test("merges cumulative OpenClaw partials without duplicating visible text", () => {
  let visible = "";
  visible = mergeStreamText(visible, "Tôi đang");
  visible = mergeStreamText(visible, "Tôi đang tìm linh kiện");
  visible = mergeStreamText(visible, " phù hợp.");
  assert.equal(visible, "Tôi đang tìm linh kiện phù hợp.");
  assert.equal(mergeStreamText(visible, "Tôi đang tìm"), visible);
});

test("keeps chat streaming in the tab and the worker limited to DOM bridge transport", () => {
  const extensionRoot = path.resolve(__dirname, "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8"));
  const contentScript = fs.readFileSync(path.join(extensionRoot, "content-script.js"), "utf8");
  const background = fs.readFileSync(path.join(extensionRoot, "background.js"), "utf8");

  assert.deepEqual(manifest.permissions, ["activeTab", "storage", "tabs"]);
  assert.equal(manifest.host_permissions.includes("*://*.trycloudflare.com/*"), true);
  assert.equal(manifest.background.service_worker, "background.js");
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://phongvu.vn/buildpc*", "https://www.phongvu.vn/buildpc*", "http://127.0.0.1:8781/mock-buildpc"]);
  assert.deepEqual(manifest.web_accessible_resources, [{
    resources: ["panel.css"],
    matches: ["https://phongvu.vn/*", "https://www.phongvu.vn/*", "http://127.0.0.1:8781/*"]
  }]);
  assert.equal(contentScript.includes("fetch("), true);
  assert.equal(contentScript.includes("WebSocket"), false);
  assert.equal(contentScript.includes("BuildMateDemoData.demoComponent"), false);
  assert.equal(contentScript.includes("BUILDMATE_USER_INTENT"), true);
  assert.equal(background.includes("BUILDMATE_CHAT_MESSAGE"), false);
  assert.equal(background.includes("fetch("), false);
  assert.equal(background.includes("buildmate-dom-bridge"), true);
  assert.equal(background.includes("BUILDMATE_DOM_COMMAND"), true);
  assert.equal(contentScript.includes('command?.action === "remove_component"'), true);
});
