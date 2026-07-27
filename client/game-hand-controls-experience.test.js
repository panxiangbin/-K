import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./src/game-hand-controls-experience.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('./src/game-hand-controls-experience.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert.match(source, /SLIDE_INTENT_PX = 9/, 'slide selection should require deliberate movement');
assert.match(source, /Math\.hypot/, 'slide intent should use pointer distance rather than any micro movement');
assert.match(source, /stopImmediatePropagation/, 'micro movements must not reach the React slide selector');
assert.match(source, /pointercancel/, 'pointer cancellation must clear slide intent state');
assert.match(source, /role', 'group'/, 'hand actions should expose grouped semantics');
assert.match(source, /aria-label', '手牌操作'/, 'hand action group should have a clear accessible name');
assert.match(source, /role', 'status'/, 'selection summary should be announced as status');
assert.match(source, /aria-live', 'polite'/, 'selection summary should update without stealing focus');
assert.doesNotMatch(source, /setInterval/, 'enhancer must not use continuous polling');

assert.match(css, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/, 'mobile controls should use a two-row six-column grid');
assert.match(css, /grid-column: span 2/, 'utility and pass controls should occupy stable mobile columns');
assert.match(css, /grid-column: span 4/, 'primary play action should receive the largest mobile area');
assert.match(css, /min-height: 50px !important/, 'primary play action should remain at least 50px high');
assert.match(css, /min-height: 48px !important/, 'mobile secondary action should remain at least 48px high');
assert.match(css, /env\(safe-area-inset-bottom\)/, 'bottom controls must respect the gesture safe area');
assert.match(css, /outline: 3px solid/, 'controls should retain a visible keyboard focus indicator');
assert.match(css, /prefers-contrast: more/, 'high contrast users should receive stronger borders');
assert.match(css, /prefers-reduced-motion: reduce/, 'motion reduction must be supported');
assert.doesNotMatch(css, /backdrop-filter/, 'hand controls must not reintroduce glass effects');
assert.doesNotMatch(css, /#7c3aed|#8b5cf6|#3b82f6/i, 'hand controls must not reintroduce blue-purple neon styling');

assert.match(main, /installGameHandControlsExperience/, 'new hand control enhancer must be installed');
assert.match(main, /game-hand-controls-experience\.css/, 'new hand control stylesheet must be loaded');
assert.match(pkg.scripts.test, /game-hand-controls-experience\.test\.js/, 'new regression suite must run in npm test');

console.log('game hand controls experience tests passed');
