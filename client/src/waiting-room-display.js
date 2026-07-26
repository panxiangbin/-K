export const PLAYER_NAME_VISIBLE_LIMIT = 12;

export function formatPlayerName(name, { isSelf = false, limit = PLAYER_NAME_VISIBLE_LIMIT } = {}) {
  const normalized = String(name || '').trim() || '未命名玩家';
  const suffix = isSelf ? '（我）' : '';
  const available = Math.max(1, limit - suffix.length);
  const shortened = normalized.length > available
    ? `${normalized.slice(0, Math.max(1, available - 1))}…`
    : normalized;

  return {
    full: `${normalized}${suffix}`,
    visible: `${shortened}${suffix}`,
    truncated: normalized.length > available,
  };
}

export function getPresenceState(player) {
  if (player?.isBot) {
    return { label: '机器人', tone: 'bot', announced: '机器人玩家' };
  }
  if (player?.isOnline) {
    return { label: '在线', tone: 'online', announced: '在线' };
  }
  return { label: '离线', tone: 'offline', announced: '离线，等待重连' };
}

export function getRoomCopyState({ mode, roomId, copyState = 'idle' } = {}) {
  const copyable = mode !== 'solo' && Boolean(String(roomId || '').trim());
  if (!copyable) {
    return { visible: false, disabled: true, label: '', status: '' };
  }

  if (copyState === 'copying') {
    return { visible: true, disabled: true, label: '复制中…', status: '正在复制房间号。' };
  }
  if (copyState === 'success') {
    return { visible: true, disabled: false, label: '已复制', status: '房间号已复制，可以发给亲友。' };
  }
  if (copyState === 'error') {
    return { visible: true, disabled: false, label: '重新复制', status: '复制失败，请长按房间号手动复制。' };
  }
  return { visible: true, disabled: false, label: '复制房间号', status: '' };
}
