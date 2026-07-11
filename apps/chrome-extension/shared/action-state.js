(function () {
  const initialActionState = Object.freeze({ status: "idle", errorCode: null, message: "Sẵn sàng thêm VGA demo." });
  const activeStatuses = new Set(["locating_category", "opening_modal", "waiting_products", "selecting_product", "verifying"]);

  function reduceActionState(state, event) {
    if (event.type === "START") return { status: "locating_category", errorCode: null, message: "Đang tìm category VGA…" };
    if (event.type === "STEP") return { status: event.status, errorCode: null, message: event.message };
    if (event.type === "SUCCESS") return { status: "success", errorCode: null, message: event.message || "Đã chọn VGA demo." };
    if (event.type === "UNVERIFIED") return { status: "unverified", errorCode: null, message: event.message || "Đã click chọn nhưng chưa xác minh được build." };
    if (event.type === "FAILED") return { status: "failed", errorCode: event.code, message: event.message };
    if (event.type === "CANCEL") return { status: "cancelled", errorCode: "CANCELLED", message: "Đã huỷ demo action." };
    if (event.type === "RESET") return initialActionState;
    return state;
  }

  globalThis.BuildMateActionState = { initialActionState, reduceActionState, activeStatuses };
  if (typeof module !== "undefined") module.exports = globalThis.BuildMateActionState;
})();
