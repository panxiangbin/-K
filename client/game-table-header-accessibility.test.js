import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('./src/game-table-responsive.css', import.meta.url), 'utf8');

assert.match(css, /\.top-action:focus-visible\s*\{[\s\S]*outline:\s*3px solid #fbbf24/i, '顶部按钮必须有清晰的键盘焦点环');
assert.match(css, /touch-action:\s*manipulation/i, '顶部按钮应优化移动端点击响应');
assert.match(css, /@media \(max-width:\s*390px\) and \(orientation:\s*portrait\)/i, '必须覆盖390px竖屏');
assert.match(css, /@media \(max-height:\s*390px\) and \(orientation:\s*landscape\)/i, '必须覆盖低高度横屏');
assert.match(css, /grid-template-columns:\s*minmax\(96px, auto\) minmax\(0, 1fr\)/i, '窄屏应保证操作按钮空间并允许行动文字收缩');
assert.match(css, /padding-left:\s*max\(6px, env\(safe-area-inset-left\)\)/i, '窄屏必须保留左侧安全区');
assert.match(css, /padding-right:\s*max\(6px, env\(safe-area-inset-right\)\)/i, '窄屏必须保留右侧安全区');
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/i, '必须尊重减弱动态设置');
assert.doesNotMatch(css, /--card-(?:width|height)|\.card\s*\{[^}]*?(?:width|height)/i, '顶部栏优化不能缩小扑克牌');

console.log('game table header accessibility tests passed');
