import assert from 'node:assert/strict';
import { actionBlocked, movedBeyondThreshold, GAME_ACTION_TIMEOUT_MS, SLIDE_THRESHOLD_PX } from './src/game-action-guard.js';

assert.equal(SLIDE_THRESHOLD_PX, 10, '轻微移动阈值应为10像素');
assert.equal(GAME_ACTION_TIMEOUT_MS, 12000, '操作确认超时应为12秒');
assert.equal(movedBeyondThreshold({ x: 10, y: 10 }, { x: 15, y: 16 }), false, '轻微手抖不能触发滑动选牌');
assert.equal(movedBeyondThreshold({ x: 10, y: 10 }, { x: 20, y: 10 }), true, '达到阈值后应进入滑动选牌');
assert.equal(movedBeyondThreshold({ x: 0, y: 0 }, { x: 6, y: 8 }), true, '应按实际移动距离判断阈值');
assert.equal(actionBlocked({ connected: false, busy: false, disabled: false }), true, '断线时必须阻止出牌');
assert.equal(actionBlocked({ connected: true, busy: true, disabled: false }), true, '请求确认中必须防重复提交');
assert.equal(actionBlocked({ connected: true, busy: false, disabled: true }), true, '原生禁用按钮不能提交');
assert.equal(actionBlocked({ connected: true, busy: false, disabled: false }), false, '在线且空闲时允许操作');

console.log('game action guard tests passed');
