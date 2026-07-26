const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ERROR_MESSAGES, isKnownErrorCode, getErrorMessage } = require('./error-messages');
const { transformServerSource } = require('./runtime-hook-contract');

const expected = {
  ROOM_NOT_FOUND: '房间不存在或已经关闭，请检查房间号后重新加入。',
  ROOM_FULL: '房间人数已满，请加入其他房间。',
  NOT_YOUR_TURN: '还没轮到你，请等待当前玩家完成操作。',
  INVALID_PATTERN: '所选牌型不合法。只能出单张、对子、三张、四至七张同点牌或合法炸弹。',
  CANNOT_BEAT: '所选牌压不过上一手。请换同类型、同张数的更大牌，或使用合法炸弹。',
  MUST_BEAT: '你有合法更大牌，必须压牌，不能直接过牌。',
  GAME_NOT_ACTIVE: '当前对局尚未开始或已经结束，不能继续出牌。',
};

for (const [code, message] of Object.entries(expected)) {
  assert.strictEqual(ERROR_MESSAGES[code], message, `${code}文案必须稳定且讲人话`);
  assert.strictEqual(isKnownErrorCode(code), true, `${code}必须是已知错误码`);
  assert.strictEqual(getErrorMessage(code), message, `${code}必须映射为固定文案`);
}

assert.strictEqual(isKnownErrorCode('UNKNOWN'), false, '未知错误码不能伪装成已知错误');
assert.strictEqual(getErrorMessage('UNKNOWN'), '操作没有成功，请等待状态更新后重试。');

const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
const transformed = transformServerSource(source);

assert.ok(transformed.includes("sendError(ws, 'GAME_NOT_ACTIVE')"), '对局未开始或已结束时必须明确反馈');
assert.ok(transformed.includes("sendError(ws, 'NOT_YOUR_TURN')"), '出牌和过牌轮次错误必须明确反馈');
assert.ok(transformed.includes("sendError(ws, 'INVALID_PATTERN')"), '非法牌型必须使用统一文案');
assert.ok(transformed.includes("sendError(ws, 'CANNOT_BEAT')"), '压不过必须使用统一文案');
assert.ok(transformed.includes("sendError(ws, 'MUST_BEAT')"), '强制压牌必须使用统一文案');
assert.ok(transformed.includes("sendError(ws, 'ROOM_FULL')"), '房间已满必须使用统一文案');
assert.ok(!transformed.includes("if (!room || room.status !== 'playing') return;"), '牌桌操作不得静默失败');
assert.ok(!transformed.includes("if (playerIdx !== room.currentPlayer) return;"), '过牌轮次错误不得静默失败');
assert.ok(transformed.includes("send(ws, { type: 'error', msg });"), '必须保持现有error消息类型和msg字段');
assert.ok(!transformed.includes("type: 'error', code"), '不得新增WebSocket错误字段');

console.log('server error message tests passed');
