(function () {
  const initialActionState = Object.freeze({ status: "idle", errorCode: null, message: "Sẵn sàng thêm VGA demo.", component: null, revision: null });
  const activeStatuses = new Set(["locating_category", "opening_modal", "waiting_products", "selecting_product", "verifying", "reverting"]);

  function reduceActionState(state, event) {
    if (event.type === "START") return { status: "locating_category", errorCode: null, message: "Đang tìm category VGA…", component: null, revision: null };
    if (event.type === "REQUESTED") return { ...state, status: "requested", errorCode: null, message: event.message || "Đã gửi yêu cầu tới OpenClaw." };
    if (event.type === "STEP") return { status: event.status, errorCode: null, message: event.message };
    if (event.type === "SUCCESS") return { status: "success", errorCode: null, message: event.message || "Đã chọn VGA demo.", component: event.component ?? null, revision: event.revision ?? null };
    if (event.type === "REVERT_START") return { ...state, status: "reverting", errorCode: null, message: "Đang hoàn tác linh kiện…" };
    if (event.type === "REVERT_SUCCESS") return { status: "reverted", errorCode: null, message: event.message || "Đã hoàn tác linh kiện.", component: null, revision: null };
    if (event.type === "UNVERIFIED") return { status: "unverified", errorCode: null, message: event.message || "Đã click chọn nhưng chưa xác minh được build." };
    if (event.type === "FAILED") return { ...state, status: "failed", errorCode: event.code, message: event.message };
    if (event.type === "CANCEL") return { status: "cancelled", errorCode: "CANCELLED", message: "Đã huỷ demo action." };
    if (event.type === "RESET") return initialActionState;
    return state;
  }

  globalThis.BuildMateActionState = { initialActionState, reduceActionState, activeStatuses };
  if (typeof module !== "undefined") module.exports = globalThis.BuildMateActionState;
})();
