export const GLOBAL_STATUS_CHANNELS = Object.freeze({
  CONNECTION: 'connection',
  RECOVERY: 'recovery',
  SERVER_ERROR: 'server-error',
});

export const GLOBAL_STATUS_PRIORITY = Object.freeze({
  RECOVERY_RESULT: 100,
  RECOVERY_PENDING: 150,
  CONNECTION_PROGRESS: 250,
  CONNECTION_FAILURE: 300,
  SERVER_ERROR: 400,
});

export function createGlobalStatusArbiter({
  render = () => {},
  clear = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = Date.now,
} = {}) {
  const entries = new Map();
  let sequence = 0;
  let expiryTimer = null;

  function cancelExpiryTimer() {
    if (expiryTimer == null) return;
    clearTimer(expiryTimer);
    expiryTimer = null;
  }

  function removeExpired(timestamp = now()) {
    for (const [channel, entry] of entries) {
      if (entry.expiresAt != null && entry.expiresAt <= timestamp) entries.delete(channel);
    }
  }

  function getActiveEntry(timestamp = now()) {
    removeExpired(timestamp);
    let active = null;
    for (const entry of entries.values()) {
      if (!active || entry.priority > active.priority || (entry.priority === active.priority && entry.sequence > active.sequence)) {
        active = entry;
      }
    }
    return active;
  }

  function scheduleNextExpiry(timestamp = now()) {
    cancelExpiryTimer();
    let nextExpiry = null;
    for (const entry of entries.values()) {
      if (entry.expiresAt == null) continue;
      if (nextExpiry == null || entry.expiresAt < nextExpiry) nextExpiry = entry.expiresAt;
    }
    if (nextExpiry == null) return;
    expiryTimer = setTimer(() => {
      expiryTimer = null;
      refresh();
    }, Math.max(0, nextExpiry - timestamp));
  }

  function refresh() {
    const timestamp = now();
    const active = getActiveEntry(timestamp);
    if (!active || active.visible === false) clear();
    else render(active.view, active);
    scheduleNextExpiry(timestamp);
    return active;
  }

  return {
    publish(channel, view, { priority = 0, duration = 0, visible = true } = {}) {
      if (!channel) return null;
      const timestamp = now();
      const normalizedDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
      entries.set(channel, {
        channel,
        view,
        priority,
        visible,
        sequence: ++sequence,
        expiresAt: normalizedDuration ? timestamp + normalizedDuration : null,
      });
      return refresh();
    },
    dismiss(channel) {
      if (!channel) return refresh();
      entries.delete(channel);
      return refresh();
    },
    reset() {
      entries.clear();
      cancelExpiryTimer();
      clear();
    },
    getActive() {
      return getActiveEntry();
    },
  };
}

let singleton = null;
let singletonTarget = null;

function ensureBanner(target) {
  const doc = target?.document;
  if (!doc?.body || typeof doc.createElement !== 'function') return null;
  let banner = doc.getElementById('henan50k-connection-status');
  if (banner) return banner;
  banner = doc.createElement('div');
  banner.id = 'henan50k-connection-status';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.setAttribute('aria-atomic', 'true');
  Object.assign(banner.style, {
    position: 'fixed', left: '50%', bottom: 'max(18px, env(safe-area-inset-bottom))',
    transform: 'translateX(-50%)', zIndex: '1200', width: 'min(calc(100% - 32px), 440px)',
    boxSizing: 'border-box', padding: '10px 12px', borderRadius: '14px',
    border: '1px solid rgba(251, 191, 36, 0.38)', background: 'rgba(30, 41, 59, 0.96)',
    color: '#f8fafc', boxShadow: '0 10px 28px rgba(0, 0, 0, 0.32)', backdropFilter: 'blur(10px)',
    fontSize: '13px', lineHeight: '1.45', textAlign: 'center', pointerEvents: 'auto',
  });
  doc.body.appendChild(banner);
  return banner;
}

function renderBanner(view, entry, target) {
  const banner = ensureBanner(target);
  if (!banner || !view) return;
  banner.replaceChildren();
  const text = target.document.createElement('span');
  text.textContent = view.text || '';
  banner.appendChild(text);
  if (view.retryable && typeof view.onRetry === 'function') {
    const button = target.document.createElement('button');
    button.type = 'button';
    button.textContent = '立即重试';
    button.setAttribute('aria-label', '立即重新连接游戏服务器');
    Object.assign(button.style, {
      marginLeft: '10px', minHeight: '36px', padding: '0 12px', borderRadius: '999px',
      border: '1px solid rgba(250, 204, 21, .55)', background: 'rgba(120, 53, 15, .72)',
      color: '#fef3c7', fontWeight: '800', cursor: 'pointer',
    });
    button.addEventListener('click', view.onRetry, { once: true });
    banner.appendChild(button);
  }
  banner.dataset.statusChannel = entry.channel;
  banner.style.borderColor = view.tone === 'success'
    ? 'rgba(74, 222, 128, 0.48)'
    : view.tone === 'offline' || view.tone === 'failed'
      ? 'rgba(248, 113, 113, 0.48)'
      : 'rgba(251, 191, 36, 0.48)';
  banner.style.color = view.tone === 'success'
    ? '#bbf7d0'
    : view.tone === 'offline' || view.tone === 'failed'
      ? '#fecaca'
      : '#fef3c7';
}

function getSingleton(target = globalThis) {
  if (singleton && singletonTarget === target) return singleton;
  singletonTarget = target;
  singleton = createGlobalStatusArbiter({
    render: (view, entry) => renderBanner(view, entry, target),
    clear: () => target?.document?.getElementById?.('henan50k-connection-status')?.remove(),
    setTimer: (...args) => target.setTimeout(...args),
    clearTimer: (...args) => target.clearTimeout(...args),
    now: () => Date.now(),
  });
  return singleton;
}

export function publishGlobalStatus(channel, view, options = {}, target = globalThis) {
  return getSingleton(target).publish(channel, view, options);
}

export function dismissGlobalStatus(channel, target = globalThis) {
  return getSingleton(target).dismiss(channel);
}

export function resetGlobalStatuses(target = globalThis) {
  getSingleton(target).reset();
}
