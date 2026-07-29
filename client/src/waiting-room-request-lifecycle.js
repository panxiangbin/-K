const ROOM_SELECTOR = '.waiting-room-card';
const START_PATTERN = /开始游戏|开始中/;
const EXIT_PATTERN = /退出房间|退出中/;

export const WAITING_ROOM_REQUEST_TIMEOUT_MS = 12000;

const pendingRequests = new WeakMap();
const hostStates = new WeakMap();

export function getWaitingRequestFeedback({ kind = 'start', pending = false, timedOut = false, connected = true } = {}) {
  const action = kind === 'exit' ? '退出房间' : '开始游戏';
  if (!connected) {
    return { tone: 'recovering', title: '正在恢复服务器连接', detail: `连接恢复后，再重新${action}。`, showReconnect: true };
  }
  if (timedOut) {
    return { tone: 'timeout', title: `${action}等待时间较长`, detail: '请求可能没有送达，可以先重新连接服务器，再次操作。', showReconnect: true };
  }
  if (pending) {
    return { tone: 'busy', title: kind === 'exit' ? '正在退出房间' : '正在进入牌桌', detail: '请求已经发出，请勿重复点击。', showReconnect: false };
  }
  return null;
}

function findButton(panel, pattern) {
  return [...(panel?.querySelectorAll('button') || [])].find(button => pattern.test(button.textContent || '')) || null;
}

function ensureFeedback(panel) {
  let feedback = panel.querySelector('.waiting-request-feedback');
  if (feedback) return feedback;
  feedback = document.createElement('div');
  feedback.className = 'waiting-request-feedback';
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.setAttribute('aria-atomic', 'true');
  const exit = findButton(panel, EXIT_PATTERN);
  (exit || panel.lastElementChild)?.insertAdjacentElement('beforebegin', feedback);
  return feedback;
}

function feedbackKey(feedbackState) {
  if (!feedbackState) return 'hidden';
  return [feedbackState.tone, feedbackState.title, feedbackState.detail, feedbackState.showReconnect ? 'reconnect' : 'plain'].join('|');
}

function createReconnectButton() {
  const reconnect = document.createElement('button');
  reconnect.type = 'button';
  reconnect.className = 'waiting-request-reconnect';
  reconnect.textContent = '重新连接';
  reconnect.setAttribute('aria-label', '重新连接游戏服务器');
  reconnect.addEventListener('click', () => {
    reconnect.disabled = true;
    reconnect.setAttribute('aria-busy', 'true');
    reconnect.textContent = '连接中…';
    window.dispatchEvent(new CustomEvent('henan50k-reconnect-request'));
  }, { once: true });
  return reconnect;
}

function renderFeedback(panel, feedbackState) {
  const feedback = ensureFeedback(panel);
  const nextKey = feedbackKey(feedbackState);
  if (feedback.dataset.renderKey === nextKey) return;
  feedback.dataset.renderKey = nextKey;

  if (!feedbackState) {
    if (!feedback.hidden) feedback.hidden = true;
    if (feedback.childNodes.length) feedback.replaceChildren();
    if (feedback.hasAttribute('data-tone')) feedback.removeAttribute('data-tone');
    return;
  }

  if (feedback.hidden) feedback.hidden = false;
  if (feedback.dataset.tone !== feedbackState.tone) feedback.dataset.tone = feedbackState.tone;
  const title = document.createElement('strong');
  title.textContent = feedbackState.title;
  const detail = document.createElement('span');
  detail.textContent = feedbackState.detail;
  const children = [title, detail];
  if (feedbackState.showReconnect) children.push(createReconnectButton());
  feedback.replaceChildren(...children);
}

function isBusy(button, kind) {
  if (!button) return false;
  const text = button.textContent || '';
  return button.getAttribute('aria-busy') === 'true' || (kind === 'start' ? /开始中/.test(text) : /退出中/.test(text));
}

function clearPending(button) {
  const pending = pendingRequests.get(button);
  if (pending?.timer) window.clearTimeout(pending.timer);
  pendingRequests.delete(button);
  delete button.dataset.requestTimedOut;
}

function installButtonLifecycle(panel, button, kind) {
  if (!button || button.dataset.requestLifecycleInstalled === 'true') return;
  button.dataset.requestLifecycleInstalled = 'true';
  button.addEventListener('click', () => {
    if (button.disabled) return;
    clearPending(button);
    const startedAt = Date.now();
    button.dataset.requestKind = kind;
    button.dataset.requestStartedAt = String(startedAt);
    const timer = window.setTimeout(() => {
      if (!button.isConnected) return;
      button.dataset.requestTimedOut = 'true';
      renderFeedback(panel, getWaitingRequestFeedback({ kind, pending: false, timedOut: true, connected: Boolean(window.__henan50kConnected) }));
    }, WAITING_ROOM_REQUEST_TIMEOUT_MS);
    pendingRequests.set(button, { kind, startedAt, timer });
  });
}

function syncRequestState(panel, button, kind) {
  if (!button) return;
  const pending = pendingRequests.get(button);
  const timedOut = button.dataset.requestTimedOut === 'true';
  const busy = isBusy(button, kind) || Boolean(pending);
  if (pending && !isBusy(button, kind) && Date.now() - pending.startedAt > 500 && !timedOut) {
    clearPending(button);
    renderFeedback(panel, null);
    return;
  }
  renderFeedback(panel, getWaitingRequestFeedback({ kind, pending: busy && !timedOut, timedOut, connected: Boolean(window.__henan50kConnected) }));
}

function syncHostStatus(card, panel, startButton) {
  const isHost = Boolean(startButton);
  const previous = hostStates.get(card);
  hostStates.set(card, isHost);
  if (card.dataset.hostView !== (isHost ? 'host' : 'guest')) card.dataset.hostView = isHost ? 'host' : 'guest';
  if (previous === undefined || previous === isHost) return;
  let roleStatus = panel.querySelector('.waiting-role-status');
  if (!roleStatus) {
    roleStatus = document.createElement('div');
    roleStatus.className = 'waiting-role-status';
    roleStatus.setAttribute('role', 'status');
    roleStatus.setAttribute('aria-live', 'polite');
    roleStatus.setAttribute('aria-atomic', 'true');
    card.insertAdjacentElement('afterend', roleStatus);
  }
  const role = isHost ? 'host' : 'guest';
  if (roleStatus.dataset.role !== role) roleStatus.dataset.role = role;
  const text = isHost ? '你现在是房主，人员到齐后可以开始游戏。' : '房主已经变更，请等待新房主开始游戏。';
  if (roleStatus.textContent !== text) roleStatus.textContent = text;
}

function enhanceRoom(card) {
  const panel = card.closest('.lobby-panel');
  if (!panel) return;
  const start = findButton(panel, START_PATTERN);
  const exit = findButton(panel, EXIT_PATTERN);
  syncHostStatus(card, panel, start);
  installButtonLifecycle(panel, start, 'start');
  installButtonLifecycle(panel, exit, 'exit');
  if (start) syncRequestState(panel, start, 'start');
  if (exit) syncRequestState(panel, exit, 'exit');
}

function scan() {
  document.querySelectorAll(ROOM_SELECTOR).forEach(enhanceRoom);
}

export function installWaitingRoomRequestLifecycle() {
  scan();
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      scan();
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'aria-busy'] });
  window.addEventListener('henan50k-connection-change', schedule);
  return () => {
    observer.disconnect();
    window.removeEventListener('henan50k-connection-change', schedule);
  };
}
