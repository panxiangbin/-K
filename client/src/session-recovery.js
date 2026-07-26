export const SESSION_INVALIDATED_EVENT = 'henan50k-session-invalidated';
export const RECOVERY_STATUS_EVENT = 'henan50k-recovery-status';
export const MANUAL_RECOVERY_MARKER = '__henan50kManualRecoveryPending';
export const RECOVERY_TIMEOUT_MS = 12000;

const ROOM_MISSING_MARKERS = ['房间不存在', '房间已经关闭', '房间已关闭'];
const CONTINUE_HIDE_GUARD_MS = 5000;

const RECOVERY_STATUS_VIEWS = Object.freeze({
  auto_pending: { phase: 'pending', text: '正在自动恢复上次房间…', tone: 'info' },
  manual_pending: { phase: 'pending', text: '正在继续上次房间…', tone: 'info' },
  success: { phase: 'success', text: '房间已恢复，可以继续游戏。', tone: 'success' },
  invalidated: { phase: 'invalidated', text: '上次房间已经失效，旧的恢复记录已清理。', tone: 'warning' },
  retained: { phase: 'retained', text: '这次恢复没有成功，房间记录仍然保留，可以稍后重试。', tone: 'warning' },
  timeout: { phase: 'timeout', text: '恢复房间暂时没有响应，记录仍然保留，请检查网络后重试。', tone: 'warning' },
});

function isRecoveryJoin(message) {
  return Boolean(
    message
    && message.type === 'join_room'
    && message.roomId
    && message.playerId
    && message.playerToken
    && !String(message.playerName || '').trim()
  );
}

export function getRecoveryStatusView(status, source = 'auto') {
  const key = status === 'pending' ? `${source === 'manual' ? 'manual' : 'auto'}_pending` : status;
  return RECOVERY_STATUS_VIEWS[key] || RECOVERY_STATUS_VIEWS.retained;
}

export function publishRecoveryStatus({ status, source = 'auto', roomId = '', target = globalThis }) {
  const view = getRecoveryStatusView(status, source);
  const detail = { ...view, status, source, roomId: String(roomId || '') };
  if (typeof target?.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    target.dispatchEvent(new CustomEvent(RECOVERY_STATUS_EVENT, { detail }));
  }
  return detail;
}

export function installManualRecoverySourceMarker(target = globalThis) {
  const doc = target?.document;
  if (!doc?.addEventListener) return () => {};
  const onClick = (event) => {
    const button = event.target?.closest?.('button');
    if (!button || !String(button.textContent || '').includes('继续上次房间')) return;
    target[MANUAL_RECOVERY_MARKER] = true;
  };
  doc.addEventListener('click', onClick, true);
  return () => doc.removeEventListener('click', onClick, true);
}

export function getRecoveryAttempt(message, target = globalThis) {
  if (!isRecoveryJoin(message)) return null;
  const explicit = message.__recoverySource;
  const markedManual = Boolean(target?.[MANUAL_RECOVERY_MARKER]);
  if (markedManual) target[MANUAL_RECOVERY_MARKER] = false;
  return {
    source: explicit === 'manual' || markedManual ? 'manual' : 'auto',
    roomId: String(message.roomId),
  };
}

export function stripRecoveryMetadata(message) {
  if (!message || typeof message !== 'object' || !Object.prototype.hasOwnProperty.call(message, '__recoverySource')) return message;
  const { __recoverySource, ...wireMessage } = message;
  return wireMessage;
}

export function isMissingRoomError(message) {
  const text = String(message || '');
  return ROOM_MISSING_MARKERS.some((marker) => text.includes(marker));
}

export function createRecoveryRequestTracker({ target = globalThis, timeoutMs = RECOVERY_TIMEOUT_MS } = {}) {
  const attempts = new WeakMap();

  function clear(socket) {
    const attempt = socket ? attempts.get(socket) : null;
    if (attempt?.timer && typeof target?.clearTimeout === 'function') target.clearTimeout(attempt.timer);
    if (socket) attempts.delete(socket);
    return attempt;
  }

  return {
    start(socket, attempt) {
      if (!socket || !attempt?.roomId) return;
      clear(socket);
      const tracked = { source: attempt.source, roomId: String(attempt.roomId), timer: null };
      if (typeof target?.setTimeout === 'function') {
        tracked.timer = target.setTimeout(() => {
          if (attempts.get(socket) !== tracked) return;
          attempts.delete(socket);
          publishRecoveryStatus({ status: 'timeout', source: tracked.source, roomId: tracked.roomId, target });
        }, timeoutMs);
      }
      attempts.set(socket, tracked);
      publishRecoveryStatus({ status: 'pending', source: tracked.source, roomId: tracked.roomId, target });
    },
    complete(socket) {
      const attempt = clear(socket);
      if (attempt) publishRecoveryStatus({ status: 'success', source: attempt.source, roomId: attempt.roomId, target });
    },
    cancel(socket) {
      clear(socket);
    },
    reject(socket, message) {
      const attempt = clear(socket);
      if (!attempt) return { matched: false, shouldClear: false };
      const shouldClear = isMissingRoomError(message);
      publishRecoveryStatus({
        status: shouldClear ? 'invalidated' : 'retained',
        source: attempt.source,
        roomId: attempt.roomId,
        target,
      });
      return {
        matched: true,
        shouldClear,
        source: attempt.source,
        roomId: attempt.roomId,
      };
    },
  };
}

function hideContinueButtons(doc) {
  if (!doc?.querySelectorAll) return;
  for (const button of doc.querySelectorAll('button')) {
    if (String(button.textContent || '').includes('继续上次房间')) button.remove();
  }
}

function keepContinueHidden(target) {
  const doc = target?.document;
  const Observer = target?.MutationObserver;
  if (!doc?.body || typeof Observer !== 'function') return;
  const observer = new Observer(() => hideContinueButtons(doc));
  observer.observe(doc.body, { childList: true, subtree: true });
  const stop = () => observer.disconnect();
  if (typeof target?.setTimeout === 'function') target.setTimeout(stop, CONTINUE_HIDE_GUARD_MS);
}

export function invalidateSavedSession({ storage, roomId, target = globalThis, source = 'auto' }) {
  if (!storage || !roomId) return false;
  const targetRoomId = String(roomId);
  const lastRoomId = storage.getItem('henan50k:lastRoomId');
  if (lastRoomId !== targetRoomId) return false;

  storage.removeItem(`henan50k:${targetRoomId}:playerId`);
  storage.removeItem(`henan50k:${targetRoomId}:playerToken`);
  storage.removeItem('henan50k:lastRoomId');
  hideContinueButtons(target?.document);
  keepContinueHidden(target);

  if (typeof target?.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    target.dispatchEvent(new CustomEvent(SESSION_INVALIDATED_EVENT, {
      detail: { roomId: targetRoomId, source },
    }));
  }
  return true;
}
