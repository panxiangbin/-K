import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getWaitingRequestFeedback,
  WAITING_ROOM_REQUEST_TIMEOUT_MS,
} from './src/waiting-room-request-lifecycle.js';

assert.equal(WAITING_ROOM_REQUEST_TIMEOUT_MS, 12000);

assert.deepEqual(getWaitingRequestFeedback({ kind: 'start', pending: true, connected: true }), {
  tone: 'busy',
  title: '正在进入牌桌',
  detail: '请求已经发出，请勿重复点击。',
  showReconnect: false,
});

assert.deepEqual(getWaitingRequestFeedback({ kind: 'exit', timedOut: true, connected: true }), {
  tone: 'timeout',
  title: '退出房间等待时间较长',
  detail: '请求可能没有送达，可以先重新连接服务器，再次操作。',
  showReconnect: true,
});

assert.equal(getWaitingRequestFeedback({ kind: 'start', pending: true, connected: false }).title, '正在恢复服务器连接');
assert.equal(getWaitingRequestFeedback({ kind: 'start' }), null);

const source = fs.readFileSync(new URL('./src/waiting-room-request-lifecycle.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('./src/waiting-room-request-lifecycle.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const pkg = fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8');

assert.match(source, /henan50k-reconnect-request/);
assert.match(source, /requestTimedOut/);
assert.match(source, /waiting-role-status/);
assert.match(source, /你现在是房主/);
assert.match(source, /房主已经变更/);
assert.match(source, /role', 'status'/);
assert.match(source, /aria-live', 'polite'/);
assert.match(source, /aria-atomic', 'true'/);
assert.match(source, /attributeFilter:\s*\['disabled', 'aria-busy'\]/);
assert.match(source, /feedbackKey\(feedbackState\)/, '等待房间提示必须生成稳定渲染键');
assert.match(source, /feedback\.dataset\.renderKey === nextKey/, '相同提示不得重复重建 DOM');
assert.match(source, /if \(feedback\.childNodes\.length\) feedback\.replaceChildren\(\)/, '隐藏提示时只在确有子节点时清空');
assert.match(source, /roleStatus\.textContent !== text/, '房主状态文字必须幂等更新');
assert.doesNotMatch(source, /feedback\.replaceChildren\(\);\s*const title/, '不得每次监听回调都无条件清空再重建提示');
assert.doesNotMatch(source, /setInterval/);

assert.match(css, /min-height:\s*44px/);
assert.match(css, /min-height:\s*48px/);
assert.match(css, /@media \(max-width: 430px\)/);
assert.match(css, /@media \(max-height: 430px\)/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /outline:\s*3px solid var\(--ui-focus/);
assert.match(css, /overflow-wrap:\s*anywhere/);
assert.doesNotMatch(css, /backdrop-filter/);

assert.match(main, /installWaitingRoomRequestLifecycle/);
assert.match(main, /waiting-room-request-lifecycle\.css/);
assert.match(pkg, /waiting-room-request-lifecycle\.test\.js/);

console.log('waiting room request lifecycle tests passed');
