export const CONNECTION_PHASES = Object.freeze({
  CONNECTING: 'connecting',
  WAKING: 'waking',
  OFFLINE: 'offline',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed',
});

export function getConnectionStatusView(phase) {
  switch (phase) {
    case CONNECTION_PHASES.OFFLINE:
      return {
        text: '当前网络已断开，网络恢复后会自动重新连接。',
        tone: 'offline',
        retryable: false,
      };
    case CONNECTION_PHASES.RECONNECTING:
      return {
        text: '网络已恢复，正在重新连接游戏服务器…',
        tone: 'waking',
        retryable: true,
      };
    case CONNECTION_PHASES.FAILED:
      return {
        text: '连接没有成功，可以点“立即重试”。',
        tone: 'offline',
        retryable: true,
      };
    case CONNECTION_PHASES.WAKING:
      return {
        text: '服务器正在启动，首次打开可能需要稍等一会儿，页面会自动连接。',
        tone: 'waking',
        retryable: true,
      };
    case CONNECTION_PHASES.CONNECTING:
    default:
      return {
        text: '正在连接游戏服务器…',
        tone: 'waking',
        retryable: false,
      };
  }
}
