import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync(new URL('./src/lobby-action-guidance.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('./src/lobby-action-guidance.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert.match(js, /联网入口正在等待服务器连接/, '首页必须解释联网按钮为什么暂时不可用');
assert.match(js, /创建或加入房间前需要填写昵称/, '首页必须解释昵称要求');
assert.match(js, /联网功能已可用/, '连接成功后必须确认操作已经可用');
assert.match(js, /服务器尚未连接，返回开始页等待连接/, '子页面的灰按钮必须显示可执行的返回建议');
assert.match(js, /aria-describedby/, '按钮必须关联可见的禁用原因');
assert.match(js, /aria-live', 'polite'/, '操作可用性变化必须支持读屏播报');
assert.match(js, /aria-label', '返回开始页'/, '返回按钮必须有明确可访问名称');

assert.match(css, /\.lobby-action-guidance/, '必须提供首页操作引导样式');
assert.match(css, /\.lobby-choice-guidance/, '必须提供选择页禁用原因样式');
assert.match(css, /font-size: 14px/, '手机端操作说明不能使用过小文字');
assert.match(css, /scroll-padding-block/, '容器必须给键盘焦点预留可见空间');
assert.match(css, /max-height: calc\(100dvh - 24px\)/, '低高度横屏必须允许面板内部安全滚动');
assert.match(css, /min-height: 44px/, '低高度横屏返回按钮必须保持触控基线');
assert.match(css, /prefers-reduced-motion/, '操作引导必须尊重减少动画设置');

assert.match(main, /lobby-action-guidance\.css/, '操作引导样式必须接入正式入口');
assert.match(main, /installLobbyActionGuidance/, '操作引导增强器必须接入正式入口');
assert.ok(pkg.scripts.test.includes('lobby-action-guidance.test.js'), '操作引导测试必须进入客户端测试链');

console.log('lobby action guidance tests passed');
