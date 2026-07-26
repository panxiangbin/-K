import assert from 'node:assert/strict';
import {
  SERVER_REJECTION_EVENT,
  normalizeServerError,
  isTableActionRejection,
  publishServerRejection,
} from './src/server-error-feedback.js';

assert.equal(normalizeServerError('房间不存在'), '房间不存在或已经关闭，请检查房间号后重新加入。');
assert.equal(normalizeServerError('房间已满'), '房间人数已满，请加入其他房间。');
assert.equal(normalizeServerError('非法牌型'), '所选牌型不合法。只能出单张、对子、三张、四至七张同点牌或合法炸弹。');
assert.equal(normalizeServerError('不够大'), '所选牌压不过上一手。请换同类型、同张数的更大牌，或使用合法炸弹。');
assert.equal(normalizeServerError('你有能压的牌，必须出！'), '你有合法更大牌，必须压牌，不能直接过牌。');
assert.equal(normalizeServerError(''), '操作没有成功，请等待状态更新后重试。');
assert.equal(normalizeServerError('服务器自定义说明'), '服务器自定义说明', '未知新文案必须原样保留');

assert.equal(isTableActionRejection('非法牌型'), true);
assert.equal(isTableActionRejection('不够大'), true);
assert.equal(isTableActionRejection('还没轮到你'), true);
assert.equal(isTableActionRejection('房间已满'), false);

const events = [];
const target = { dispatchEvent(event) { events.push(event); } };
const originalCustomEvent = globalThis.CustomEvent;
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options) { this.type = type; this.detail = options.detail; }
};

const text = publishServerRejection('非法牌型', target);
assert.equal(text, '所选牌型不合法。只能出单张、对子、三张、四至七张同点牌或合法炸弹。');
assert.equal(events.length, 1);
assert.equal(events[0].type, SERVER_REJECTION_EVENT);
assert.equal(events[0].detail.tableAction, true);
assert.equal(events[0].detail.text, text);

globalThis.CustomEvent = originalCustomEvent;
console.log('server error feedback tests passed');
