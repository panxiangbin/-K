import assert from 'node:assert/strict';
import {
  SERVER_REJECTION_EVENT,
  SERVER_ERROR_BANNER_ID,
  SERVER_ERROR_DEDUPE_MS,
  normalizeServerError,
  isTableActionRejection,
  getServerErrorDuration,
  getServerErrorKey,
  shouldPublishServerError,
  resetServerErrorDedupe,
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

assert.equal(getServerErrorDuration('非法牌型'), 6500, '规则说明必须保留足够阅读时间');
assert.equal(getServerErrorDuration('房间不存在'), 6500, '严重房间错误必须延长显示');
assert.equal(getServerErrorDuration('短错误'), 3800);
assert.equal(getServerErrorKey(' ⚠  房间不存在 '), '房间不存在或已经关闭，请检查房间号后重新加入。');
assert.equal(SERVER_ERROR_DEDUPE_MS, 1800);

resetServerErrorDedupe();
assert.equal(shouldPublishServerError('非法牌型', 1000), true);
assert.equal(shouldPublishServerError('非法牌型', 1000 + SERVER_ERROR_DEDUPE_MS - 1), false, '短时间同类错误必须去重');
assert.equal(shouldPublishServerError('非法牌型', 1000 + SERVER_ERROR_DEDUPE_MS), true, '去重窗口结束后允许再次播报');
assert.equal(shouldPublishServerError('不够大', 1001 + SERVER_ERROR_DEDUPE_MS), true, '不同错误不能被误去重');

const events = [];
const nodes = new Map();
const body = {
  appendChild(node) { nodes.set(node.id, node); },
};
const document = {
  body,
  createElement() {
    return {
      id: '',
      style: {},
      attributes: {},
      textContent: '',
      setAttribute(name, value) { this.attributes[name] = value; },
      remove() { nodes.delete(this.id); },
    };
  },
  getElementById(id) { return nodes.get(id) || null; },
};
const target = {
  document,
  dispatchEvent(event) { events.push(event); },
};
const originalCustomEvent = globalThis.CustomEvent;
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options) { this.type = type; this.detail = options.detail; }
};

resetServerErrorDedupe();
const text = publishServerRejection('非法牌型', target, 5000);
assert.equal(text, '所选牌型不合法。只能出单张、对子、三张、四至七张同点牌或合法炸弹。');
assert.equal(events.length, 1);
assert.equal(events[0].type, SERVER_REJECTION_EVENT);
assert.equal(events[0].detail.tableAction, true);
assert.equal(events[0].detail.text, text);
assert.equal(events[0].detail.duration, 6500);
assert.equal(events[0].detail.dedupeKey, text);
assert.equal(nodes.size, 1, '错误提示只能保留一个，不得连续堆叠');
assert.equal(nodes.get(SERVER_ERROR_BANNER_ID).attributes.role, 'alert');
assert.equal(nodes.get(SERVER_ERROR_BANNER_ID).attributes['aria-live'], 'assertive');

publishServerRejection('非法牌型', target, 5001);
assert.equal(events.length, 1, '重复错误不得再次发布事件');
assert.equal(nodes.size, 1, '重复错误不得增加第二个提示');

publishServerRejection('不够大', target, 5002);
assert.equal(events.length, 2, '不同错误应立即替换并播报');
assert.equal(nodes.size, 1, '不同错误也应复用同一个提示容器');
assert.equal(nodes.get(SERVER_ERROR_BANNER_ID).textContent, normalizeServerError('不够大'));

globalThis.CustomEvent = originalCustomEvent;
console.log('server error feedback tests passed');
