'use strict';

const RECONNECT_BRANCH = `if (reconnecting) {
      clientInfo.playerId = reconnecting.id;`;

const GUARDED_RECONNECT_BRANCH = `if (reconnecting) {
      // 同一 WebSocket 已在该房间时，忽略客户端紧接着发来的重复 join_room。
      if (clientInfo.roomId === roomId && clientInfo.playerId === reconnecting.id) return;
      clientInfo.playerId = reconnecting.id;`;

function transformDuplicateJoinGuard(source) {
  const text = String(source || '');
  if (text.includes('忽略客户端紧接着发来的重复 join_room')) return text;
  if (!text.includes(RECONNECT_BRANCH)) {
    throw new Error('duplicate join guard could not find reconnect branch');
  }
  return text.replace(RECONNECT_BRANCH, GUARDED_RECONNECT_BRANCH);
}

module.exports = { transformDuplicateJoinGuard };
