import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./src/hand-interaction-enhancer.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('./src/hand-interaction.css', import.meta.url), 'utf8');

assert.match(source, /role', 'button'/, '手牌必须具备按钮语义');
assert.match(source, /tabindex', '0'/, '手牌必须支持键盘聚焦');
assert.match(source, /aria-pressed/, '选中状态必须提供读屏语义');
assert.match(source, /event\.key !== 'Enter'/, '必须支持回车选择');
assert.match(source, /event\.key !== ' '/, '必须支持空格选择');
assert.match(source, /role', 'group'/, '手牌区必须具备分组语义');
assert.match(source, /共\$\{cards\.length\}张/, '手牌区必须播报总张数');
assert.match(source, /MutationObserver/, '发牌和选中变化后必须同步语义');
assert.match(css, /\[data-card-id\]:focus-visible/, '键盘焦点必须清楚');
assert.match(css, /min-height:\s*44px/, '牌的可点击区域不得小于44px');
assert.match(css, /touch-action:\s*none/, '连续滑动选牌必须阻止页面误滚动');
assert.match(css, /prefers-reduced-motion:\s*reduce/, '必须支持减弱动态');
assert.doesNotMatch(css, /--card-w\s*:/, '本轮不得缩小扑克牌宽度');
assert.doesNotMatch(css, /--card-h\s*:/, '本轮不得缩小扑克牌高度');

console.log('hand interaction enhancer tests passed');
