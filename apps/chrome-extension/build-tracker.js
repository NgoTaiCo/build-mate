(function () {
  function text(element) {
    return (element?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function findBuildRoot(doc) {
    return Array.from(doc.querySelectorAll('[class*="teko-col-8"]')).find((container) => /VGA|Card màn hình|CPU|Mainboard/i.test(text(container))) || null;
  }

  function readSnapshot(doc = document) {
    const root = findBuildRoot(doc);
    if (!root) return { status: "unavailable", components: [], total: null };
    const components = [];
    for (const row of root.children) {
      const rowText = text(row);
      const label = ["CPU", "Mainboard", "RAM", "VGA", "Card màn hình", "SSD", "PSU", "Case", "Cooler"].find((category) => rowText.includes(category));
      if (!label || row.querySelector('button[aria-label="Chọn"]')) continue;
      components.push({ category: label, name: rowText.slice(0, 220) });
    }
    const totalNode = Array.from(doc.querySelectorAll("*")).find((node) => /^Tổng|Tạm tính/i.test(text(node)) && /đ|VND/i.test(text(node)));
    return { status: "ready", components, total: totalNode ? text(totalNode) : null };
  }

  function startBuildTracker({ doc = document, onSnapshot }) {
    let latestKey = "";
    let timer;
    const emit = () => {
      const snapshot = globalThis.BuildMateSnapshot.normalizeSnapshot(readSnapshot(doc));
      const key = globalThis.BuildMateSnapshot.snapshotKey(snapshot);
      if (key !== latestKey) {
        latestKey = key;
        onSnapshot({ ...snapshot, updatedAt: Date.now() });
      }
    };
    const observer = new MutationObserver((records) => {
      if (records.every((record) => record.target.closest?.("#buildmate-extension-root"))) return;
      clearTimeout(timer);
      timer = setTimeout(emit, 150);
    });
    observer.observe(doc.body, { subtree: true, childList: true, characterData: true });
    emit();
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }

  globalThis.BuildMateTracker = { readSnapshot, startBuildTracker };
})();
