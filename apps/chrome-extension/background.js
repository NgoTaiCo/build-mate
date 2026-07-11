chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: "BUILDMATE_TOGGLE_PANEL" }).catch(() => {
      // Ignore errors if the content script is not loaded
    });
  }
});
