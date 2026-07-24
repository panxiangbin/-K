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
assert.equal(guard.tryStart(socketB, join), true, 'server reply should clear the in-flight join');

time += 3001;
assert.equal(guard.tryStart(socketB, join), true, 'timed-out join should be retryable');

const otherRoom = { ...join, roomId: '654321' };
assert.equal(guard.tryStart(socketB, otherRoom), true, 'different room join must not be blocked');
assert.equal(guard.tryStart(socketB, { type: 'play_cards' }), true, 'non-join messages are never suppressed');

console.log('join request guard tests passed');
