import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clampHandScroll } from './src/game-hand-controls-experience.js';

const source = fs.readFileSync(new URL('./src/game-hand-controls-experience.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('./src/game-hand-controls-experience.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert.equal(clampHandScroll({ scrollWidth: 1000, clientWidth: 300 }, 0, -220), 220, 'leftward finger movement should scroll the hand right');
assert.equal(clampHandScroll({ scrollWidth: 1000, clientWidth: 300 }, 680, -100), 700, 'hand scrolling must clamp to the maximum');
assert.equal(clampHandScroll({ scrollWidth: 1000, clientWidth: 300 }, 10, 100), 0, 'hand scrolling must clamp to zero');

assert.match(source, /SLIDE_INTENT_PX = 9/, 'mouse slide selection should require deliberate movement');
assert.match(source, /TOUCH_CLICK_SUPPRESSION_MS = 420/, 'touch swipes should suppress the synthetic follow-up click');
assert.match(source, /Math\.hypot/, 'slide intent should use pointer distance rather than any micro movement');
assert.match(source, /Math\.abs\(dx\) >= Math\.abs\(dy\)/, 'touch guard should only commit horizontal hand browsing');
assert.match(source, /inputType: event\.pointerType \|\| 'mouse'/, 'slide guard must remember the pointer input device');
assert.match(source, /pointerActive\.inputType !== 'mouse'/, 'touch and pen pointer movement must be reserved for hand scrolling');
assert.match(source, /startScrollLeft: Number\(surface\.scrollLeft\) \|\| 0/, 'touch browsing must remember the starting scroll position');
assert.match(source, /clampHandScroll\(gesture\.surface, gesture\.startScrollLeft, dx\)/, 'pointer and touch paths must share bounded scroll math');
assert.match(source, /gesture\.surface\.scrollLeft = targetScrollLeft/, 'touch browsing must provide a direct scroll fallback');
assert.match(source, /root\.addEventListener\('touchstart'/, 'real mobile touchstart events must be handled');
assert.match(source, /root\.addEventListener\('touchmove'/, 'real mobile touchmove events must be handled');
assert.match(source, /passive: false/, 'touchmove listener must be allowed to cancel card selection and drive scrolling');
assert.match(source, /event\.changedTouches/, 'touchend and touchcancel must clear the matching gesture');
assert.match(source, /suppressClickUntil/, 'touch swipe guard must remember a short click suppression window');
assert.match(source, /dataset\.handScrolling = 'true'/, 'hand surface should expose its active scrolling state');
assert.match(source, /root\.addEventListener\('click'/, 'the guard must intercept the synthetic click after a swipe');
assert.match(source, /event\.preventDefault\(\)/, 'committed touch browsing and its synthetic click must be cancelled before card selection');
assert.match(source, /event\.stopImmediatePropagation\(\)/, 'touch movement and synthetic clicks must not reach React card selection');
assert.match(source, /左右滑动查看全部手牌/, 'mobile accessibility instructions must explain horizontal hand browsing');
assert.match(source, /pointercancel/, 'pointer cancellation must clear slide intent state');
assert.match(source, /touchcancel/, 'touch cancellation must clear slide intent state');
assert.match(source, /cleanupSlideGuard/, 'enhancer cleanup must remove gesture listeners');
assert.match(source, /role', 'group'/, 'hand actions should expose grouped semantics');
assert.match(source, /aria-label', '手牌操作'/, 'hand action group should have a clear accessible name');
assert.match(source, /role', 'status'/, 'selection summary should be announced as status');
assert.match(source, /aria-live', 'polite'/, 'selection summary should update without stealing focus');
assert.doesNotMatch(source, /setInterval/, 'enhancer must not use continuous polling');

assert.match(css, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/, 'base mobile controls should use a two-row six-column grid');
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
