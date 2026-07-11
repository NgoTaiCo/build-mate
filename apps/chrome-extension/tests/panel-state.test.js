const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { isExactBuildPcUrl } = require("../shared/eligibility.js");
const { initialPanelState, reducePanelState } = require("../shared/panel-state.js");
const { initialActionState, reduceActionState } = require("../shared/action-state.js");
const { validateCommand } = require("../shared/command-policy.js");
const { snapshotKey } = require("../shared/snapshot.js");

test("only recognises the exact canonical Phong Vu Build PC URL", () => {
  assert.equal(isExactBuildPcUrl("https://phongvu.vn/buildpc"), true);
  assert.equal(isExactBuildPcUrl("https://phongvu.vn/buildpc?profile=1"), false);
  assert.equal(isExactBuildPcUrl("https://www.phongvu.vn/buildpc"), false);
  assert.equal(isExactBuildPcUrl("https://phongvu.vn/buildpc/anything"), false);
});

test("keeps demo add actions explicit and typed", () => {
  const started = reduceActionState(initialActionState, { type: "START" });
  assert.equal(started.status, "locating_category");
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
  assert.deepEqual(opened, { open: true, activeView: "welcome", selectedGoalId: null });
  assert.equal(reducePanelState(opened, { type: "CLOSE" }).open, false);
});

test("selects a local goal and enters review", () => {
  const goal = reducePanelState(initialPanelState, { type: "SELECT_GOAL", goalId: "gaming-25m" });
  assert.deepEqual(goal, { open: true, activeView: "goal", selectedGoalId: "gaming-25m" });
  assert.equal(reducePanelState(goal, { type: "OPEN_REVIEW" }).activeView, "review");
});

test("keeps the MV3 UI surface local-only", () => {
  const extensionRoot = path.resolve(__dirname, "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8"));
  const contentScript = fs.readFileSync(path.join(extensionRoot, "content-script.js"), "utf8");

  assert.deepEqual(manifest.permissions, ["activeTab"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.background, undefined);
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://phongvu.vn/buildpc"]);
  assert.deepEqual(manifest.web_accessible_resources, [{
    resources: ["panel.css"],
    matches: ["https://phongvu.vn/*", "https://www.phongvu.vn/*"]
  }]);
  assert.equal(contentScript.includes("fetch("), false);
  assert.equal(contentScript.includes("WebSocket"), false);
});
