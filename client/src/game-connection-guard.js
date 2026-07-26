export function getGameConnectionGuard({ connected, page }) {
  const protectedPage = page === 'game' || page === 'settlement';
  if (!protectedPage || connected) {
    return {
      active: false,
      title: '',
      message: '',
      liveText: '',
      canReturnLobby: false,
    };
  }

  return {
    active: true,
    title: '网络连接已中断',
    message: page === 'settlement'
      ? '结算结果正在等待服务器恢复，连接成功后会自动同步。'
      : '牌桌操作已暂停，正在自动重新连接。请不要重复出牌或过牌。',
    liveText: '网络连接已中断，牌桌操作已暂停，正在自动重新连接。',
    canReturnLobby: true,
  };
}

export function getGlobalConnectionLabel(connected, protectedPage = false) {
  if (connected) return '在线';
  return protectedPage ? '重连中' : '连接中';
}
