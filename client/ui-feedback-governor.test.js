import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MAX_VISIBLE_TOASTS,
  MAX_VISIBLE_GAME_TOASTS,
  PASS_TOAST_WINDOW_MS,
  chooseVisibleToastIndexes,
  getToastPriority,
  getToastTone,
  isPassToast,
  normalizeToastText,
} from './src/ui-feedback-governor.js';
import { getGameChromeState } from './src/game-chrome-state.js';

assert.equal(MAX_VISIBLE_TOASTS, 3, '大厅最多同时显示3条提示');
assert.equal(MAX_VISIBLE_GAME_TOASTS, 2, '牌桌最多同时显示2条提示，避免遮挡核心内容');
assert.equal(PASS_TOAST_WINDOW_MS, 2200, '连续过牌合并窗口保持短而明确');
assert.equal(normalizeToastText('  ⚠  牌型不合法  '), '牌型不合法');
assert.equal(isPassToast('张三 过牌'), true);
assert.equal(isPassToast('你可以过牌'), false);
assert.equal(getToastTone('网络断开', 'error'), 'error');
assert.equal(getToastTone('服务器正在启动'), 'connection');
assert.equal(getToastTone('房间号已复制', 'success'), 'success');
assert.equal(getToastTone('李四 炸弹！', 'bomb'), 'special');
assert.equal(getToastTone('张三 过牌', 'dim'), 'quiet');
assert.ok(getToastPriority('所选牌型不合法', 'error') > getToastPriority('张三 过牌', 'dim'));
assert.ok(getToastPriority('正在恢复连接') > getToastPriority('提示 1/2', 'success'));
assert.ok(getToastPriority('李四 炸弹！', 'bomb') > getToastPriority('提示 1/2', 'success'));

const visible = chooseVisibleToastIndexes([
  { text: '甲 过牌', type: 'dim' },
  { text: '提示 1/2', type: 'success' },
  { text: '乙 炸弹！', type: 'bomb' },
  { text: '网络断开', type: 'error' },
], 3);
assert.deepEqual(visible, [1, 2, 3], '低优先级过牌应先让位给错误、炸弹和有效提示');

const gameVisible = chooseVisibleToastIndexes([
  { text: '甲 过牌', type: 'dim' },
  { text: '提示 1/2', type: 'success' },
  { text: '网络断开', type: 'error' },
], MAX_VISIBLE_GAME_TOASTS);
assert.deepEqual(gameVisible, [1, 2], '牌桌只保留最重要的两条提示');

assert.equal(getGameChromeState({ page: 'game', connected: true }).showFloatingSound, true, '牌桌内必须保留声音开关');
assert.equal(getGameChromeState({ page: 'lobby', connected: true }).showFloatingSound, true);

const mainSource = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const governorSource = fs.readFileSync(new URL('./src/ui-feedback-governor.js', import.meta.url), 'utf8');
const feedbackCss = fs.readFileSync(new URL('./src/ui-feedback-governor.css', import.meta.url), 'utf8');
const soundCss = fs.readFileSync(new URL('./src/compact-game-controls.css', import.meta.url), 'utf8');
assert.match(mainSource, /installUiFeedbackGovernor\(\)/, '正式入口必须安装提示治理器');
assert.match(mainSource, /ui-feedback-governor\.css/, '正式入口必须加载统一提示样式');
assert.match(mainSource, /compact-game-controls\.css/, '正式入口必须加载牌桌声音按钮样式');
assert.match(governorSource, /role', 'alert'/, '严重错误必须使用即时警报语义');
assert.match(governorSource, /role', 'status'/, '普通状态必须使用礼貌播报语义');
assert.match(governorSource, /aria-live', 'off'/, '提示容器必须关闭重复播报');
assert.match(governorSource, /game-table-shell/, '牌桌提示数量必须单独控制');
assert.match(feedbackCss, /data-feedback-tone="error"/, '错误提示必须有独立视觉状态');
assert.match(feedbackCss, /data-feedback-tone="connection"/, '连接提示必须有独立视觉状态');
assert.match(feedbackCss, /data-feedback-tone="success"/, '成功提示必须有独立视觉状态');
assert.match(feedbackCss, /MAX_VISIBLE_GAME_TOASTS|data-feedback-surface="game"/, '牌桌提示必须避开核心操作区');
assert.match(feedbackCss, /prefers-contrast:\s*more/, '提示必须支持高对比度');
assert.match(feedbackCss, /prefers-reduced-motion:\s*reduce/, '提示必须尊重减少动态设置');
assert.doesNotMatch(feedbackCss, /backdrop-filter:\s*blur/, '提示不得使用玻璃模糊');
assert.match(soundCss, /min-width:\s*44px/, '牌桌声音按钮触控宽度不得小于44px');
assert.match(soundCss, /focus-visible/, '牌桌声音按钮必须有键盘焦点');
assert.match(soundCss, /prefers-reduced-motion:\s*reduce/, '必须尊重减少动态设置');
assert.doesNotMatch(soundCss, /--card-w|--card-h|\.card\s*\{/, '本轮不得缩小扑克牌');

console.log('ui feedback governor tests passed');
