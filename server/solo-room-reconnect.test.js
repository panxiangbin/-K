const assert = require('assert');
const {
  cancelSoloRoomCleanup,
  handleSoloDisconnect,
  hasOnlineHuman,
  scheduleSoloRoomCleanup,
} = require('./solo-room-reconnect');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const room = {
    id: '123456',
    mode: 'solo',
    players: [
      { id: 'human', isBot: false, isOnline: false, left: false },
      { id: 'bot', isBot: true, isOnline: true, left: false },
    ],
  };
  const rooms = new Map([[room.id, room]]);

  assert.strictEqual(hasOnlineHuman(room), false, '离线真人不应被视为在线');
  assert.strictEqual(scheduleSoloRoomCleanup(room, rooms, { graceMs: 1_000 }), true, '应成功安排延迟清理');
  assert.strictEqual(cancelSoloRoomCleanup(room.id), true, '重连时应能取消延迟清理');
  await delay(1_050);
  assert.strictEqual(rooms.has(room.id), true, '已取消的清理不得删除房间');

  scheduleSoloRoomCleanup(room, rooms, { graceMs: 1_000 });
  room.players[0].isOnline = true;
  await delay(1_050);
  assert.strictEqual(rooms.has(room.id), true, '清理触发前已重连的真人应保住房间');

  room.players[0].isOnline = false;
  scheduleSoloRoomCleanup(room, rooms, { graceMs: 1_000 });
  await delay(1_050);
  assert.strictEqual(rooms.has(room.id), false, '超过宽限期仍无人在线时应删除单机房');

  const manualRoom = { ...room, id: '654321' };
  rooms.set(manualRoom.id, manualRoom);
  assert.strictEqual(handleSoloDisconnect(manualRoom, rooms, true), true, '主动退出应立即处理房间');
  assert.strictEqual(rooms.has(manualRoom.id), false, '主动退出应立即删除单机房');

  assert.strictEqual(handleSoloDisconnect({ id: 'x', mode: 'online' }, rooms, false), false, '联机房不应进入单机清理逻辑');
  assert.throws(
    () => scheduleSoloRoomCleanup(room, null),
    /房间Map/,
    '无效房间容器应给出明确错误',
  );

  console.log('solo-room-reconnect tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
