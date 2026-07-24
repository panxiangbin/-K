import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./src/App.jsx', import.meta.url), 'utf8');

assert.match(source, /const \[reconnectEpoch, setReconnectEpoch\] = useState\(0\);/, 'App must track reconnect epochs');
assert.match(source, /if \(msg\.reconnect\) \{[\s\S]*setToasts\(\[\]\);[\s\S]*setReconnectEpoch\(epoch => epoch \+ 1\);[\s\S]*操作状态已刷新/, 'reconnect must clear stale notices and advance the game epoch');
assert.match(source, /<Game key=\{`game-\$\{reconnectEpoch\}`\}/, 'Game must remount after a successful reconnect');
assert.match(source, /setReconnectEpoch\(0\);[\s\S]*autoRejoinTried\.current = false;/, 'leaving a room must reset the reconnect epoch');

console.log('reconnect UI reset contract passed');
