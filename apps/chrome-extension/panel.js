(function () {
  const ROOT_ID = "buildmate-extension-root";
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]); }
  function ensureMounted() {
    const existing = document.getElementById(ROOT_ID); if (existing?.__buildMatePanel) return existing.__buildMatePanel;
    const host = document.createElement("div"); host.id = ROOT_ID; host.setAttribute("data-buildmate-owner", "extension"); const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<link rel="stylesheet" href="${chrome.runtime.getURL("panel.css")}">
      <button class="bm-launcher" type="button" aria-expanded="false" aria-controls="bm-panel" aria-label="${globalThis.BuildMateI18n.t('openAssistant')}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>${globalThis.BuildMateI18n.t('openAssistant')}</button>
      <aside id="bm-panel" class="bm-panel" data-open="false" aria-label="${globalThis.BuildMateI18n.t('panelTitle')}">
        <div class="bm-status-bar" id="bm-status-bar" data-connected="false"><span class="bm-status-dot"></span><span id="bm-status-text">${globalThis.BuildMateI18n.t('statusOffline')}</span></div>
        <div class="bm-panel-header">
          <h2 class="bm-title" tabindex="-1"><span class="bm-title-wrap" id="bm-panel-title">${globalThis.BuildMateI18n.t('panelTitle')}</span></h2>
          <div class="bm-header-actions">
            <button class="bm-icon-btn" type="button" id="bm-lang-toggle" aria-label="Switch language">${globalThis.BuildMateI18n.getLang() === 'vi' ? 'EN' : 'VI'}</button>
            <button class="bm-icon-btn" type="button" id="bm-clear-btn" aria-label="${globalThis.BuildMateI18n.t('clearChat')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg></button>
            <button class="bm-icon-btn bm-close" type="button" aria-label="${globalThis.BuildMateI18n.t('closePanel')}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
          </div>
        </div>
        <p class="bm-notice"></p>
        <div class="bm-view"></div>
      </aside>`;

    document.documentElement.appendChild(host);
    const launcher = shadow.querySelector(".bm-launcher"), panel = shadow.querySelector(".bm-panel"), notice = shadow.querySelector(".bm-notice"), view = shadow.querySelector(".bm-view"), title = shadow.querySelector(".bm-title");
    let state = { ...globalThis.BuildMatePanelState.initialPanelState }, actionState = { ...globalThis.BuildMateActionState.initialActionState }, snapshot = { status: "unavailable", components: [], total: null }, pendingAdd = false, isTyping = false, handlers = {};
    
    function snapshotMarkup() {
      const count = snapshot.components.length;
      if (snapshot.status !== "ready") return `<div class="bm-tracker bm-tracker--unavailable">${globalThis.BuildMateI18n.t('cartUnavailable')}</div>`;
      if (count === 0) return `<div class="bm-tracker bm-tracker--empty"><p class="bm-tracker-empty-text"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;margin-right:6px;vertical-align:middle"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>${globalThis.BuildMateI18n.t('cartEmpty')}</p></div>`;
      const names = snapshot.components.map((c) => `<li><span>${escapeHtml(c.category)}</span><strong>${escapeHtml(c.name)}</strong></li>`).join("");
      let totalHtml = "";
      if (snapshot.total) {
        const amountMatch = snapshot.total.match(/[\d.,]+[^\d.,]*/);
        const amountStr = amountMatch ? amountMatch[0].trim() : snapshot.total;
        totalHtml = `<div class="bm-tracker-total"><span>${globalThis.BuildMateI18n.t('totalCost')}</span><strong>${escapeHtml(amountStr)}</strong></div>`;
      }
      return `<section class="bm-tracker"><div class="bm-tracker-title"><span>${globalThis.BuildMateI18n.t('cartTitle')}</span>${count > 0 ? `<span class="bm-tracker-count">${count}</span>` : ""}</div><ul>${names}</ul>${totalHtml}</section>`;
    }
    function actionMarkup() {
      const i = globalThis.BuildMateI18n.t.bind(globalThis.BuildMateI18n);
      if (pendingAdd) return `<div class="bm-confirm"><strong>${i('confirmTitle')}</strong><p>${i('confirmBody')}</p><div><button class="bm-primary" type="button" data-action="confirm-add">${i('confirmBtn')}</button><button class="bm-back" type="button" data-action="cancel-add">${i('cancelBtn')}</button></div></div>`;
      if (actionState.status === "idle") return `<button class="bm-primary" type="button" data-action="prepare-add">${i('addVgaBtn')}</button>`;
      const busy = globalThis.BuildMateActionState.activeStatuses.has(actionState.status);
      let localizedMsg = i('action_' + actionState.status);
      if (actionState.errorCode) localizedMsg = i('error_' + actionState.errorCode);
      if (localizedMsg === ('action_' + actionState.status) || localizedMsg === ('error_' + actionState.errorCode)) localizedMsg = actionState.message; // fallback
      return `<div class="bm-action-status ${busy ? "bm-action-status--busy" : ""}" role="status" aria-live="polite"><strong>${escapeHtml(localizedMsg)}</strong>${actionState.errorCode ? `<span>${escapeHtml(actionState.errorCode)}</span>` : ""}${busy ? `<button class="bm-back" type="button" data-action="cancel-running">${i('cancelRunningBtn')}</button>` : `<button class="bm-back" type="button" data-action="reset-action">${i('revertBtn')}</button>`}</div>`;
    }
    
    function applyI18n() {
      const t = globalThis.BuildMateI18n.t.bind(globalThis.BuildMateI18n);
      launcher.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>${t('openAssistant')}`;
      launcher.setAttribute('aria-label', t('openAssistant'));
      panel.setAttribute('aria-label', t('panelTitle'));
      shadow.querySelector('#bm-panel-title').textContent = t('panelTitle');
      shadow.querySelector('#bm-status-text').textContent = t(snapshot.status === "ready" ? 'statusOnline' : 'statusOffline');
      shadow.querySelector('#bm-lang-toggle').innerHTML = globalThis.BuildMateI18n.getLang() === 'vi' ? 'EN' : 'VI';
      shadow.querySelector('#bm-clear-btn').setAttribute('aria-label', t('clearChat'));
      shadow.querySelector('.bm-close').setAttribute('aria-label', t('closePanel'));
      
      const form = shadow.querySelector('#bm-chat-form');
      if (form) {
        const input = form.querySelector('input');
        if (input) input.placeholder = t(globalThis.BuildMateActionState.activeStatuses.has(actionState.status) ? 'processing' : 'chatPlaceholder');
        const sendBtn = form.querySelector('button span:not(.bm-send-icon)');
        if (sendBtn) sendBtn.textContent = t('sendLabel');
      }
    }
    let lastRenderedState = null, lastRenderedActionState = null, lastRenderedSnapshot = null, lastRenderedPendingAdd = null, lastRenderedIsTyping = false;
    
    function scrollChat() {
      setTimeout(() => {
        const history = shadow.querySelector('#bm-chat-history');
        if (history) history.scrollTop = history.scrollHeight;
      }, 50);
    }
    function render({ focusPanel = false } = {}) { 
      panel.dataset.open = String(state.open); 
      launcher.setAttribute("aria-expanded", String(state.open)); 
      notice.style.display = "none"; 
      
      let layout = view.querySelector(".bm-chat-layout");
      if (!layout) {
        view.innerHTML = `
          <div class="bm-chat-layout">
            <div class="bm-chat-header-widget" id="bm-header-container"></div>
            <div class="bm-chat-history" id="bm-chat-history"></div>
            <form class="bm-chat-input" id="bm-chat-form">
              <input type="text" placeholder="Nhắn với BuildMate..." autocomplete="off">
              <button type="submit" aria-label="Gửi"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button>
            </form>
          </div>
        `;
        layout = view.querySelector(".bm-chat-layout");
      }

      const headerContainer = layout.querySelector('#bm-header-container');
      const historyContainer = layout.querySelector('#bm-chat-history');
      const form = layout.querySelector('#bm-chat-form');
      const input = form.querySelector('input');
      const submitBtn = form.querySelector('button');

      if (snapshot !== lastRenderedSnapshot) {
        headerContainer.innerHTML = snapshotMarkup();
        lastRenderedSnapshot = snapshot;
      }

      const shouldUpdateHistory = state.messages !== lastRenderedState?.messages || actionState !== lastRenderedActionState || pendingAdd !== lastRenderedPendingAdd || isTyping !== lastRenderedIsTyping;
      if (shouldUpdateHistory) {
        historyContainer.innerHTML = `
          ${state.messages.map(msg => {
            let contentHtml = '';
            if (msg.type === "welcome") {
              const goalIcons = {
                'gaming-25m': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>',
                'creator-30m': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>',
                'study-15m': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>'
              };
              const tGoals = globalThis.BuildMateI18n.t('goals');
              contentHtml = `<p class="bm-chat-text">${escapeHtml(globalThis.BuildMateI18n.t('welcome'))}</p><div class="bm-goals">${globalThis.BuildMateDemoData.goals.map((goal) => `<button class="bm-goal" type="button" data-goal-id="${escapeHtml(goal.id)}"><div class="bm-goal-icon">${goalIcons[goal.id] || ''}</div><div class="bm-goal-body"><strong>${escapeHtml(tGoals[goal.id].title)}</strong><span>${escapeHtml(tGoals[goal.id].budget)}</span></div></button>`).join("")}</div>`;
            } else if (msg.type === "action") {
              contentHtml = `<div class="bm-chat-widget">${actionMarkup()}</div>`;
            } else if (msg.type === "product_recommendation") {
              contentHtml = `<p class="bm-chat-text">${escapeHtml(msg.content)}</p>
                <div class="bm-product-card">
                  <div class="bm-product-image">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  </div>
                  <div class="bm-product-info">
                    <h4 class="bm-product-name">${escapeHtml(msg.product.name)}</h4>
                    <p class="bm-product-price">${escapeHtml(msg.product.price)}</p>
                    <div class="bm-product-actions">
                      <button type="button" class="bm-primary" data-mock-action="add-product" data-message-id="${escapeHtml(msg.id)}" ${msg.added ? 'disabled' : ''}>${msg.added ? globalThis.BuildMateI18n.t('addedSuccess') : globalThis.BuildMateI18n.t('addToConfig')}</button>
                    </div>
                  </div>
                </div>`;
            } else if (msg.type === "build_recommendation") {
              contentHtml = `<p class="bm-chat-text">${escapeHtml(msg.content)}</p>
                <div class="bm-build-card">
                  <div class="bm-build-header">
                    <div class="bm-build-header-title">${globalThis.BuildMateI18n.t('buildCardTitle')}</div>
                    <div class="bm-build-total">${escapeHtml(msg.build.total)}</div>
                  </div>
                  <div class="bm-build-list">
                    ${msg.build.components.map(c => `
                      <div class="bm-build-item">
                        <span class="bm-build-category">${escapeHtml(c.category)}</span>
                        <span class="bm-build-name">${escapeHtml(c.name)}</span>
                      </div>
                    `).join('')}
                  </div>
                  <div class="bm-build-actions">
                    <button type="button" class="bm-primary" data-mock-action="apply-build" data-message-id="${escapeHtml(msg.id)}" ${msg.added ? 'disabled' : ''}>${msg.added ? globalThis.BuildMateI18n.t('appliedBuild') : globalThis.BuildMateI18n.t('applyBuild')}</button>
                  </div>
                </div>`;
            } else {
              contentHtml = `<p class="bm-chat-text">${escapeHtml(msg.content)}</p>`;
            }
            const roleClass = msg.role === 'user' ? 'bm-message-user' : 'bm-message-bot';
            return `<div class="bm-chat-message ${roleClass}">${contentHtml}</div>`;
          }).join("")}
          ${isTyping ? '<div class="bm-typing"><span></span><span></span><span></span></div>' : ''}
        `;
        lastRenderedIsTyping = isTyping;
        scrollChat();
      }

      const busy = globalThis.BuildMateActionState.activeStatuses.has(actionState.status) || pendingAdd;
      if (busy) {
        input.disabled = true;
        submitBtn.disabled = true;
        input.placeholder = globalThis.BuildMateI18n.t('processing');
        form.classList.add('bm-chat-input--disabled');
      } else {
        input.disabled = false;
        submitBtn.disabled = false;
        input.placeholder = globalThis.BuildMateI18n.t('chatPlaceholder');
        form.classList.remove('bm-chat-input--disabled');
      }

      lastRenderedState = state;
      lastRenderedActionState = actionState;
      lastRenderedPendingAdd = pendingAdd;

      if (focusPanel && state.open && !busy) input.focus(); 
    }
    
    function transition(event, options) { const wasOpen = state.open; state = globalThis.BuildMatePanelState.reducePanelState(state, event); render({ focusPanel: options?.focusPanel ?? (!wasOpen && state.open) }); if (wasOpen && !state.open) launcher.focus(); return state; }
    
    launcher.addEventListener("click", () => transition({ type: "TOGGLE" }));
    shadow.querySelector(".bm-close").addEventListener("click", () => transition({ type: "CLOSE" }));
    shadow.querySelector('#bm-lang-toggle').addEventListener('click', () => {
      const next = globalThis.BuildMateI18n.getLang() === 'vi' ? 'en' : 'vi';
      globalThis.BuildMateI18n.setLang(next);
      isTyping = false;
      state = globalThis.BuildMatePanelState.reducePanelState(state, { type: "CLEAR_CHAT" });
      lastRenderedSnapshot = null;
      lastRenderedActionState = null;
      applyI18n();
      render();
    });
    shadow.querySelector('#bm-clear-btn').addEventListener('click', () => {
      isTyping = false;
      state = globalThis.BuildMatePanelState.reducePanelState(state, { type: "CLEAR_CHAT" });
      render();
    });
    panel.addEventListener("click", (event) => { 
      const button = event.target.closest("button"); if (!button) return; 
      if (button.dataset.goalId) {
        const goal = globalThis.BuildMateDemoData.goals.find(g => g.id === button.dataset.goalId);
        if (goal) {
          const tTitle = globalThis.BuildMateI18n.t('goals')[goal.id].title;
          transition({ type: "ADD_MESSAGE", message: { id: `msg-${Date.now()}`, role: 'user', type: 'text', content: globalThis.BuildMateI18n.getLang() === 'vi' ? `Tôi muốn ${tTitle.toLowerCase()}` : `I want to build for ${tTitle.toLowerCase()}` } });
          isTyping = true; render();
          setTimeout(() => { isTyping = false; transition({ type: "ADD_MESSAGE", message: { id: `msg-${Date.now()+1}`, role: 'assistant', type: 'action', content: '' } }); }, 900);
        }
      }
      if (button.dataset.action === "prepare-add") { pendingAdd = true; render(); } 
      if (button.dataset.action === "cancel-add") { pendingAdd = false; render(); } 
      if (button.dataset.action === "confirm-add") { pendingAdd = false; handlers.onRequestAdd?.(); render(); } 
      if (button.dataset.action === "cancel-running") handlers.onCancelAction?.(); 
      if (button.dataset.action === "reset-action") { actionState = { ...globalThis.BuildMateActionState.initialActionState }; render(); } 
      if (button.dataset.mockAction === "add-product" || button.dataset.mockAction === "apply-build") { 
        state = { ...state, messages: state.messages.map(m => m.id === button.dataset.messageId ? { ...m, added: true } : m) };
        render();
      }
    });
    
    panel.addEventListener("submit", (event) => { 
      event.preventDefault(); const form = event.target.closest("form"); 
      if (form && form.id === "bm-chat-form") { 
        const input = form.querySelector("input"); 
        if (input.value.trim()) { 
          const val = input.value.trim();
          input.value = "";
          transition({ type: "ADD_MESSAGE", message: { id: `msg-${Date.now()}`, role: 'user', type: 'text', content: val } });
          // Show typing indicator
          isTyping = true;
          render();
          const lowerVal = val.toLowerCase();
          function botReply(delay, msg) {
            setTimeout(() => {
              isTyping = false;
              transition({ type: "ADD_MESSAGE", message: msg });
            }, delay);
          }
          const triggers = globalThis.BuildMateI18n.t('triggers');
          const matchVga = triggers.vga.some(k => lowerVal.includes(k));
          const matchPeripheral = triggers.peripheral.some(k => lowerVal.includes(k));
          const matchFull = triggers.fullBuild.some(k => lowerVal.includes(k));
          if (matchVga) {
            botReply(800, { id: `msg-${Date.now()+1}`, role: 'assistant', type: 'action', content: '' });
          } else if (matchPeripheral) {
            botReply(1000, { 
              id: `msg-${Date.now()+1}`, role: 'assistant', type: 'product_recommendation', 
              content: globalThis.BuildMateI18n.t('peripheralReply'),
              product: { name: 'Logitech G102 Lightsync RGB', price: globalThis.BuildMateI18n.getLang() === 'en' ? '450,000 VND' : '450.000 đ' }
            });
          } else if (matchFull) {
            botReply(1200, { 
              id: `msg-${Date.now()+1}`, role: 'assistant', type: 'build_recommendation', 
              content: globalThis.BuildMateI18n.t('fullBuildReply'),
              build: { 
                total: globalThis.BuildMateI18n.getLang() === 'en' ? '15,490,000 VND' : '15.490.000 đ', 
                components: [
                  { category: 'CPU', name: 'Intel Core i5-12400F' },
                  { category: 'Mainboard', name: 'ASUS PRIME H610M-K D4' },
                  { category: 'RAM', name: 'Corsair Vengeance LPX 16GB' },
                  { category: 'VGA', name: 'ASUS Dual GeForce RTX 3060 12GB' }
                ]
              }
            });
          } else {
            const fallbacks = globalThis.BuildMateI18n.t('fallbacks');
            botReply(800, { id: `msg-${Date.now()+1}`, role: 'assistant', type: 'text', content: fallbacks[Math.floor(Math.random() * fallbacks.length)] });

          }

        } 
      } 
    });
    
    shadow.addEventListener("keydown", (event) => { if (event.key === "Escape" && state.open) { event.preventDefault(); transition({ type: "CLOSE" }); } });
    
    const api = { 
      toggle: () => transition({ type: "TOGGLE" }), 
      setHandlers: (next) => { handlers = next; }, 
      setAction: (event) => { actionState = globalThis.BuildMateActionState.reduceActionState(actionState, event); render(); }, 
      setSnapshot: (next) => { snapshot = next; render(); }, 
      applyBridgeCommand: (command) => { 
        if (command.type === "buildmate.ui.suggest") {
          transition({ type: "ADD_MESSAGE", message: { id: `msg-${Date.now()}`, role: 'assistant', type: 'text', content: command.payload.message } });
        }
        if (command.type === "buildmate.build.request-add") {
          pendingAdd = true; render(); 
        } 
      } 
    };
    host.__buildMatePanel = api; render(); return api;
  }
  globalThis.BuildMatePanel = { ensureMounted };
})();
