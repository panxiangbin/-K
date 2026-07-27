import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./src/game-table-foundation.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('./src/game-table-foundation.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert.match(source, /game-table-shell/);
assert.match(source, /game-table-stage/);
assert.match(source, /game-table-hand-dock/);
assert.match(source, /game-table-trick-board/);
assert.match(source, /aria-live/);
assert.match(source, /data\.turnState|dataset\.turnState/);
assert.doesNotMatch(source, /setInterval\s*\(/);

assert.match(css, /--table-side-w:\s*clamp\(/);
assert.match(css, /grid-template-columns:\s*var\(--table-side-w\) minmax\(0, 1fr\) var\(--table-side-w\)/);
assert.match(css, /env\(safe-area-inset-top\)/);
assert.match(css, /env\(safe-area-inset-bottom\)/);
assert.match(css, /min-height:\s*44px\s*!important/);
assert.match(css, /\.game-table-hand-dock \.btn-play[\s\S]*min-height:\s*50px\s*!important/);
assert.match(css, /orientation:\s*landscape[\s\S]*max-height:\s*430px/);
assert.match(css, /\.game-table-hand-dock \.btn-play[\s\S]*min-height:\s*44px\s*!important/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.doesNotMatch(css, /backdrop-filter/);
assert.doesNotMatch(css, /#7c3aed|#8b5cf6|#6366f1/i);

assert.match(main, /installGameTableFoundation/);
assert.match(main, /game-table-foundation\.css/);
assert.ok(pkg.scripts.test.includes('game-table-foundation.test.js'));

console.log('game table foundation tests passed');
