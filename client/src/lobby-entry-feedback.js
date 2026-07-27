const CONNECTION_EVENT = 'henan50k-connection-change';
const ENHANCED_ATTR = 'data-lobby-feedback-ready';
const STALLED_CONNECTION_DELAY = 18000;

let stalledTimer = null;
let lastConnected = false;

function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

function ensureFieldMessage(input, id) {
  if (!input) return null;
  let message = document.getElementById(id);
  if (!message) {
    message = document.createElement('p');
    message.id = id;
    message.className = 'lobby-inline-message';
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    input.closest('.lobby-field')?.appendChild(message);
  }
  const describedBy = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  describedBy.add(id);
  input.setAttribute('aria-describedby', [...describedBy].join(' '));
  return message;
}

function setFieldError(input, messageNode, message) {
  if (!input || !messageNode) return;
  const hasError = Boolean(message);
  input.setAttribute('aria-invalid', String(hasError));
  messageNode.classList.toggle('error', hasError);
  setText(messageNode, message);
}

function updateRoomIdGuidance(input, messageNode) {
  if (!input || !messageNode) return;
  const length = input.value.length;
  if (length === 0) {
    setFieldError(input, messageNode, '请输入朋友发来的6位房间号。');
  } else if (length < 6) {
    setFieldError(input, messageNode, `还差${6 - length}位数字。`);
  } else {
    setFieldError(input, messageNode, '');
  }
}

function ensureConnectionSummary(panel) {
  if (!panel) return null;
  let summary = panel.querySelector('.lobby-connection-summary');
  if (!summary) {
    summary = document.createElement('div');
    summary.className = 'lobby-connection-summary';
    summary.setAttribute('role', 'status');
    summary.setAttribute('aria-live', 'polite');
    summary.setAttribute('aria-atomic', 'true');

    const dot = document.createElement('span');
    dot.className = 'lobby-connection-dot';
    dot.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'lobby-connection-label';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'lobby-connection-retry';
    retry.textContent = '重新尝试';
    retry.hidden = true;
    retry.addEventListener('click', () => {
      if (!navigator.onLine) {
        updateConnectionSummary(summary, false, 'offline');
        return;
      }
      updateConnectionSummary(summary, false, 'retrying');
      window.dispatchEvent(new Event('online'));
      scheduleStalledState(summary);
    });
    summary.append(dot, label, retry);
    panel.prepend(summary);
  }
  return summary;
}

function clearStalledTimer() {
  if (!stalledTimer) return;
  clearTimeout(stalledTimer);
  stalledTimer = null;
}

function scheduleStalledState(summary) {
  clearStalledTimer();
  if (lastConnected || !navigator.onLine) return;
  stalledTimer = setTimeout(() => {
    stalledTimer = null;
    if (!lastConnected) updateConnectionSummary(summary, false, 'stalled');
  }, STALLED_CONNECTION_DELAY);
}

function updateConnectionSummary(summary, connected, phase = connected ? 'connected' : 'waking') {
  if (!summary) return;
  lastConnected = Boolean(connected);
  summary.dataset.phase = phase;
  summary.classList.toggle('connected', phase === 'connected');
  summary.classList.toggle('waking', phase === 'waking' || phase === 'retrying');
  summary.classList.toggle('stalled', phase === 'stalled' || phase === 'offline');

  const messages = {
    connected: '游戏服务器已连接',
    waking: '服务器正在启动，联网功能稍后可用',
    retrying: '正在重新连接游戏服务器…',
    stalled: '连接时间较长，可以继续等待或重新尝试',
    offline: '当前网络已断开，恢复网络后再试',
  };
  setText(summary.querySelector('.lobby-connection-label'), messages[phase] || messages.waking);
  const retry = summary.querySelector('.lobby-connection-retry');
  if (retry) retry.hidden = !(phase === 'stalled' || phase === 'offline');

  if (connected) clearStalledTimer();
  else if (phase === 'waking') scheduleStalledState(summary);
}

function updateBusyButtons(root) {
  root.querySelectorAll('button').forEach(button => {
    const busy = /中…|正在|请稍候/.test(button.textContent || '');
    if (button.getAttribute('aria-busy') !== String(busy)) {
      button.setAttribute('aria-busy', String(busy));
    }
    button.classList.toggle('is-busy', busy);
  });
}

function installViewportTracking(shell) {
  if (!shell || shell.dataset.viewportTracking === 'true') return;
  shell.dataset.viewportTracking = 'true';
  const viewport = window.visualViewport;
  if (!viewport) return;
  let keyboardWasOpen = false;

  const update = () => {
    const keyboardHeight = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    const keyboardOpen = keyboardHeight > 120;
    shell.style.setProperty('--lobby-viewport-height', `${Math.round(viewport.height)}px`);
    shell.dataset.keyboardOpen = String(keyboardOpen);

    if (keyboardOpen && !keyboardWasOpen) {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active?.closest?.('.lobby-panel')) active.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }
    if (!keyboardOpen && keyboardWasOpen) shell.scrollTo({ top: 0, behavior: 'auto' });
    keyboardWasOpen = keyboardOpen;
  };
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  update();
}

function enhanceLobby() {
  const shell = document.querySelector('.lobby-shell');
  if (!shell) return;
  installViewportTracking(shell);

  const panel = shell.querySelector('.lobby-panel');
  const summary = ensureConnectionSummary(panel);
  updateConnectionSummary(summary, Boolean(window.__henan50kConnected));

  const nameInput = shell.querySelector('#player-name');
  if (nameInput && nameInput.getAttribute(ENHANCED_ATTR) !== 'true') {
    nameInput.setAttribute(ENHANCED_ATTR, 'true');
    const message = ensureFieldMessage(nameInput, 'player-name-message');
    nameInput.addEventListener('input', () => setFieldError(nameInput, message, ''));
  }

  const roomInput = shell.querySelector('#room-id');
  if (roomInput && roomInput.getAttribute(ENHANCED_ATTR) !== 'true') {
    roomInput.setAttribute(ENHANCED_ATTR, 'true');
    const message = ensureFieldMessage(roomInput, 'room-id-message');
    roomInput.addEventListener('input', () => updateRoomIdGuidance(roomInput, message));
    roomInput.addEventListener('blur', () => updateRoomIdGuidance(roomInput, message));
    updateRoomIdGuidance(roomInput, message);
  }

  updateBusyButtons(shell);
}

export function installLobbyEntryFeedback() {
  let scheduled = false;
  const scheduleEnhance = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      enhanceLobby();
    });
  };

  document.addEventListener('click', event => {
    const button = event.target.closest?.('button');
    if (!button || !button.closest('.lobby-shell')) return;
    if (!/创建房间|加入房间/.test(button.textContent || '')) return;
    const input = document.getElementById('player-name');
    if (!input || input.value.trim()) return;
    const message = ensureFieldMessage(input, 'player-name-message');
    setFieldError(input, message, '请先填写昵称，再使用联网功能。');
    input.focus({ preventScroll: true });
    input.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, true);

  window.addEventListener(CONNECTION_EVENT, event => {
    window.__henan50kConnected = Boolean(event.detail?.connected);
    const summary = document.querySelector('.lobby-connection-summary');
    updateConnectionSummary(summary, window.__henan50kConnected);
  });

  window.addEventListener('offline', () => {
    updateConnectionSummary(document.querySelector('.lobby-connection-summary'), false, 'offline');
  });

  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  scheduleEnhance();
  return () => {
    clearStalledTimer();
    observer.disconnect();
  };
}