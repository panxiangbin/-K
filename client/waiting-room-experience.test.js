import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getWaitingRoomProgress } from './src/waiting-room-experience.js';

assert.deepEqual(getWaitingRoomProgress({ current: 2, max: 4, isHost: true, connected: true }), {
  tone: 'waiting',
  title: '还差2位玩家',
  detail: '把房间号发给亲友，人员到齐后即可开始。',
  remaining: 2,
});

assert.deepEqual(getWaitingRoomProgress({ current: 4, max: 4, isHost: true, connected: true }), {
  tone: 'ready',
  title: '人员已到齐，可以开始',
  detail: '确认大家都准备好后开始游戏。',
  remaining: 0,
});

assert.equal(
  getWaitingRoomProgress({ current: 4, max: 4, isHost: false, connected: true }).title,
  '人员已到齐，等待房主开始',
);
assert.equal(
  getWaitingRoomProgress({ current: 2, max: 4, isHost: false, connected: false }).title,
  '正在恢复房间连接',
);

const source = fs.readFileSync(new URL('./src/waiting-room-experience.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('./src/waiting-room-experience.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');

assert.match(source, /waiting-seat-grid/);
assert.match(source, /waiting-player--empty/);
assert.match(source, /role', 'status'/);
assert.match(source, /aria-live', 'polite'/);
assert.match(source, /aria-atomic', 'true'/);
assert.match(source, /waitingRoomSignature/);
assert.match(source, /复制房间号，发给亲友加入/);
assert.doesNotMatch(source, /setInterval/);

assert.match(css, /min-height:\s*44px/);
assert.match(css, /grid-template-columns:\s*repeat\(2/);
assert.match(css, /@media \(max-width: 430px\)/);
assert.match(css, /@media \(max-height: 430px\)/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /outline:\s*3px solid var\(--ui-focus/);
assert.doesNotMatch(css, /backdrop-filter/);
assert.doesNotMatch(css, /#[0-9a-fA-F]{6}\s*;\s*\/\*\s*blue/i);

assert.match(main, /installWaitingRoomExperience/);
assert.match(main, /waiting-room-experience\.css/);

console.log('waiting room experience tests passed');
