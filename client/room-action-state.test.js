import assert from 'node:assert/strict';
import { getRoomActionState, getRoomActionStatus, ROOM_ACTION_TIMEOUT_MS } from './src/room-action-state.js';

assert.equal(ROOM_ACTION_TIMEOUT_MS, 12000);

const readyStart = getRoomActionState({ action:'start', connected:true, isHost:true, playerCount:3, roomStatus:'waiting' });
assert.equal(readyStart.disabled, false);
assert.equal(readyStart.label, '开始游戏');

assert.match(getRoomActionState({ action:'start', connected:false, isHost:true, playerCount:4 }).reason, /尚未连接/);
assert.match(getRoomActionState({ action:'start', connected:true, isHost:true, playerCount:2 }).reason, /至少需要 3 名玩家/);
assert.match(getRoomActionState({ action:'start', connected:true, isHost:false, playerCount:4 }).reason, /只有房主/);
assert.match(getRoomActionState({ action:'start', connected:true, isHost:true, playerCount:4, roomStatus:'playing' }).reason, /已经开始/);

const starting = getRoomActionState({ action:'start', connected:true, pendingAction:'start', isHost:true, playerCount:4 });
assert.equal(starting.disabled, true);
assert.equal(starting.label, '正在开始…');

const readyExit = getRoomActionState({ action:'exit', connected:true });
assert.equal(readyExit.disabled, false);
assert.equal(readyExit.label, '退出房间');

const disconnectedExit = getRoomActionState({ action:'exit', connected:false });
assert.equal(disconnectedExit.disabled, true);
assert.match(disconnectedExit.reason, /安全退出/);

const exiting = getRoomActionState({ action:'exit', connected:true, pendingAction:'exit' });
assert.equal(exiting.disabled, true);
assert.equal(exiting.label, '正在退出…');

assert.match(getRoomActionStatus({ pendingAction:'start', connected:true }), /请勿重复点击/);
assert.match(getRoomActionStatus({ pendingAction:'exit', connected:true }), /不会清空房间/);
assert.match(getRoomActionStatus({ timedOutAction:'start', connected:true }), /尚未开始/);
assert.match(getRoomActionStatus({ timedOutAction:'exit', connected:true }), /房间仍然保留/);
assert.match(getRoomActionStatus({ connected:false }), /暂时不可用/);

console.log('room action state tests passed');
