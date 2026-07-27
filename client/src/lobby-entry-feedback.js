const CONNECTION_EVENT = 'henan50k-connection-change';
const ENHANCED_ATTR = 'data-lobby-feedback-ready';

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
    summary.append(dot, label);
    panel.prepend(summary);
  }
  return summary;
}

function updateConnectionSummary(summary, connected) {
  if (!summary) return;
  summary.classList.toggle('connected', connected);
  summary.classList.toggle('waking', !connected);
  setText(
    summary.querySelector('.lobby-connection-label'),
    connected ? '游戏服务器已连接' : '服务器正在启动，联网功能稍后可用',
  );
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

  const update = () => {
    const keyboardHeight = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    shell.style.setProperty('--lobby-viewport-height', `${Math.round(viewport.height)}px`);
    shell.dataset.keyboardOpen = String(keyboardHeight > 120);
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
  }, true);

  window.addEventListener(CONNECTION_EVENT, event => {
    window.__henan50kConnected = Boolean(event.detail?.connected);
    const summary = document.querySelector('.lobby-connection-summary');
    updateConnectionSummary(summary, window.__henan50kConnected);
  });

  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  scheduleEnhance();
  return () => observer.disconnect();
}
