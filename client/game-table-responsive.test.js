import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('./src/game-table-responsive.css', import.meta.url), 'utf8');

assert.match(css, /max-width:\s*520px[\s\S]*orientation:\s*portrait/, '应覆盖窄屏竖屏牌桌顶部栏');
assert.match(css, /max-height:\s*430px[\s\S]*orientation:\s*landscape/, '应覆盖低高度横屏');
assert.match(css, /grid-template-areas:[\s\S]*actions turn[\s\S]*room room/, '竖屏应把房间信息放到独立一行');
assert.match(css, /text-overflow:\s*ellipsis/, '长房间信息和行动昵称应安全截断');
assert.match(css, /env\(safe-area-inset-left\)/, '顶部栏应尊重左侧安全区');
assert.match(css, /env\(safe-area-inset-right\)/, '顶部栏应尊重右侧安全区');
assert.match(css, /\.top-action[\s\S]*min-width:\s*44px/, '低高度横屏按钮点击宽度不能小于44px');
assert.doesNotMatch(css, /--card-w\s*:/, '本模块不得为了顶部栏适配缩小扑克牌');
assert.doesNotMatch(css, /--card-h\s*:/, '本模块不得为了顶部栏适配压低扑克牌');

console.log('game table responsive tests passed');
