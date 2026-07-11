(function () {
  const COMMAND_TYPES = new Set(["buildmate.ui.status", "buildmate.ui.suggest", "buildmate.build.request-add"]);
  const TARGET = Object.freeze({ origin: "https://phongvu.vn", path: "/buildpc" });

  function validateCommand(command, now = Date.now()) {
    if (!command || command.v !== 1 || typeof command.id !== "string" || !COMMAND_TYPES.has(command.type)) return { ok: false, reason: "INVALID_COMMAND" };
    if (command.tab?.origin !== TARGET.origin || command.tab?.path !== TARGET.path) return { ok: false, reason: "WRONG_TAB" };
    if (!Number.isFinite(command.expiresAt) || command.expiresAt <= now) return { ok: false, reason: "EXPIRED" };
    if (typeof command.payload?.message !== "string" || command.payload.message.length > 500) return { ok: false, reason: "INVALID_PAYLOAD" };
    if (command.type === "buildmate.build.request-add" && command.payload.category !== "VGA") return { ok: false, reason: "INVALID_CATEGORY" };
    return { ok: true };
  }

  globalThis.BuildMateCommandPolicy = { COMMAND_TYPES, TARGET, validateCommand };
  if (typeof module !== "undefined") module.exports = globalThis.BuildMateCommandPolicy;
})();
