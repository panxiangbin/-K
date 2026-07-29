'use strict';

const assert = require('assert');
const { transformDuplicateJoinGuard } = require('./duplicate-join-guard');

const source = `async function join() {
    if (reconnecting) {
      clientInfo.playerId = reconnecting.id;
      clientInfo.roomId = roomId;
    }
}`;
const transformed = transformDuplicateJoinGuard(source);
assert(transformed.includes('clientInfo.roomId === roomId && clientInfo.playerId === reconnecting.id'), '同一连接同一玩家必须直接忽略重复加入');
assert(transformed.includes('if (reconnecting) {'), '真实新连接的重连分支必须保留');
assert.equal(transformDuplicateJoinGuard(transformed), transformed, '转换必须幂等');
assert.throws(() => transformDuplicateJoinGuard('const untouched = true;'), /could not find reconnect branch/);

console.log('duplicate join guard tests passed');
