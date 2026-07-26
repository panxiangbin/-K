import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MAX_VISIBLE_TOASTS,
  PASS_TOAST_WINDOW_MS,
  chooseVisibleToastIndexes,
  getToastPriority,
  isPassToast,
  normalizeToastText,
} from './src/ui-feedback-governor.js';
import { getGameChromeState } from './src/game-chrome-state.js';

assert.equal(MAX_VISIBLE_TOASTS, 3, '牌桌最多同时显示3条提示');
assert.equal(PASS_TOAST_WINDOW_MS, 2200, '连续过牌合并窗口保持短而明确');
assert.equal(normalizeToastText('  ⚠  牌型不合法  '), '牌型不合法');
assert.equal(isPassToast('张三 过牌'), true);
assert.equal(isPassToast('你可以过牌'), false);
assert.ok(getToastPriority('所选牌型不合法', 'error') > getToastPriority('张三 过牌', 'dim'));
assert.ok(getToastPriority('李四 炸弹！', 'bomb') > getToastPriority('提示 1/2', 'success'));

const visible = chooseVisibleToastIndexes([
  { text: '甲 过牌', type: 'dim' },
  { text: '提示 1/2', type: 'success' },
  { text: '乙 炸弹！', type: 'bomb' },
  { text: '网络断开', type: 'error' },
], 3);
assert.deepEqual(visible, [1, 2, 3], '低优先级过牌应先让位给错误、炸弹和有效提示');

assert.equal(getGameChromeState({ page: 'game', connected: true }).showFloatingSound, true, '牌桌内必须保留声音开关');
assert.equal(getGameChromeState({ page: 'lobby', connected: true }).showFloatingSound, true);

const mainSource = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const cssSource = fs.readFileSync(new URL('./src/compact-game-controls.css', import.meta.url), 'utf8');
assert.match(mainSource, /installUiFeedbackGovernor\(\)/, '正式入口必须安装提示治理器');
assert.match(mainSource, /compact-game-controls\.css/, '正式入口必须加载牌桌声音按钮样式');
assert.match(cssSource, /min-width:\s*44px/, '牌桌声音按钮触控宽度不得小于44px');
assert.match(cssSource, /focus-visible/, '牌桌声音按钮必须有键盘焦点');
assert.match(cssSource, /prefers-reduced-motion:\s*reduce/, '必须尊重减少动态设置');
assert.doesNotMatch(cssSource, /--card-w|--card-h|\.card\s*\{/, '本轮不得缩小扑克牌');

console.log('ui feedback governor tests passed');
