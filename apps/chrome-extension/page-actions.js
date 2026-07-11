(function () {
  function text(element) {
    return (element?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function ensureExactPage() {
    return globalThis.BuildMateEligibility.isExactBuildPcUrl(location.href);
  }

  function findVgaRow(doc) {
    let best = null;
    for (const container of doc.querySelectorAll('[class*="teko-col-8"]')) {
      for (const row of container.children) {
        const rowText = text(row);
        if (/VGA|Card màn hình|Card đồ họa/i.test(rowText) && rowText.length < 240) {
          if (!best || rowText.length < best.text.length) best = { row, text: rowText };
        }
      }
    }
    if (best) return best.row;
    for (const element of doc.querySelectorAll("*")) {
      if (element.children.length > 0 || !/^(VGA|Card màn hình|Card đồ họa)$/i.test(text(element))) continue;
      let parent = element;
      for (let depth = 0; depth < 6 && parent; depth += 1, parent = parent.parentElement) {
        if (parent.querySelector?.("button")) return parent;
      }
    }
    return null;
  }

  function syntheticClick(element) {
    const init = { bubbles: true, cancelable: true, composed: true, button: 0, view: window };
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      const EventType = type.startsWith("pointer") ? PointerEvent : MouseEvent;
      element.dispatchEvent(new EventType(type, init));
    }
  }

  function waitFor(check, { timeout = 6000, signal } = {}) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (signal?.aborted) {
          clearInterval(timer);
          resolve({ cancelled: true });
          return;
        }
        const value = check();
        if (value) {
          clearInterval(timer);
          resolve({ value });
          return;
        }
        if (Date.now() - startedAt >= timeout) {
          clearInterval(timer);
          resolve({ timeout: true });
        }
      }, 150);
    });
  }

  function findProductButton(modal) {
    return Array.from(modal.querySelectorAll("button")).find((button) => /^(Chọn|Select)$/i.test(text(button))) || modal.querySelector("[data-product-id],[data-sku]") || null;
  }

  function findModal(doc) {
    return doc.querySelector('[role="dialog"]') || doc.querySelector('[id^="teko-modal-"]') || doc.querySelector('[class*="css-fa3kpy"]');
  }

  function diagnostics(doc) {
    const vgaRow = findVgaRow(doc);
    return { columns: doc.querySelectorAll('[class*="teko-col-8"]').length, vgaRow: Boolean(vgaRow), categoryButton: Boolean(vgaRow?.querySelector('button[aria-label="Chọn"]')), modal: Boolean(findModal(doc)) };
  }

  async function addFirstVga({ doc = document, signal, onStep = () => {} } = {}) {
    if (!ensureExactPage()) return { ok: false, code: "PAGE_CHANGED", message: "Bạn không còn ở đúng trang Build PC." };
    onStep("locating_category", "Đang tìm category VGA…");
    const row = findVgaRow(doc);
    if (!row) return { ok: false, code: "VGA_ROW_NOT_FOUND", message: "Không tìm thấy category VGA trên trang." };
    const categoryButton = row.querySelector('button[aria-label="Chọn"]') || Array.from(row.querySelectorAll("button")).find((button) => /^(Chọn|Select)$/i.test(text(button)));
    if (!categoryButton) return { ok: false, code: "CATEGORY_BUTTON_NOT_FOUND", message: "Không tìm thấy nút chọn VGA." };

    onStep("opening_modal", "Đang mở danh sách VGA…");
    syntheticClick(categoryButton);
    const modalResult = await waitFor(() => findModal(doc), { signal });
    if (modalResult.cancelled) return { ok: false, code: "CANCELLED", message: "Đã huỷ khi đang mở danh sách." };
    if (modalResult.timeout || !modalResult.value) return { ok: false, code: "MODAL_TIMEOUT", message: "Danh sách VGA không mở kịp." };
    if (!ensureExactPage()) return { ok: false, code: "PAGE_CHANGED", message: "Trang đã thay đổi khi đang chọn VGA." };

    onStep("waiting_products", "Đang chờ sản phẩm tải…");
    const productResult = await waitFor(() => findProductButton(modalResult.value), { signal });
    if (productResult.cancelled) return { ok: false, code: "CANCELLED", message: "Đã huỷ khi đang chờ sản phẩm." };
    if (productResult.timeout || !productResult.value) return { ok: false, code: "PRODUCT_TIMEOUT", message: "Danh sách chưa có sản phẩm có thể chọn." };
    if (!ensureExactPage()) return { ok: false, code: "PAGE_CHANGED", message: "Trang đã thay đổi khi đang chọn sản phẩm." };

    onStep("selecting_product", "Đang chọn VGA demo…");
    const before = text(row);
    syntheticClick(productResult.value);
    onStep("verifying", "Đang xác nhận thay đổi build…");
    const verification = await waitFor(() => text(row) !== before, { timeout: 4000, signal });
    if (verification.cancelled) return { ok: false, code: "CANCELLED", message: "Đã huỷ sau khi gửi thao tác chọn." };
    if (verification.timeout) return { ok: true, unverified: true, message: "Đã gửi thao tác chọn; chưa xác minh được UI build." };
    return { ok: true, message: "Đã chọn VGA demo vào Build PC." };
  }

  globalThis.BuildMatePageActions = { addFirstVga, diagnostics, findVgaRow, text };
})();
