(function () {
  const initialPanelState = Object.freeze({
    open: false,
    activeView: "chat",
    selectedGoalId: null,
    messages: [
      { id: "msg-welcome", role: "assistant", type: "welcome", content: "Chatbot đang theo dõi Build PC read-only. Chọn mục tiêu mẫu hoặc nhập yêu cầu của bạn dưới đây." }
    ]
  });

  function reducePanelState(state, event) {
    switch (event.type) {
      case "OPEN":
        return { ...state, open: true };
      case "CLOSE":
        return { ...state, open: false };
      case "TOGGLE":
        return { ...state, open: !state.open };
      case "SELECT_GOAL":
        return { ...state, open: true, selectedGoalId: event.goalId };
      case "OPEN_REVIEW":
        return { ...state, open: true, activeView: "review" };
      case "SHOW_WELCOME":
        return { ...state, open: true, activeView: "chat", selectedGoalId: null, messages: initialPanelState.messages };
      case "ADD_MESSAGE":
        return { ...state, messages: [...state.messages, event.message] };
      case "UPDATE_MESSAGE":
        return {
          ...state,
          messages: state.messages.map((message) =>
            message.id === event.id ? { ...message, ...event.patch } : message,
          ),
        };
      case "CLEAR_CHAT":
        return { ...state, messages: initialPanelState.messages };
      default:
        return state;
    }
  }

  globalThis.BuildMatePanelState = { initialPanelState, reducePanelState };
  if (typeof module !== "undefined") {
    module.exports = globalThis.BuildMatePanelState;
  }
})();
