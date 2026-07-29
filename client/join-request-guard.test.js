import assert from 'node:assert/strict';
import { createJoinRequestGuard } from './src/join-request-guard.js';

let time = 1000;
const guard = createJoinRequestGuard({ cooldownMs: 3000, now: () => time });
const socketA = {};
const socketB = {};
const join = {
  type: 'join_room',
  roomId: '123456',
  playerId: 'p1',
  playerToken: 'token-1',
  playerName: '',
};

assert.equal(guard.tryStart(socketA, join), true, 'first join should be sent');
assert.equal(guard.tryStart(socketA, join), false, 'duplicate join on same connection should be suppressed');
assert.equal(guard.tryStart(socketB, join), true, 'new WebSocket connection must be allowed to rejoin');

guard.clear(socketB);
assert.equal(guard.tryStart(socketB, join), false, '刚收到入房成功后，同一连接的自动重复join_room必须被吞掉');
assert.equal(guard.tryStart(socketA, join), true, '其他连接不受最近入房冷却影响');

time += 3001;
assert.equal(guard.tryStart(socketB, join), true, '冷却结束后，真实断线恢复请求必须可重试');

const otherRoom = { ...join, roomId: '654321' };
time += 3001;
assert.equal(guard.tryStart(socketB, otherRoom), true, '冷却结束后可以加入不同房间');
assert.equal(guard.tryStart(socketB, { type: 'play_cards' }), true, 'non-join messages are never suppressed');

console.log('join request guard tests passed');
