(function () {
  const initialPanelState = Object.freeze({
    open: false,
    activeView: "welcome",
    selectedGoalId: null
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
        return { open: true, activeView: "goal", selectedGoalId: event.goalId };
      case "OPEN_REVIEW":
        return { ...state, open: true, activeView: "review" };
      case "SHOW_WELCOME":
        return { open: true, activeView: "welcome", selectedGoalId: null };
      default:
        return state;
    }
  }

  globalThis.BuildMatePanelState = { initialPanelState, reducePanelState };
  if (typeof module !== "undefined") {
    module.exports = globalThis.BuildMatePanelState;
  }
})();
