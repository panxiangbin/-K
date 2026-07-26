export const SESSION_INVALIDATED_EVENT = 'henan50k-session-invalidated';
export const MANUAL_RECOVERY_MARKER = '__henan50kManualRecoveryPending';

const ROOM_MISSING_MARKERS = ['房间不存在', '房间已经关闭', '房间已关闭'];
const CONTINUE_HIDE_GUARD_MS = 5000;

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

export function createRecoveryRequestTracker() {
  const attempts = new WeakMap();
  return {
    start(socket, attempt) {
      if (socket && attempt?.roomId) attempts.set(socket, { source: attempt.source, roomId: String(attempt.roomId) });
    },
    complete(socket) {
      if (socket) attempts.delete(socket);
    },
    reject(socket, message) {
      const attempt = socket ? attempts.get(socket) : null;
      if (socket) attempts.delete(socket);
      if (!attempt) return { matched: false, shouldClear: false };
      return {
        matched: true,
        shouldClear: isMissingRoomError(message),
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
