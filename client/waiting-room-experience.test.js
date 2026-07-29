import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getStartActionState, getWaitingRoomProgress } from './src/waiting-room-experience.js';

assert.deepEqual(getWaitingRoomProgress({ current: 2, max: 4, isHost: true, connected: true }), {
  tone: 'waiting', title: '还差2位玩家', detail: '把房间号发给亲友，人员到齐后即可开始。', remaining: 2,
});
assert.deepEqual(getWaitingRoomProgress({ current: 4, max: 4, isHost: true, connected: true }), {
  tone: 'ready', title: '人员已到齐，可以开始', detail: '确认大家都准备好后开始游戏。', remaining: 0,
});
assert.equal(getWaitingRoomProgress({ current: 4, max: 4, isHost: false, connected: true }).title, '人员已到齐，等待房主开始');
assert.equal(getWaitingRoomProgress({ current: 2, max: 4, isHost: false, connected: false }).title, '正在恢复房间连接');
assert.deepEqual(getStartActionState({ current: 4, max: 4, isHost: true, connected: true }), {
  state: 'ready', title: '可以开始游戏', detail: '确认所有玩家都在房间内，再点击开始。',
});
assert.equal(getStartActionState({ current: 3, max: 4, isHost: true, connected: true }).title, '还需1位玩家');
assert.equal(getStartActionState({ current: 4, max: 4, isHost: true, connected: false }).title, '暂时不能开始');
assert.equal(getStartActionState({ current: 4, max: 4, isHost: true, connected: true, busy: true }).title, '正在开始游戏');
assert.equal(getStartActionState({ current: 4, max: 4, isHost: false, connected: true }).title, '等待房主开始');

const source = fs.readFileSync(new URL('./src/waiting-room-experience.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('./src/waiting-room-experience.css', import.meta.url), 'utf8');
const safeCss = fs.readFileSync(new URL('./src/waiting-room-react-safe.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');

assert.match(source, /waiting-empty-seat-grid/);
assert.match(source, /waiting-player--empty/);
assert.match(source, /role', 'status'/);
assert.match(source, /aria-live', 'polite'/);
assert.match(source, /aria-atomic', 'true'/);
assert.match(source, /waitingRoomSignature/);
assert.match(source, /复制房间号，发给亲友加入/);
assert.match(source, /waiting-start-hint/);
assert.match(source, /aria-describedby/);
assert.match(source, /aria-busy/);
assert.match(source, /正在复制房间号/);
assert.match(source, /复制失败，请长按房间号手动复制/);
assert.match(source, /dataset\.connectionState/);
assert.match(source, /离线|恢复中/);
assert.match(source, /attributeFilter:\s*\['disabled', 'aria-busy'\]/);
assert.doesNotMatch(source, /appendChild\(player\)/, '增强器不得搬动React渲染的玩家节点');
assert.doesNotMatch(source, /player\.prepend\(/, '增强器不得向React玩家节点插入座位标签');
assert.doesNotMatch(source, /grid\.replaceChildren\(\)\s*;\s*players/, '不得清空座位容器后重新挂载真实玩家');
assert.match(source, /data-seat-label/, '座位号应通过属性和CSS显示');
assert.doesNotMatch(source, /setInterval/);

assert.match(css, /min-height:\s*44px/);
assert.match(safeCss, /grid-template-columns:\s*repeat\(2/);
assert.match(safeCss, /> \.waiting-player/);
assert.match(safeCss, /content:\s*attr\(data-seat-label\)/);
assert.match(safeCss, /waiting-empty-seat-grid/);
assert.match(safeCss, /@media \(max-width: 430px\)/);
assert.match(css, /@media \(max-height: 430px\)/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /outline:\s*3px solid var\(--ui-focus/);
assert.match(css, /waiting-copy-feedback/);
assert.match(safeCss, /data-connection-state='offline'/);
assert.match(safeCss, /data-connection-state='recovering'/);
assert.match(css, /waiting-start-hint/);
assert.match(css, /min-height:\s*48px/);
assert.doesNotMatch(css + safeCss, /backdrop-filter/);

assert.match(main, /installWaitingRoomExperience/);
assert.match(main, /waiting-room-experience\.css/);
assert.match(main, /waiting-room-react-safe\.css/);

console.log('waiting room experience tests passed');
