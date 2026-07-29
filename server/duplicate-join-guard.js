'use strict';

const RAW_RECONNECT_BRANCH = `if (reconnecting) {
      clientInfo.playerId = reconnecting.id;`;

const OPTIMIZED_RECONNECT_BRANCH = `if (reconnecting) {
        require('./solo-room-reconnect').cancelSoloRoomCleanup(roomId);`;

const GUARD_LINE = 'if (clientInfo.roomId === roomId && clientInfo.playerId === reconnecting.id) return;';

function insertGuard(text, needle, indentation) {
  const originalFirstStatement = needle.split('\n').at(-1).trimStart();
  return text.replace(needle, `if (reconnecting) {
${indentation}// 同一 WebSocket 已在该房间时，忽略客户端紧接着发来的重复 join_room。
${indentation}${GUARD_LINE}
${indentation}${originalFirstStatement}`);
}

function transformDuplicateJoinGuard(source) {
  const text = String(source || '');
  if (text.includes(GUARD_LINE)) return text;
  if (text.includes(OPTIMIZED_RECONNECT_BRANCH)) return insertGuard(text, OPTIMIZED_RECONNECT_BRANCH, '        ');
  if (text.includes(RAW_RECONNECT_BRANCH)) return insertGuard(text, RAW_RECONNECT_BRANCH, '      ');
  throw new Error('duplicate join guard could not find reconnect branch');
}

module.exports = { transformDuplicateJoinGuard };
