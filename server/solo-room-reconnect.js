const cleanupTimers = new Map();

const DEFAULT_GRACE_MS = 5 * 60 * 1000;
const MIN_GRACE_MS = 1_000;

function getGraceMs() {
  const configured = Number(process.env.SOLO_ROOM_RECONNECT_GRACE_MS);
  if (!Number.isFinite(configured) || configured < MIN_GRACE_MS) return DEFAULT_GRACE_MS;
  return configured;
}

function cancelSoloRoomCleanup(roomId) {
  const timer = cleanupTimers.get(roomId);
  if (!timer) return false;
  clearTimeout(timer);
  cleanupTimers.delete(roomId);
  return true;
}

function hasOnlineHuman(room) {
  return Boolean(room?.players?.some(player => !player.isBot && !player.left && player.isOnline));
}

function scheduleSoloRoomCleanup(room, rooms, options = {}) {
  if (!room || room.mode !== 'solo' || !room.id) return false;
  if (!rooms || typeof rooms.get !== 'function' || typeof rooms.delete !== 'function') {
    throw new TypeError('单机房清理需要可用的房间Map');
  }

  cancelSoloRoomCleanup(room.id);
  const graceMs = Number.isFinite(options.graceMs) ? Math.max(MIN_GRACE_MS, options.graceMs) : getGraceMs();
  const timer = setTimeout(() => {
    cleanupTimers.delete(room.id);
    if (rooms.get(room.id) !== room) return;
    if (hasOnlineHuman(room)) return;
    rooms.delete(room.id);
  }, graceMs);

  if (typeof timer.unref === 'function') timer.unref();
  cleanupTimers.set(room.id, timer);
  return true;
}

function handleSoloDisconnect(room, rooms, manual = false) {
  if (!room || room.mode !== 'solo') return false;
  if (manual) {
    cancelSoloRoomCleanup(room.id);
    rooms.delete(room.id);
    return true;
  }
  scheduleSoloRoomCleanup(room, rooms);
  return false;
}

module.exports = {
  cancelSoloRoomCleanup,
  handleSoloDisconnect,
  hasOnlineHuman,
  scheduleSoloRoomCleanup,
};
