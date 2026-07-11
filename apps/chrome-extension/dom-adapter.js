(function () {
  const SLOT_CATEGORY = {
    cpu: "cpu",
    mainboard: "mainboard",
    ram: "ram",
    hdd: "storage",
    ssd: "storage",
    gpu: "gpu",
    psu: "psu",
    case: "case",
    cooler: "cooler",
  };
  const LABELS = {
    cpu: ["Vi xử lý", "CPU"],
    mainboard: ["Bo mạch chủ", "Mainboard"],
    ram: ["Ram", "RAM"],
    hdd: ["Ổ HDD"],
    ssd: ["Ổ SSD"],
    gpu: ["VGA", "Card màn hình", "Card đồ họa"],
    psu: ["Nguồn", "PSU"],
    case: ["Vỏ case", "Case"],
    cooler: ["Tản nhiệt", "Cooler"],
  };
  const SLOTS = Object.keys(SLOT_CATEGORY);

  function text(element) {
    return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function click(element) {
    const init = { bubbles: true, cancelable: true, composed: true, button: 0, view: window };
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      const EventType = type.startsWith("pointer") ? PointerEvent : MouseEvent;
      element.dispatchEvent(new EventType(type, init));
    }
  }

  function waitFor(check, timeout = 6000) {
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const value = check();
        if (value || Date.now() - started >= timeout) {
          clearInterval(timer);
          resolve(value ?? null);
        }
      }, 100);
    });
  }

  function categoryAction(row) {
    return row?.querySelector('[data-build-action="open-category"]') ||
      [...(row?.querySelectorAll("button") ?? [])].find((button) => /^(Chọn|Select|Sửa|Edit)$/i.test(text(button))) || null;
  }

  function removeAction(row) {
    return row?.querySelector('[data-build-action="remove-component"]') ||
      [...(row?.querySelectorAll("button") ?? [])].find((button) => /^(Xóa|Remove)$/i.test(text(button))) || null;
  }

  function categoryRow(slot) {
    // Priority 1: Mock page với data-attributes
    const mock = document.querySelector(`[data-build-category="${slot}"]`);
    if (mock) return mock;

    // Priority 2: Real phongvu.vn - quét TẤT CẢ teko-col-8 containers
    const labels = LABELS[slot] ?? [];
    const cols = document.querySelectorAll('[class*="teko-col-8"]');
    let best = null;

    for (const col of cols) {
      for (const row of col.children) {
        const rowText = text(row);
        // A navigation item can also contain `VGA`; require the BuildPC action
        // itself, never merely any button in an ancestor.
        if (labels.some((label) => rowText.includes(label)) && rowText.length < 600) {
          const action = categoryAction(row);
          if (action && (!best || rowText.length < best.textLength)) {
            best = { row, textLength: rowText.length };
          }
        }
      }
    }

    if (best) return best.row;

    // Priority 3: Fallback - tìm leaf text element rồi đi lên parent
    for (const el of document.querySelectorAll("*")) {
      if (el.children.length > 0) continue;
      const elText = text(el);
      if (labels.some((label) => new RegExp(`^${label}$|^${label}\\s`, "i").test(elText))) {
        let parent = el;
        for (let i = 0; i < 6 && parent; i++) {
          if (categoryAction(parent)) {
            return parent;
          }
          parent = parent.parentElement;
        }
      }
    }

    return null;
  }

  function componentFromRow(row, slot) {
    const category = SLOT_CATEGORY[slot];
    // Priority 1: Mock page với data-attributes đầy đủ
    const vendorProductId = row.dataset.vendorProductId;
    if (vendorProductId) {
      return {
        sku: row.dataset.sku ?? vendorProductId,
        vendor_product_id: vendorProductId,
        name: row.dataset.selectedName ?? text(row),
        category,
      };
    }

    // Real BuildPC exposes the chosen item as a product link plus `SKU: n`.
    // Read those fields directly; category text and prices are never identity.
    const link = [...row.querySelectorAll("a[href]")].find((candidate) => {
      const href = candidate.href;
      return href.startsWith("https://phongvu.vn/") && href !== location.href;
    });
    if (!link) return null;
    const name = text(link);
    const rowText = text(row);
    const sku = rowText.match(/\bSKU\s*:\s*([A-Z0-9-]+)/i)?.[1] ??
      link.href.match(/--s(\d+)(?:$|[/?#])/i)?.[1] ?? null;
    if (!name || !sku) return null;
    return {
      sku,
      vendor_product_id: sku,
      name,
      category,
      ...(category === "storage" ? { buildpc_slot: slot } : {}),
      product_url: link.href,
    };
  }

  function readBuild() {
    const components = [];
    for (const slot of SLOTS) {
      const row = categoryRow(slot);
      if (!row) continue;
      const component = componentFromRow(row, slot);
      if (component) components.push(component);
    }

    const total = readEstimatedTotal();

    return {
      status: "ready",
      components,
      total,
      revision: JSON.stringify(components.map(c => c.vendor_product_id))
    };
  }

  function findModal() {
    // A mutation must rely on a semantic dialog. Emotion classes and dynamic
    // modal IDs remain useful in a probe report, but are not safe click targets.
    return [
      ...document.querySelectorAll('[data-product-modal], [role="dialog"], .teko-modal-content'),
    ].find((element) => element.getClientRects().length > 0) ?? null;
  }

  function moneyFrom(value) {
    const match = value.match(/(\d{1,3}(?:[.,\s]\d{3})+|\d+)\s*(?:đ|vnd)/i);
    return match ? Number(match[1].replace(/[^0-9]/g, "")) : null;
  }

  function readEstimatedTotal() {
    const direct = document.querySelector("#build-total") || document.querySelector("[data-build-total]");
    if (direct) return moneyFrom(text(direct));
    const label = totalLabelCandidates()[0];
    if (!label) return null;
    for (const candidate of [label, label.nextElementSibling, label.parentElement, label.parentElement?.parentElement]) {
      const amount = moneyFrom(text(candidate));
      if (amount !== null) return amount;
    }
    return null;
  }

  function totalLabelCandidates() {
    return [...document.querySelectorAll("*")]
      .filter((element) => {
        const value = text(element).toLowerCase();
        return /^chi phí dự tính\b/.test(value);
      })
      .sort((left, right) => text(left).length - text(right).length);
  }

  function inspectTotal() {
    return {
      value: readEstimatedTotal(),
      candidates: totalLabelCandidates().slice(0, 4).map((label) => ({
        label_text: text(label).slice(0, 240),
        sibling_text: text(label.nextElementSibling).slice(0, 240),
        parent_text: text(label.parentElement).slice(0, 240),
        grandparent_text: text(label.parentElement?.parentElement).slice(0, 240),
      })),
    };
  }

  function productContainer(node, { requireChooseButton = false } = {}) {
    let parent = node;
    for (let depth = 0; depth < 10 && parent; depth += 1, parent = parent.parentElement) {
      const hasProductLink = [...parent.querySelectorAll("a[href]")]
        .some((link) => link.href.startsWith("https://phongvu.vn/"));
      const hasChooseButton = [...parent.querySelectorAll("button")]
        .some((button) => /^(Chọn|Select)$/i.test(text(button)));
      const hasOutOfStockMarker = /liên\s+hệ/i.test(text(parent));
      if ((hasProductLink || /\bSKU\s*:/i.test(text(parent))) &&
        (requireChooseButton ? hasChooseButton : hasChooseButton || hasOutOfStockMarker)) {
        return parent;
      }
    }
    return null;
  }

  function selectableContainer(node) {
    return productContainer(node, { requireChooseButton: true });
  }

  function isOutOfStock(card) {
    return /liên\s+hệ/i.test(text(card));
  }

  function findFirstProduct(modal) {
    if (!modal) return null;

    // Priority 1: Mock page data-attribute
    const mockProduct = modal.querySelector("[data-vendor-product-id]");
    if (mockProduct) return mockProduct;

    // Priority 2: Stable text "Chọn" button (phongvu.vn real)
    for (const button of modal.querySelectorAll("button")) {
      const btnText = text(button);
      if (/^(Chọn|Select)$/i.test(btnText) && btnText.length < 12) {
        return selectableContainer(button) || button;
      }
    }

    // An all-out-of-stock result set has no "Chọn" button. It is still a
    // loaded product list and must reach the PRODUCT_OUT_OF_STOCK guard.
    for (const link of modal.querySelectorAll("a[href]")) {
      const card = productContainer(link);
      if (card) return card;
    }

    // Priority 3: Any clickable product card
    return modal.querySelector("[data-sku]") ||
      modal.querySelector("article") ||
      null;
  }

  async function openCategory(slot) {
    if (!SLOT_CATEGORY[slot]) return { ok: false, error: "INVALID_CATEGORY" };
    const row = categoryRow(slot);
    if (!row) return { ok: false, error: "CATEGORY_NOT_FOUND" };

    // Tìm nút: ưu tiên data-attribute, fallback text "Chọn" hoặc "Sửa"
    const openButton = categoryAction(row);

    if (!openButton) return { ok: false, error: "CATEGORY_BUTTON_NOT_FOUND" };
    click(openButton);
    const modal = await waitFor(findModal, 3000);
    return modal ? { ok: true, modal } : { ok: false, error: "MODAL_TIMEOUT" };
  }

  function findProduct(modal, vendorProductId) {
    if (!modal || !vendorProductId) return null;

    // Priority 1: Exact data-attribute match
    const escaped = vendorProductId.replace(/"/g, '\\"');
    const byAttr = modal.querySelector(`[data-vendor-product-id="${escaped}"]`) ||
      modal.querySelector(`[data-sku="${escaped}"]`);
    if (byAttr) return byAttr;

    // Priority 2: Link href contains the exact vendor identity.
    for (const link of modal.querySelectorAll("a[href]")) {
      if (link.href.includes(vendorProductId)) {
        const card = productContainer(link);
        if (card) return card;
      }
    }

    // Priority 3: an exact identity shown beside a selectable button.
    for (const button of modal.querySelectorAll("button")) {
      if (!/^(Chọn|Select)$/i.test(text(button))) continue;
      const card = selectableContainer(button);
      if (card && text(card).includes(vendorProductId)) return card;
    }

    return null;
  }

  function productSearchInput(modal) {
    return [...modal.querySelectorAll("input")].find((input) => {
      const hint = [input.type, input.name, input.placeholder, input.getAttribute("aria-label")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return input.type === "search" || /tìm\s*kiếm|tim\s*kiem|search/.test(hint);
    }) ?? null;
  }

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  async function searchProductById(modal, vendorProductId) {
    const input = productSearchInput(modal);
    if (!input) return false;
    input.focus();
    setInputValue(input, vendorProductId);
    return true;
  }

  function normalizeFilterLabel(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function findFilterLabel(modal, label) {
    const expected = normalizeFilterLabel(label);
    if (!expected) return null;
    return [...modal.querySelectorAll("*")]
      .filter((element) => element.getClientRects().length > 0 && normalizeFilterLabel(text(element)) === expected)
      .sort((left, right) => left.children.length - right.children.length)[0] ?? null;
  }

  async function applyFilterLabels(modal, labels) {
    let applied = false;
    for (const label of labels ?? []) {
      const filter = findFilterLabel(modal, label);
      if (!filter) continue;
      click(filter);
      applied = true;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return applied;
  }

  async function closeModal(modal) {
    const modalRoot = modal.closest('[id^="teko-modal-"]') ?? modal.parentElement ?? modal;
    const closeAction = [...modalRoot.querySelectorAll('button, [role="button"]')].find((element) => {
      const label = [element.getAttribute("aria-label"), element.getAttribute("title"), text(element)]
        .filter(Boolean)
        .join(" ");
      return /đóng|close|^×$|^x$/i.test(label);
    });
    if (closeAction) {
      click(closeAction);
    } else {
      // Phong Vu renders an unlabeled SVG close affordance at the top-right of
      // `.teko-modal-content`; the modal wrapper also contains the backdrop.
      const modalContent = modalRoot.querySelector(".teko-modal-content") ?? modalRoot;
      const bounds = modalContent.getBoundingClientRect();
      const closeIcon = [...modalContent.querySelectorAll("svg")].find((icon) => {
        const box = icon.getBoundingClientRect();
        return getComputedStyle(icon).cursor === "pointer" &&
          box.top <= bounds.top + 64 && box.right >= bounds.right - 64;
      }) ?? null;
      if (closeIcon) click(closeIcon);
    }
    if (await waitFor(() => !findModal(), 1000)) return true;

    const init = { key: "Escape", code: "Escape", bubbles: true, cancelable: true, composed: true };
    const target = document.activeElement instanceof HTMLElement ? document.activeElement : modal;
    for (const eventTarget of [target, modal]) {
      eventTarget.dispatchEvent(new KeyboardEvent("keydown", init));
      eventTarget.dispatchEvent(new KeyboardEvent("keyup", init));
    }
    if (await waitFor(() => !findModal(), 1000)) return true;

    // Teko modal accepts an outside click. Use the fixed overlay as a final
    // fallback when its close control does not expose accessible text.
    let overlay = modal.parentElement;
    for (let depth = 0; depth < 6 && overlay; depth += 1, overlay = overlay.parentElement) {
      if (getComputedStyle(overlay).position === "fixed") {
        click(overlay);
        break;
      }
    }
    return Boolean(await waitFor(() => !findModal(), 1500));
  }

  async function terminalFailure(modal, error) {
    return { ok: false, error, modal_closed: await closeModal(modal) };
  }

  async function addComponent(component) {
    if (!component || !SLOT_CATEGORY[component.category] && component.category !== "storage" || !component.vendor_product_id) {
      return { ok: false, error: "INVALID_COMPONENT" };
    }
    const slot = component.category === "storage" ? component.buildpc_slot : component.category;
    if (!SLOT_CATEGORY[slot]) return { ok: false, error: "STORAGE_SLOT_REQUIRED" };
    const current = componentFromRow(categoryRow(slot), slot);
    if (current && !component.replace_existing) {
      return { ok: false, error: "COMPONENT_ALREADY_SELECTED", current };
    }
    // A user may already have narrowed the correct category with a storefront
    // facet. Reuse that visible modal instead of resetting its filter state.
    let modal = findModal();
    if (!modal) {
      const opened = await openCategory(slot);
      if (!opened.ok) return opened;
      modal = findModal();
    }
    if (!modal) return { ok: false, error: "MODAL_TIMEOUT" };

    // KEY FIX: Đợi PRODUCT cards load (async), không chỉ modal shell
    const firstProduct = await waitFor(() => findFirstProduct(modal), 6000);
    if (!firstProduct) return terminalFailure(modal, "PRODUCT_LIST_TIMEOUT");

    // Search and facets may only narrow the list. Selection is still the exact
    // Catalog identity, so neither path can substitute a similar product.
    const searched = await searchProductById(modal, component.vendor_product_id);
    let card = await waitFor(
      () => findProduct(modal, component.vendor_product_id),
      searched ? 6000 : 300,
    );
    if (!card && await applyFilterLabels(modal, component.filter_labels)) {
      card = await waitFor(() => findProduct(modal, component.vendor_product_id), 6000);
    }
    if (!card) return terminalFailure(modal, "PRODUCT_NOT_FOUND");
    if (isOutOfStock(card)) return terminalFailure(modal, "PRODUCT_OUT_OF_STOCK");

    // Tìm nút "Chọn" trong card
    const choose = card.querySelector('[data-build-action="select-product"]') ||
      [...card.querySelectorAll("button")].find((button) => /^(Chọn|Select)$/i.test(text(button)));
    if (!choose) return terminalFailure(modal, "PRODUCT_BUTTON_NOT_FOUND");

    click(choose);

    // Verify component xuất hiện trong build
    const verified = await waitFor(() => {
      const snapshot = readBuild();
      return snapshot.components.some((item) =>
        item.vendor_product_id === component.vendor_product_id ||
        item.sku === component.sku
      );
    }, 4000);

    if (!verified) return { ok: false, error: "VERIFY_TIMEOUT" };
    return { ok: true, added: component, snapshot: readBuild() };
  }

  async function removeComponent(component, expectedRevision) {
    if (!component || (!SLOT_CATEGORY[component.category] && component.category !== "storage") || !component.vendor_product_id) {
      return { ok: false, error: "INVALID_COMPONENT" };
    }
    const slot = component.category === "storage" ? component.buildpc_slot : component.category;
    if (!SLOT_CATEGORY[slot]) return { ok: false, error: "STORAGE_SLOT_REQUIRED" };

    const before = readBuild();
    if (expectedRevision && before.revision !== expectedRevision) {
      return { ok: false, error: "REVERT_CONFLICT", snapshot: before };
    }

    const row = categoryRow(slot);
    const current = componentFromRow(row, slot);
    if (!current) return { ok: false, error: "COMPONENT_NOT_SELECTED", snapshot: before };
    if (current.vendor_product_id !== component.vendor_product_id) {
      return { ok: false, error: "REVERT_CONFLICT", current, snapshot: before };
    }

    const remove = removeAction(row);
    if (!remove) return { ok: false, error: "REMOVE_BUTTON_NOT_FOUND", current };
    click(remove);

    const verified = await waitFor(() => !readBuild().components.some((item) =>
      item.vendor_product_id === component.vendor_product_id || item.sku === component.sku
    ), 4000);
    if (!verified) return { ok: false, error: "REMOVE_VERIFY_TIMEOUT", current };
    return { ok: true, removed: current, snapshot: readBuild() };
  }

  function inspectCategory(slot) {
    const row = categoryRow(slot);
    if (!row) return { slot, category: SLOT_CATEGORY[slot] ?? null, ok: false, error: "CATEGORY_NOT_FOUND" };
    const action = categoryAction(row);
    return {
      slot,
      category: SLOT_CATEGORY[slot],
      ok: Boolean(action),
      row_text: text(row).slice(0, 240),
      action_text: action ? text(action) : null,
      action_aria_label: action?.getAttribute("aria-label") ?? null,
      error: action ? null : "CATEGORY_BUTTON_NOT_FOUND",
    };
  }

  globalThis.BuildMateDomAdapter = { addComponent, inspectCategory, inspectTotal, openCategory, readBuild, removeComponent };
})();
