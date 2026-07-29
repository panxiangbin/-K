import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

assert.match(html, /viewport-fit=cover/, '手机页面必须保留安全区适配');
assert.doesNotMatch(html, /force-landscape/, '开始大厅和牌桌都不应再被旧代码强制旋转');
assert.doesNotMatch(html, /screen\.orientation\.lock/, '普通手机浏览器不应被强制锁定横屏');
assert.match(html, /syncViewportVars/, '仍需同步动态视口尺寸供手机布局使用');

console.log('portrait lobby tests passed');
