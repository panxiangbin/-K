import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const jsx = readFileSync(new URL('./src/pages/Lobby.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./src/lobby-entry.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');

assert.match(jsx, /className="lobby-brand-mark"/, '首页应提供克制的品牌标记');
assert.match(jsx, /家乡规则，随时开一桌/, '首页应有简短且清楚的副标题');
assert.match(jsx, /选一种方式，马上开局/, '首页应有明确的任务标题');
assert.match(jsx, /和电脑直接开局/, '单机入口应说明结果');
assert.match(jsx, /邀请朋友加入/, '创建房间应有辅助说明');
assert.match(jsx, /输入6位房间号/, '加入房间应有辅助说明');
assert.match(jsx, /document\.getElementById\('player-name'\)\?\.focus\(\)/, '缺少昵称时应把焦点移到输入框，而不是弹出阻塞提示');
assert.doesNotMatch(jsx, /alert\(/, '大厅不应使用阻塞式 alert 提示');
assert.doesNotMatch(jsx, /linear-gradient\(135deg,#f5c842,#d99920\)/, '大厅按钮不应继续使用旧的高饱和渐变');
assert.doesNotMatch(jsx, /#6d28d9|#0891b2|#9333ea/, '大厅不应继续混入蓝紫色操作按钮');
assert.match(jsx, /function StatusBox\(\{ children, danger = false \}\)/, '大厅应提供统一状态组件');
assert.match(jsx, /role="status"/, '统一状态组件应向辅助技术播报状态');
assert.match(jsx, /className=\{`lobby-status\$\{danger \? ' danger' : ''\}`\}/, '状态组件应支持普通和危险状态样式');
assert.match(jsx, /className="visually-hidden"/, '房间帮助文本应使用统一视觉隐藏类');

assert.match(css, /grid-template-columns:\s*minmax\(220px, 0\.75fr\) minmax\(320px, 1\.25fr\)/, '桌面首页应使用品牌区和操作区双栏布局');
assert.match(css, /@media \(max-width: 760px\)/, '首页必须有独立手机布局');
assert.match(css, /@media \(max-height: 500px\) and \(orientation: landscape\)/, '首页必须覆盖低高度横屏');
assert.match(css, /min-height:\s*50px;/, '主要输入和按钮应保持50px操作高度');
assert.match(css, /outline:\s*3px solid #f0d58e/, '大厅按钮应有明显键盘焦点');
assert.match(css, /padding:\s*18px 16px max\(22px, env\(safe-area-inset-bottom\)\)/, '手机首页应避开底部安全区');
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, '首页应支持减少动画偏好');
assert.doesNotMatch(css, /backdrop-filter/, '新首页不应使用玻璃拟态模糊');
assert.match(main, /import '\.\/lobby-entry\.css';/, '大厅样式必须进入正式入口');

console.log('lobby entry UI tests passed');
