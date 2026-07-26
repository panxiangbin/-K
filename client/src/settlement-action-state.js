export const SETTLEMENT_ACTION_TIMEOUT_MS = 12000;

export function getSettlementActionState({
  connected = false,
  isHost = false,
  pendingAction = null,
  roomId = '',
  isSolo = false,
} = {}) {
  const busy = pendingAction === 'next_round' || pendingAction === 'copy_room';
  const canCopy = Boolean(roomId) && !isSolo && pendingAction !== 'copy_room';
  const canStartNextRound = connected && isHost && !busy;

  let nextRoundLabel = '继续下一局 →';
  let nextRoundHint = '';
  if (!connected) {
    nextRoundLabel = '等待重新连接';
    nextRoundHint = '网络恢复后才能开始下一局。';
  } else if (!isHost) {
    nextRoundLabel = '等待房主开始';
    nextRoundHint = '房主开始下一局后，结算页会自动更新。';
  } else if (pendingAction === 'next_round') {
    nextRoundLabel = '正在开始下一局…';
    nextRoundHint = '请求已经发送，请不要重复点击。';
  }

  let copyLabel = '复制房间号';
  if (pendingAction === 'copy_room') copyLabel = '复制中…';

  return {
    busy,
    canCopy,
    canStartNextRound,
    nextRoundLabel,
    nextRoundHint,
    copyLabel,
  };
}

export function getSettlementTimeoutMessage(action) {
  if (action === 'next_round') return '服务器暂时没有响应，下一局尚未开始，请检查连接后重试。';
  if (action === 'copy_room') return '复制没有完成，请长按房间号手动复制。';
  return '';
}
