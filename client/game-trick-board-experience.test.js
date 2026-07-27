import fs from 'node:fs';
import assert from 'node:assert/strict';

const moduleSource = fs.readFileSync(new URL('./src/game-trick-board-experience.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('./src/game-trick-board-experience.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert.match(moduleSource, /data-trick-board-experience/, '中央牌桌增强必须具备幂等标记');
assert.match(moduleSource, /role', 'status'/, '回合状态必须使用状态语义');
assert.match(moduleSource, /aria-live', 'polite'/, '回合状态必须支持礼貌播报');
assert.match(moduleSource, /aria-atomic', 'true'/, '回合状态必须整体播报');
assert.match(moduleSource, /role', 'list'/, '四席行动区必须使用列表语义');
assert.match(moduleSource, /role', 'listitem'/, '单个行动卡必须使用列表项语义');
assert.match(moduleSource, /is-passed/, '必须区分过牌状态');
assert.match(moduleSource, /is-waiting/, '必须区分等待状态');
assert.match(moduleSource, /is-played/, '必须区分已出牌状态');
assert.doesNotMatch(moduleSource, /setInterval\s*\(/, '中央牌桌增强不得使用持续轮询');

assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/, '行动记录必须使用稳定两列布局');
assert.match(css, /min-height:\s*78px/, '正常行动卡必须保留可读高度');
assert.match(css, /@media \(max-width: 520px\)/, '必须覆盖手机竖屏');
assert.match(css, /@media \(max-height: 430px\) and \(orientation: landscape\)/, '必须覆盖低高度横屏');
assert.match(css, /@media \(prefers-contrast: more\)/, '必须支持高对比度');
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, '必须支持减少动画');
assert.match(css, /backdrop-filter:\s*none/, '中央牌桌不得恢复玻璃模糊');
assert.doesNotMatch(css, /#7c3aed|#6366f1|#8b5cf6/i, '中央牌桌不得引入蓝紫荧光主题');

assert.match(main, /installGameTrickBoardExperience/, '中央牌桌增强必须接入正式入口');
assert.match(main, /game-trick-board-experience\.css/, '中央牌桌样式必须接入正式入口');
assert.ok(pkg.scripts.test.includes('game-trick-board-experience.test.js'), '中央牌桌测试必须进入完整测试链');

console.log('game trick board experience tests passed');
