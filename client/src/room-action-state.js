export const ROOM_ACTION_TIMEOUT_MS = 12000;

export function getRoomActionState({
  action,
  connected,
  pendingAction = null,
  isHost = false,
  playerCount = 0,
  minimumPlayers = 3,
  roomStatus = 'waiting',
} = {}) {
  const pending = Boolean(pendingAction);
  const samePending = pendingAction === action;
  const waiting = roomStatus === 'waiting';

  if (action === 'start') {
    const unavailableReason = !connected
      ? '服务器尚未连接'
      : !waiting
        ? '对局已经开始'
        : !isHost
          ? '只有房主可以开始'
          : playerCount < minimumPlayers
            ? `至少需要 ${minimumPlayers} 名玩家`
            : null;

    return {
      disabled: pending || Boolean(unavailableReason),
      label: samePending ? '正在开始…' : '开始游戏',
      reason: samePending ? '开始请求处理中，请勿重复点击。' : unavailableReason,
    };
  }

  if (action === 'exit') {
    return {
      disabled: pending || !connected,
      label: samePending ? '正在退出…' : '退出房间',
      reason: samePending
        ? '退出请求处理中，请勿重复点击。'
        : !connected
          ? '服务器尚未连接，暂时不能安全退出房间。'
          : null,
    };
  }

  return { disabled: true, label: '暂不可用', reason: '未知操作。' };
}

export function getRoomActionStatus({ connected, pendingAction = null, timedOutAction = null } = {}) {
  if (timedOutAction === 'start') return '服务器暂时没有响应，游戏尚未开始，可以重新点击“开始游戏”。';
  if (timedOutAction === 'exit') return '服务器暂时没有确认退出，房间仍然保留，请检查连接后重试。';
  if (pendingAction === 'start') return '正在通知服务器开始游戏，请勿重复点击。';
  if (pendingAction === 'exit') return '正在等待服务器确认退出，确认前不会清空房间。';
  if (!connected) return '连接已断开，开始游戏和退出房间暂时不可用。';
  return '';
}
