import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const landscape = readFileSync(new URL('./src/landscape-mode.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./src/landscape-mode.css', import.meta.url), 'utf8');

assert.match(html, /viewport-fit=cover/, '横屏页面仍必须保留安全区适配');
assert.match(html, /syncViewportVars/, '仍需同步动态视口尺寸供横屏布局使用');
assert.match(main, /installLandscapeMode\(\)/, '应用启动时必须启用横屏模式');
assert.match(landscape, /screen\.orientation\.lock\('landscape'\)/, '用户点击后应尝试锁定真实横屏');
assert.match(styles, /landscape-gate-active/, '竖屏打开时必须显示旋转提示而不是继续展示竖版大厅');
assert.match(styles, /@media \(orientation: landscape\)/, '横屏时必须切换到全宽牌桌');
assert.doesNotMatch(styles, /rotate\(90deg\)/, '不得把竖版页面简单旋转九十度冒充横屏');

console.log('landscape lobby requirements passed');
