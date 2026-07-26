const ACTION_SELECTOR = '.btn-play, .btn-pass';
const CARD_SELECTOR = '[data-card-id]';
const CONNECTION_EVENT = 'henan50k-connection-change';
export const GAME_ACTION_TIMEOUT_MS = 12000;
export const SLIDE_THRESHOLD_PX = 10;

export function movedBeyondThreshold(start, current, threshold = SLIDE_THRESHOLD_PX) {
  if (!start || !current) return false;
  return Math.hypot(current.x - start.x, current.y - start.y) >= threshold;
}

export function actionBlocked({ connected, busy, disabled }) {
  return !connected || busy || disabled;
}

function ensureStatus(root = document) {
  let node = root.getElementById?.('henan50k-game-action-status');
  if (node) return node;
  node = root.createElement('div');
  node.id = 'henan50k-game-action-status';
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  node.setAttribute('aria-atomic', 'true');
  Object.assign(node.style, {
    position: 'fixed', left: '50%', bottom: 'max(76px, env(safe-area-inset-bottom))',
    transform: 'translateX(-50%)', zIndex: '1350', width: 'min(calc(100% - 28px), 420px)',
    padding: '9px 12px', borderRadius: '13px', background: 'rgba(15,23,42,.96)',
    border: '1px solid rgba(251,191,36,.42)', color: '#fef3c7', textAlign: 'center',
    fontSize: '13px', lineHeight: '1.45', boxShadow: '0 10px 28px rgba(0,0,0,.32)',
  });
  root.body.appendChild(node);
  return node;
}

function announce(text, root = document, duration = 2600) {
  const node = ensureStatus(root);
  node.textContent = text;
  clearTimeout(node.__hideTimer);
  node.__hideTimer = setTimeout(() => node.remove(), duration);
}

function tableSnapshot(root = document) {
  const cards = [...root.querySelectorAll(CARD_SELECTOR)].map((node) => node.getAttribute('data-card-id')).join('|');
  const header = root.querySelector('.game-table-header__turn')?.textContent || '';
  const trick = root.querySelector('.btn-play')?.closest('div')?.parentElement?.previousElementSibling?.textContent || '';
  return `${cards}::${header}::${trick}`;
}

export function installGameActionGuard(root = document) {
  if (globalThis.__henan50kGameActionGuardCleanup) return globalThis.__henan50kGameActionGuardCleanup;
  let busy = false;
  let busyTimer = null;
  let startSnapshot = '';
  let pointer = null;

  const connected = () => globalThis.__henan50kConnected === true;
  const clearBusy = () => {
    busy = false;
    startSnapshot = '';
    if (busyTimer) clearTimeout(busyTimer);
    busyTimer = null;
    root.querySelectorAll(`${ACTION_SELECTOR}[data-action-guard-busy="true"]`).forEach((button) => {
      button.removeAttribute('data-action-guard-busy');
      button.removeAttribute('aria-busy');
    });
  };

  const beginBusy = (button) => {
    busy = true;
    startSnapshot = tableSnapshot(root);
    button.setAttribute('data-action-guard-busy', 'true');
    button.setAttribute('aria-busy', 'true');
    busyTimer = setTimeout(() => {
      clearBusy();
      announce('服务器暂时没有确认这次操作，请检查网络后重试。', root, 4200);
    }, GAME_ACTION_TIMEOUT_MS);
  };

  const handleActionCapture = (event) => {
    const button = event.target?.closest?.(ACTION_SELECTOR);
    if (!button) return;
    if (actionBlocked({ connected: connected(), busy, disabled: button.disabled })) {
      event.preventDefault();
      event.stopImmediatePropagation();
      announce(!connected() ? '网络尚未恢复，出牌和过牌已暂停。' : '上一项操作正在确认，请不要重复点击。', root);
      return;
    }
    beginBusy(button);
  };

  const handlePointerDown = (event) => {
    if (!event.target?.closest?.(CARD_SELECTOR)) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false };
  };
  const handlePointerMove = (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!pointer.active && !movedBeyondThreshold(pointer, { x: event.clientX, y: event.clientY })) {
      event.stopPropagation();
      return;
    }
    pointer.active = true;
  };
  const endPointer = (event) => {
    if (!pointer || (event.pointerId != null && pointer.id !== event.pointerId)) return;
    pointer = null;
  };
  const handleConnection = (event) => {
    if (event.detail?.connected === false) {
      clearBusy();
      announce('网络连接已中断，本次操作未确认，请等待重连后再试。', root, 4200);
    }
  };

  const observer = new MutationObserver(() => {
    if (!busy) return;
    const next = tableSnapshot(root);
    if (next && startSnapshot && next !== startSnapshot) clearBusy();
  });

  root.addEventListener('click', handleActionCapture, true);
  root.addEventListener('pointerdown', handlePointerDown, true);
  root.addEventListener('pointermove', handlePointerMove, true);
  root.addEventListener('pointerup', endPointer, true);
  root.addEventListener('pointercancel', endPointer, true);
  globalThis.addEventListener?.(CONNECTION_EVENT, handleConnection);
  observer.observe(root.documentElement || root.body, { childList: true, subtree: true, characterData: true });

  const cleanup = () => {
    clearBusy();
    observer.disconnect();
    root.removeEventListener('click', handleActionCapture, true);
    root.removeEventListener('pointerdown', handlePointerDown, true);
    root.removeEventListener('pointermove', handlePointerMove, true);
    root.removeEventListener('pointerup', endPointer, true);
    root.removeEventListener('pointercancel', endPointer, true);
    globalThis.removeEventListener?.(CONNECTION_EVENT, handleConnection);
    delete globalThis.__henan50kGameActionGuardCleanup;
  };
  globalThis.__henan50kGameActionGuardCleanup = cleanup;
  return cleanup;
}
