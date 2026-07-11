(function () {
  function normalizeSnapshot(snapshot) {
    if (!snapshot || snapshot.status !== "ready") return { status: "unavailable", components: [], total: null };
    return {
      status: "ready",
      components: (snapshot.components || []).map((component) => ({ category: String(component.category || ""), name: String(component.name || "") })),
      total: snapshot.total ? String(snapshot.total) : null
    };
  }

  function snapshotKey(snapshot) {
    return JSON.stringify(normalizeSnapshot(snapshot));
  }

  globalThis.BuildMateSnapshot = { normalizeSnapshot, snapshotKey };
  if (typeof module !== "undefined") module.exports = globalThis.BuildMateSnapshot;
})();
