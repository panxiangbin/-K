import assert from 'node:assert/strict';
import {
  SETTLEMENT_ACTION_TIMEOUT_MS,
  getSettlementActionState,
  getSettlementTimeoutMessage,
} from './src/settlement-action-state.js';

assert.equal(SETTLEMENT_ACTION_TIMEOUT_MS, 12000);

const hostReady = getSettlementActionState({ connected: true, isHost: true, roomId: '123456' });
assert.equal(hostReady.canStartNextRound, true);
assert.equal(hostReady.canCopy, true);
assert.equal(hostReady.nextRoundLabel, '继续下一局 →');

const disconnected = getSettlementActionState({ connected: false, isHost: true, roomId: '123456' });
assert.equal(disconnected.canStartNextRound, false);
assert.equal(disconnected.nextRoundLabel, '等待重新连接');
assert.match(disconnected.nextRoundHint, /网络恢复/);

const guest = getSettlementActionState({ connected: true, isHost: false, roomId: '123456' });
assert.equal(guest.canStartNextRound, false);
assert.equal(guest.nextRoundLabel, '等待房主开始');

const pending = getSettlementActionState({ connected: true, isHost: true, pendingAction: 'next_round', roomId: '123456' });
assert.equal(pending.canStartNextRound, false);
assert.equal(pending.canCopy, false);
assert.match(pending.nextRoundLabel, /正在开始/);
assert.match(pending.nextRoundHint, /不要重复点击/);

const copying = getSettlementActionState({ connected: true, isHost: true, pendingAction: 'copy_room', roomId: '123456' });
assert.equal(copying.canCopy, false);
assert.equal(copying.copyLabel, '复制中…');

const solo = getSettlementActionState({ connected: true, isHost: true, roomId: 'SOLO', isSolo: true });
assert.equal(solo.canCopy, false);

assert.match(getSettlementTimeoutMessage('next_round'), /尚未开始/);
assert.match(getSettlementTimeoutMessage('copy_room'), /长按房间号/);
assert.equal(getSettlementTimeoutMessage('unknown'), '');

console.log('settlement action state tests passed');
