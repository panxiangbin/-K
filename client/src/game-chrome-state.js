export function normalizePlayerName(name, fallback = '等待') {
  const text = String(name || '').trim();
  return text || fallback;
}

export function truncatePlayerName(name, maxLength = 8) {
  const text = normalizePlayerName(name, '等待');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

export function getGameChromeState({ page = 'lobby', connected = false } = {}) {
  const inGame = page === 'game';
  const inProtectedPage = inGame || page === 'settlement';
  return {
    inGame,
    inProtectedPage,
    showFloatingConnection: !inProtectedPage,
    showFloatingSound: true,
    connectionTone: connected ? 'online' : inProtectedPage ? 'reconnecting' : 'connecting',
  };
}

export function getTurnAnnouncement({ page = 'lobby', connected = false, isMyTurn = false, currentPlayerName = '' } = {}) {
  if (page !== 'game') return '';
  if (!connected) return '网络连接中断，牌桌操作已暂停，正在自动重连。';
  if (isMyTurn) return '轮到你出牌。';
  return `轮到${normalizePlayerName(currentPlayerName)}出牌。`;
}
