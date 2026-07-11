(function () {
  const SLOTS = ["cpu", "mainboard", "ram", "hdd", "ssd", "gpu", "psu", "case", "cooler"];

  function text(element) {
    return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function describe(element) {
    if (!element) return null;
    const data = {};
    for (const [key, value] of Object.entries(element.dataset)) data[key] = value;
    return {
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute("role"),
      aria_label: element.getAttribute("aria-label"),
      href: element instanceof HTMLAnchorElement ? element.href : null,
      data,
      text: text(element).slice(0, 180),
    };
  }

  function findVisibleModal() {
    return [...document.querySelectorAll('[role="dialog"], [id^="teko-modal-"], .teko-modal-content')]
      .find((element) => element.getClientRects().length > 0) ?? null;
  }

  function modalCandidates() {
    const candidates = [];
    for (const element of overlayElements()) {
      const className = typeof element.className === "string" ? element.className : "";
      candidates.push({ ...describe(element), diagnostic_class: className.slice(0, 180) });
      if (candidates.length === 12) break;
    }
    return candidates;
  }

  function closeDiagnostics(modal) {
    if (!modal) return { root: null, actions: [], ancestors: [] };
    const root = modal.closest('[id^="teko-modal-"]') ?? modal.parentElement ?? modal;
    const actions = [...root.querySelectorAll('button, [role="button"]')]
      .slice(0, 20)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: text(element).slice(0, 80),
        aria_label: element.getAttribute("aria-label"),
        title: element.getAttribute("title"),
        class_name: typeof element.className === "string" ? element.className.slice(0, 120) : "",
      }));
    const ancestors = [];
    let current = modal;
    for (let depth = 0; depth < 6 && current; depth += 1, current = current.parentElement) {
      const style = getComputedStyle(current);
      ancestors.push({
        depth,
        tag: current.tagName.toLowerCase(),
        class_name: typeof current.className === "string" ? current.className.slice(0, 120) : "",
        position: style.position,
        z_index: style.zIndex,
        text: text(current).slice(0, 120),
      });
    }
    const heading = [...modal.querySelectorAll("*")]
      .find((element) => element.children.length === 0 && /^chọn linh kiện$/i.test(text(element))) ?? null;
    const header = heading?.parentElement ?? null;
    const header_children = [...(header?.children ?? [])].slice(0, 12).map((element) => ({
      tag: element.tagName.toLowerCase(),
      text: text(element).slice(0, 80),
      class_name: typeof element.className === "string" ? element.className.slice(0, 120) : "",
      aria_label: element.getAttribute("aria-label"),
      title: element.getAttribute("title"),
      svg_count: element.querySelectorAll("svg").length,
    }));
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        left: Math.round(box.left), top: Math.round(box.top),
        right: Math.round(box.right), bottom: Math.round(box.bottom),
        cursor: style.cursor, position: style.position,
      };
    };
    const root_children = [...root.children].slice(0, 16).map((element) => ({
      tag: element.tagName.toLowerCase(),
      text: text(element).slice(0, 80),
      class_name: typeof element.className === "string" ? element.className.slice(0, 120) : "",
      svg_count: element.querySelectorAll("svg").length,
      rect: rect(element),
    }));
    const icons = [...root.querySelectorAll("svg")].slice(0, 16).map((icon) => ({
      class_name: typeof icon.className === "string" ? icon.className.slice(0, 120) : "",
      view_box: icon.getAttribute("viewBox"),
      parent: {
        tag: icon.parentElement?.tagName.toLowerCase() ?? null,
        text: text(icon.parentElement).slice(0, 80),
        class_name: typeof icon.parentElement?.className === "string" ? icon.parentElement.className.slice(0, 120) : "",
        aria_label: icon.parentElement?.getAttribute("aria-label") ?? null,
        title: icon.parentElement?.getAttribute("title") ?? null,
      },
      rect: rect(icon),
      parent_rect: icon.parentElement ? rect(icon.parentElement) : null,
    }));
    return { root: describe(root), actions, ancestors, header_children, root_children, icons };
  }

  function overlayElements() {
    const candidates = [];
    for (const element of document.querySelectorAll("body *")) {
      if (element.getClientRects().length === 0) continue;
      const className = typeof element.className === "string" ? element.className : "";
      const style = getComputedStyle(element);
      const looksLikeOverlay = element.getAttribute("role") === "dialog" ||
        /modal|dialog|drawer|overlay/i.test(className) ||
        (style.position === "fixed" && Number(style.zIndex || 0) > 100);
      if (!looksLikeOverlay) continue;
      candidates.push(element);
      if (candidates.length === 12) break;
    }
    return candidates;
  }

  function productEvidence(modal) {
    if (!modal) return { choose_buttons: 0, product_cards: 0, identities: [] };
    const chooseButtons = [...modal.querySelectorAll("button")]
      .filter((button) => /^(Chọn|Select)$/i.test(text(button)));
    const cards = [...new Set([
      ...chooseButtons.map((button) => productCard(button)),
      ...[...modal.querySelectorAll("a[href]")].map((link) => productCard(link)),
    ])].filter(Boolean);
    const identities = [];
    for (const card of cards.slice(0, 8)) {
      if (!card) continue;
      const link = card.querySelector("a[href]");
      const image = card.querySelector("img");
      const sku = text(card).match(/\bSKU\s*:\s*([A-Z0-9-]+)/i)?.[1] ??
        link?.href.match(/--s(\d+)(?:$|[/?#])/i)?.[1] ?? null;
      if (!sku) continue;
      identities.push({
        data_sku: card.getAttribute("data-sku"),
        data_product_id: card.getAttribute("data-product-id"),
        observed_sku: sku,
        href: link?.href ?? null,
        in_stock: !/liên\s+hệ/i.test(text(card)),
        image: image ? {
          // Keep both the DOM attribute and browser-resolved URL. Lazy-loaded
          // storefront images often only populate one of these fields.
          src: image.getAttribute("src"),
          current_src: image.currentSrc || null,
          lazy_src: image.getAttribute("data-src") || image.getAttribute("data-original"),
          complete: image.complete,
          natural_width: image.naturalWidth,
          natural_height: image.naturalHeight,
          loaded: image.complete && image.naturalWidth > 0,
        } : null,
        text: text(card).slice(0, 160),
      });
    }
    return { choose_buttons: chooseButtons.length, product_cards: identities.length, identities };
  }

  function productCard(button) {
    let parent = button;
    for (let depth = 0; depth < 10 && parent; depth += 1, parent = parent.parentElement) {
      const hasProductLink = [...parent.querySelectorAll("a[href]")]
        .some((link) => link.href.startsWith("https://phongvu.vn/"));
      const hasChooseButton = [...parent.querySelectorAll("button")]
        .some((candidate) => /^(Chọn|Select)$/i.test(text(candidate)));
      const hasOutOfStockMarker = /liên\s+hệ/i.test(text(parent));
      if ((hasProductLink || /\bSKU\s*:/i.test(text(parent))) && (hasChooseButton || hasOutOfStockMarker)) return parent;
    }
    return button.parentElement;
  }

  function pageReport() {
    const categories = Object.fromEntries(SLOTS.map((slot) => [slot, globalThis.BuildMateDomAdapter.inspectCategory(slot)]));
    const passed = Object.values(categories).filter((entry) => entry.ok).length;
    return {
      version: 1,
      kind: "buildmate.dom.page-probe",
      captured_at: new Date().toISOString(),
      page: { origin: location.origin, path: location.pathname },
      category_contract: categories,
      checks: {
        category_actions_found: `${passed}/${SLOTS.length}`,
        build_snapshot: globalThis.BuildMateDomAdapter.readBuild(),
        estimated_total: globalThis.BuildMateDomAdapter.inspectTotal(),
      },
    };
  }

  async function categoryReport(category) {
    const page = pageReport();
    const opened = await globalThis.BuildMateDomAdapter.openCategory(category);
    const modal = opened.ok ? findVisibleModal() : null;
    return {
      ...page,
      kind: "buildmate.dom.category-probe",
      requested_category: category,
      open_result: opened.ok ? { ok: true } : opened,
      modal_contract: {
        visible: Boolean(modal),
        element: describe(modal),
        products: productEvidence(modal),
      },
    };
  }

  function modalReport() {
    const modal = findVisibleModal();
    const diagnosticModal = modal ?? overlayElements()[0] ?? null;
    return {
      ...pageReport(),
      kind: "buildmate.dom.modal-probe",
      modal_contract: {
        visible: Boolean(modal),
        semantic_element: describe(modal),
        diagnostic_candidates: modalCandidates(),
        close_diagnostics: closeDiagnostics(diagnosticModal),
        products: productEvidence(diagnosticModal),
      },
    };
  }

  globalThis.BuildMateDomProbe = { categoryReport, modalReport, pageReport };
})();
