export const LOBBY_ACTION_TIMEOUT_MS = 12000;

const ACTION_LABELS = {
  continue: '继续上次房间',
  create: '创建房间',
  join: '进入房间',
  solo: '进入单机',
};

export function getLobbyActionState({ connected, pendingAction, action, valid = true }) {
  const label = ACTION_LABELS[action] || '提交';

  if (pendingAction) {
    return {
      disabled: true,
      label: pendingAction === action ? `${label}中…` : label,
      reason: pendingAction === action ? '请求已发送，请等待服务器响应。' : '另一个请求正在处理中，请稍候。',
    };
  }

  if (!connected) {
    return {
      disabled: true,
      label,
      reason: '游戏服务器尚未连接，请等待连接成功后再试。',
    };
  }

  if (!valid) {
    return {
      disabled: true,
      label,
      reason: action === 'join' ? '请输入完整的6位房间号。' : '请先补全必要信息。',
    };
  }

  return { disabled: false, label, reason: '' };
}

export function getLobbyActionStatus({ connected, pendingAction, timedOut = false }) {
  if (timedOut) return '服务器暂时没有响应，请检查连接后重试。';
  if (pendingAction) return '请求已发送，正在等待服务器响应，请不要重复点击。';
  if (!connected) return '服务器连接成功后即可创建、加入或开始单机。';
  return '';
}
