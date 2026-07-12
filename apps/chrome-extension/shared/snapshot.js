(function () {
  function parseVndAmount(value) {
    if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : null;
    if (typeof value !== "string") return null;
    const digits = value.replace(/[^0-9]/g, "");
    return digits ? Number(digits) : null;
  }

  function formatVnd(value) {
    const amount = parseVndAmount(value);
    return amount === null
      ? null
      : new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
          maximumFractionDigits: 0,
        }).format(amount);
  }

  function normalizeSnapshot(snapshot) {
    if (!snapshot || snapshot.status !== "ready") return { status: "unavailable", components: [], total: null };
    return {
      status: "ready",
      components: (snapshot.components || []).map((component) => ({ category: String(component.category || ""), name: String(component.name || "") })),
      total: parseVndAmount(snapshot.total)
    };
  }

  function snapshotKey(snapshot) {
    return JSON.stringify(normalizeSnapshot(snapshot));
  }

  globalThis.BuildMateSnapshot = { formatVnd, normalizeSnapshot, parseVndAmount, snapshotKey };
  if (typeof module !== "undefined") module.exports = globalThis.BuildMateSnapshot;
})();
