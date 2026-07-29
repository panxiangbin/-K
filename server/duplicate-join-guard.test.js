'use strict';

const assert = require('assert');
const { transformDuplicateJoinGuard } = require('./duplicate-join-guard');

const rawSource = `async function join() {
    if (reconnecting) {
      clientInfo.playerId = reconnecting.id;
      clientInfo.roomId = roomId;
    }
}`;
const rawTransformed = transformDuplicateJoinGuard(rawSource);
assert(rawTransformed.includes('clientInfo.roomId === roomId && clientInfo.playerId === reconnecting.id'), '原始重连分支必须拦截同连接重复加入');
assert(rawTransformed.includes('clientInfo.playerId = reconnecting.id;'), '真实新连接的原始重连逻辑必须保留');
assert.equal(transformDuplicateJoinGuard(rawTransformed), rawTransformed, '原始分支转换必须幂等');

const optimizedSource = `async function join() {
      if (reconnecting) {
        require('./solo-room-reconnect').cancelSoloRoomCleanup(roomId);
        require('./reconnect-state-sync').syncReconnectingPlayer({ ws, room });
        return;
      }
}`;
const optimizedTransformed = transformDuplicateJoinGuard(optimizedSource);
assert(optimizedTransformed.includes('clientInfo.roomId === roomId && clientInfo.playerId === reconnecting.id'), '优化后重连分支也必须拦截同连接重复加入');
assert(optimizedTransformed.includes("require('./solo-room-reconnect').cancelSoloRoomCleanup(roomId);"), '优化后的真实重连同步必须保留');
assert.equal(transformDuplicateJoinGuard(optimizedTransformed), optimizedTransformed, '优化后分支转换必须幂等');
assert.throws(() => transformDuplicateJoinGuard('const untouched = true;'), /could not find reconnect branch/);

console.log('duplicate join guard tests passed');
