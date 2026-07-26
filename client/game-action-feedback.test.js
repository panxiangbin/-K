import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getActionButtonDescription,
  getGameActionFeedback,
} from './src/game-action-feedback.js';

assert.match(getGameActionFeedback({ connected: false }), /网络尚未连接/);
assert.match(getGameActionFeedback({ connected: true, busy: true }), /不要重复点击/);
assert.match(getGameActionFeedback({ connected: true, gameEnded: true }), /本局已经结束/);
assert.match(getGameActionFeedback({ connected: true, myFinished: true }), /已经出完手牌/);
assert.match(getGameActionFeedback({ connected: true, isMyTurn: false }), /还没轮到你/);
assert.match(getGameActionFeedback({ connected: true, isMyTurn: true, selectedCount: 2, selectedValid: false }), /牌型不合法/);
assert.match(getGameActionFeedback({ connected: true, isMyTurn: true, selectedCount: 2, selectedValid: true, canBeat: false }), /压不过上一手/);
assert.match(getGameActionFeedback({ connected: true, isMyTurn: true, selectedCount: 3 }), /可以点击“出牌”/);
assert.match(getGameActionFeedback({ connected: true, isMyTurn: true, isFirst: true }), /先手不能过牌/);
assert.match(getGameActionFeedback({ connected: true, isMyTurn: true }), /有合法更大牌时必须压牌/);

assert.match(getActionButtonDescription('hint', { connected: true, isMyTurn: true }), /依次展示可压候选/);
assert.match(getActionButtonDescription('pass', { connected: true, isMyTurn: true }), /确实没有合法更大牌/);

const source = readFileSync(new URL('./src/game-action-feedback.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('./src/game-action-feedback.css', import.meta.url), 'utf8');
assert.match(source, /role', 'status'/);
assert.match(source, /aria-live', 'polite'/);
assert.match(source, /aria-atomic', 'true'/);
assert.match(source, /data-disabled-reason/);
assert.match(source, /CONNECTION_EVENT/);
assert.match(css, /overflow-wrap:\s*anywhere/);
assert.match(css, /max-height:\s*430px/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.doesNotMatch(css, /--card-w|--card-h|\.card\s*\{/);

console.log('game action feedback tests passed');
