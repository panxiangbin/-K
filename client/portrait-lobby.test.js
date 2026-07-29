import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const landscape = readFileSync(new URL('./src/landscape-mode.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./src/landscape-mode.css', import.meta.url), 'utf8');

assert.match(html, /viewport-fit=cover/, '横屏页面仍必须保留安全区适配');
assert.match(html, /syncViewportVars/, '仍需同步动态视口尺寸供横屏布局使用');
assert.match(main, /installLandscapeMode\(\)/, '应用启动时必须启用横屏模式');
assert.match(landscape, /screen\.orientation\.lock\('landscape'\)/, '用户点击后应优先尝试锁定真实横屏');
assert.match(landscape, /isNativeLandscape/, '必须先识别真实横屏，不能无条件旋转页面');
assert.match(styles, /landscape-gate-active/, '竖屏打开时必须显示横屏入口而不是继续展示竖版大厅');
assert.match(styles, /@media \(orientation: landscape\)/, '真实横屏时必须切换到全宽牌桌');
assert.match(styles, /body\.force-landscape-active #root[\s\S]*rotate\(90deg\)/, '只有明确的兼容横屏状态才允许旋转横版画布');
assert.match(styles, /--forced-landscape-width/, '兼容横屏必须交换宽高，不能把竖版页面原尺寸直接旋转');
assert.match(landscape, /if \(nativeLandscape\) forced = false/, '检测到真实横屏后必须立即退出兼容旋转');

const rotateMatches = styles.match(/rotate\(90deg\)/g) || [];
assert.equal(rotateMatches.length, 1, '整个样式中只能存在一处受控兼容横屏旋转');

console.log('landscape lobby native-first with controlled fallback requirements passed');