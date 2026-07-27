import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('./src/lobby-entry-feedback.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('./src/lobby-entry-feedback.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');

assert.match(js, /aria-invalid/, '昵称和房间号错误必须提供程序化错误状态');
assert.match(js, /请先填写昵称，再使用联网功能。/, '昵称错误必须提供明确中文说明');
assert.match(js, /还差\$\{6 - length\}位数字/, '房间号应实时说明还差几位');
assert.match(js, /aria-live', 'polite'/, '连接和字段反馈必须支持读屏播报');
assert.match(js, /window\.visualViewport/, '手机键盘弹出时应跟踪可视视口');
assert.match(js, /keyboardHeight > 120/, '应使用稳定阈值识别软键盘占用空间');
assert.match(js, /aria-busy/, '请求进行中按钮必须暴露忙碌状态');
assert.match(js, /服务器正在启动，联网功能稍后可用/, '冷启动时应给用户明确说明');
assert.match(js, /游戏服务器已连接/, '连接成功后应显示可理解状态');
assert.doesNotMatch(js, /alert\(/, '反馈增强不得使用阻塞式提示');

assert.match(css, /\.lobby-connection-summary/, '首页应有独立连接状态条');
assert.match(css, /input\[aria-invalid="true"\]/, '错误输入应有非颜色之外的边框状态');
assert.match(css, /\.lobby-inline-message\.error/, '错误输入应显示文字提示');
assert.match(css, /data-keyboard-open="true"/, '软键盘打开时应启用紧凑布局');
assert.match(css, /env\(safe-area-inset-bottom\)/, '键盘布局仍需避开底部安全区');
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, '忙碌动画必须支持减少动画');

assert.match(main, /installLobbyEntryFeedback/, '大厅反馈增强必须安装到正式入口');
assert.match(main, /import '\.\/lobby-entry-feedback\.css';/, '大厅反馈样式必须进入正式入口');

console.log('lobby entry feedback tests passed');
