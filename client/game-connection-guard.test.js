import assert from 'node:assert/strict';
import { getGameConnectionGuard, getGlobalConnectionLabel } from './src/game-connection-guard.js';

assert.deepEqual(getGameConnectionGuard({ connected: true, page: 'game' }), {
  active: false,
  title: '',
  message: '',
  liveText: '',
  canReturnLobby: false,
});

const gameGuard = getGameConnectionGuard({ connected: false, page: 'game' });
assert.equal(gameGuard.active, true);
assert.match(gameGuard.message, /不要重复出牌或过牌/);
assert.equal(gameGuard.canReturnLobby, true);

const settlementGuard = getGameConnectionGuard({ connected: false, page: 'settlement' });
assert.equal(settlementGuard.active, true);
assert.match(settlementGuard.message, /结算结果/);

assert.equal(getGameConnectionGuard({ connected: false, page: 'lobby' }).active, false);
assert.equal(getGlobalConnectionLabel(true, true), '在线');
assert.equal(getGlobalConnectionLabel(false, false), '连接中');
assert.equal(getGlobalConnectionLabel(false, true), '重连中');

console.log('game connection guard tests passed');
