import assert from 'node:assert/strict';
import { CONNECTION_PHASES, getConnectionStatusView } from './src/connection-status.js';

const connecting = getConnectionStatusView(CONNECTION_PHASES.CONNECTING);
assert.equal(connecting.text, '正在连接游戏服务器…');
assert.equal(connecting.retryable, false);

const waking = getConnectionStatusView(CONNECTION_PHASES.WAKING);
assert.match(waking.text, /服务器正在启动/);
assert.equal(waking.retryable, true);

const offline = getConnectionStatusView(CONNECTION_PHASES.OFFLINE);
assert.match(offline.text, /网络已断开/);
assert.equal(offline.retryable, false);
assert.equal(offline.tone, 'offline');

const reconnecting = getConnectionStatusView(CONNECTION_PHASES.RECONNECTING);
assert.match(reconnecting.text, /网络已恢复/);
assert.equal(reconnecting.retryable, true);

const failed = getConnectionStatusView(CONNECTION_PHASES.FAILED);
assert.match(failed.text, /立即重试/);
assert.equal(failed.retryable, true);

assert.deepEqual(getConnectionStatusView('unknown'), connecting);
console.log('connection status tests passed');
