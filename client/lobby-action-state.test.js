import assert from 'node:assert/strict';
import { getLobbyActionState, getLobbyActionStatus, LOBBY_ACTION_TIMEOUT_MS } from './src/lobby-action-state.js';

assert.equal(LOBBY_ACTION_TIMEOUT_MS, 12000);

const disconnected = getLobbyActionState({ connected: false, pendingAction: null, action: 'create' });
assert.equal(disconnected.disabled, true);
assert.match(disconnected.reason, /尚未连接/);

const ready = getLobbyActionState({ connected: true, pendingAction: null, action: 'create' });
assert.equal(ready.disabled, false);
assert.equal(ready.label, '创建房间');

const pending = getLobbyActionState({ connected: true, pendingAction: 'join', action: 'join' });
assert.equal(pending.disabled, true);
assert.equal(pending.label, '进入房间中…');
assert.match(pending.reason, /不要重复|等待/);

const blockedByOther = getLobbyActionState({ connected: true, pendingAction: 'create', action: 'join' });
assert.equal(blockedByOther.disabled, true);
assert.match(blockedByOther.reason, /另一个请求/);

const invalidJoin = getLobbyActionState({ connected: true, pendingAction: null, action: 'join', valid: false });
assert.equal(invalidJoin.disabled, true);
assert.match(invalidJoin.reason, /6位房间号/);

assert.match(getLobbyActionStatus({ connected: false, pendingAction: null }), /连接成功后/);
assert.match(getLobbyActionStatus({ connected: true, pendingAction: 'solo' }), /不要重复点击/);
assert.match(getLobbyActionStatus({ connected: true, pendingAction: null, timedOut: true }), /没有响应/);
assert.equal(getLobbyActionStatus({ connected: true, pendingAction: null }), '');

console.log('lobby action state tests passed');
