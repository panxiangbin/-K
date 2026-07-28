import assert from 'node:assert/strict';
import { getGameChromeState, getTurnAnnouncement, normalizePlayerName, truncatePlayerName } from './src/game-chrome-state.js';

assert.equal(normalizePlayerName('  小潘  '), '小潘');
assert.equal(normalizePlayerName('', '未知玩家'), '未知玩家');
assert.equal(truncatePlayerName('非常非常长的玩家昵称', 6), '非常非常长…');
assert.equal(truncatePlayerName('小潘', 6), '小潘');

assert.deepEqual(getGameChromeState({ page: 'lobby', connected: false }), {
  inGame: false,
  inProtectedPage: false,
  showFloatingConnection: true,
  showFloatingSound: true,
  connectionTone: 'connecting',
});

assert.deepEqual(getGameChromeState({ page: 'game', connected: true }), {
  inGame: true,
  inProtectedPage: true,
  showFloatingConnection: false,
  showFloatingSound: true,
  connectionTone: 'online',
});

assert.deepEqual(getGameChromeState({ page: 'settlement', connected: false }), {
  inGame: false,
  inProtectedPage: true,
  showFloatingConnection: false,
  showFloatingSound: true,
  connectionTone: 'reconnecting',
});

assert.equal(getTurnAnnouncement({ page: 'lobby', connected: true, isMyTurn: true }), '');
assert.equal(getTurnAnnouncement({ page: 'game', connected: false }), '网络连接中断，牌桌操作已暂停，正在自动重连。');
assert.equal(getTurnAnnouncement({ page: 'game', connected: true, isMyTurn: true }), '轮到你出牌。');
assert.equal(getTurnAnnouncement({ page: 'game', connected: true, currentPlayerName: '  老王  ' }), '轮到老王出牌。');
assert.equal(getTurnAnnouncement({ page: 'game', connected: true, currentPlayerName: '' }), '轮到等待出牌。');

console.log('game chrome state tests passed');
