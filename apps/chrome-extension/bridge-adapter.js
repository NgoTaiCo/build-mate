(function () {
  function createBridgeAdapter({ onCommand }) {
    const seen = new Set();
    return {
      receive(command) {
        const validation = globalThis.BuildMateCommandPolicy.validateCommand(command);
        if (!validation.ok || seen.has(command?.id)) return { ok: false, reason: validation.ok ? "DUPLICATE" : validation.reason };
        seen.add(command.id);
        onCommand(command);
        return { ok: true };
      }
    };
  }

  globalThis.BuildMateBridgeAdapter = { createBridgeAdapter };
})();
