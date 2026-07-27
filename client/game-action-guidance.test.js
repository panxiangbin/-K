import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync(new URL('./src/game-action-guidance.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('./src/game-action-guidance.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert.match(js, /所选牌型不合法/);
assert.match(js, /所选牌暂时不能压过上一手/);
assert.match(js, /你是本轮先手，必须出牌，不能过牌/);
assert.match(js, /如有合法更大牌必须压牌/);
assert.match(js, /当前显示提示候选 \$\{hintProgress\.current\}\/\$\{hintProgress\.total\}/);
assert.match(js, /连续点击可依次查看其他候选/);
assert.match(js, /aria-describedby/);
assert.match(js, /role', 'status'/);
assert.match(js, /aria-live', 'polite'/);
assert.match(js, /attributeFilter: \['disabled', 'aria-busy'\]/);
assert.doesNotMatch(js, /setInterval\(/);

assert.match(css, /min-height: 34px/);
assert.match(css, /font-size: 13px/);
assert.match(css, /outline: 3px solid/);
assert.match(css, /max-width: 480px/);
assert.match(css, /max-height: 430px/);
assert.match(css, /prefers-contrast: more/);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(css, /backdrop-filter/);
assert.doesNotMatch(css, /#[0-9a-fA-F]{6}.*(?:7c3aed|0891b2|60a5fa)/);

assert.match(main, /installGameActionGuidance/);
assert.match(main, /game-action-guidance\.css/);
assert.ok(pkg.scripts.test.includes('game-action-guidance.test.js'));

console.log('game action guidance regression checks passed');