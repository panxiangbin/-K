import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('./src/mobile-operability.css', import.meta.url), 'utf8');
const scrollHotfix = fs.readFileSync(new URL('./src/mobile-scroll-hotfix.css', import.meta.url), 'utf8');
const overlayCss = fs.readFileSync(new URL('./src/mobile-game-overlay.css', import.meta.url), 'utf8');
const layoutR4 = fs.readFileSync(new URL('./src/mobile-game-layout-r4.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

for (const required of [
  '@media (max-width: 680px) and (orientation: portrait)',
  'min-height: 100dvh',
  '.lobby-brand',
  'min-height: 168px',
  '.lobby-action-grid',
  'grid-template-columns: repeat(2, minmax(0, 1fr))',
  '.game-table-hand-dock > div:last-child',
  'max-width: 100vw',
  'env(safe-area-inset-bottom)',
  '@media (orientation: landscape) and (max-height: 430px)',
]) {
  assert(css.includes(required), `mobile operability CSS must include ${required}`);
}

for (const required of [
  'height: 100vh !important',
  'height: 100dvh !important',
  'overflow-y: auto !important',
  'overscroll-behavior-y: contain',
  'touch-action: pan-y',
  'overflow-x: auto !important',
  'touch-action: pan-x !important',
  'grid-template-columns: repeat(6, minmax(0, 1fr)) !important',
  'grid-column: span 2',
  'grid-column: span 4',
  '左右滑动查看全部手牌',
  'min-height: 52px !important',
]) {
  assert(scrollHotfix.includes(required), `mobile scroll and controls hotfix must include ${required}`);
}

for (const required of [
  'body:has(.game-table-shell) button[aria-label^="炸弹人声"]',
  '.rules-help-launcher[data-surface="game"]',
  'top: max(66px',
  'width: 40px !important',
  '@media (orientation: landscape) and (max-height: 430px)',
]) {
  assert(overlayCss.includes(required), `mobile overlay safeguards must include ${required}`);
}

for (const required of [
  'grid-template-rows: auto minmax(0, 1fr) auto !important',
  '.game-table-stage',
  'overflow: hidden !important',
  '.game-table-center-column',
  'grid-template-rows: minmax(38px, 14%) minmax(0, 1fr) !important',
  '.game-table-hand-dock',
  'grid-template-rows: auto minmax(88px, 108px) auto !important',
  '.game-hand-selection-status',
  '.game-hand-surface[data-hand-scrolling="true"]',
  '-webkit-touch-callout: none',
  '@media (max-width: 680px) and (orientation: portrait) and (max-height: 740px)',
]) {
  assert(layoutR4.includes(required), `mobile R4 layout must include ${required}`);
}

assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length, 'mobile operability CSS braces must balance');
assert.equal((scrollHotfix.match(/{/g) || []).length, (scrollHotfix.match(/}/g) || []).length, 'mobile scroll hotfix CSS braces must balance');
assert.equal((overlayCss.match(/{/g) || []).length, (overlayCss.match(/}/g) || []).length, 'mobile overlay CSS braces must balance');
assert.equal((layoutR4.match(/{/g) || []).length, (layoutR4.match(/}/g) || []).length, 'mobile R4 layout CSS braces must balance');
assert(!scrollHotfix.includes('grid-template-columns: repeat(5, minmax(0, 1fr))'), 'portrait hotfix must not force five actions into one cramped row');
assert(!/(^|\n)\s*height:\s*auto\s*!important/.test(scrollHotfix), 'mobile lobby scroll container must have a bounded viewport height');
assert(main.includes("import './mobile-operability.css';"), 'main entry must load mobile operability CSS');
assert(main.includes("import './mobile-scroll-hotfix.css';"), 'main entry must load mobile scroll hotfix CSS');
assert(main.includes("import './mobile-game-overlay.css';"), 'main entry must load mobile overlay safeguards');
assert(main.includes("import './mobile-game-layout-r4.css';"), 'main entry must load the stable mobile R4 layout');
assert(main.indexOf("import './mobile-scroll-hotfix.css';") > main.indexOf("import './mobile-operability.css';"), 'mobile scroll hotfix must load after mobile layout CSS');
assert(main.indexOf("import './mobile-game-overlay.css';") > main.indexOf("import './mobile-scroll-hotfix.css';"), 'overlay safeguards must load after scroll hotfix');
assert(main.indexOf("import './mobile-game-layout-r4.css';") > main.indexOf("import './mobile-game-overlay.css';"), 'mobile R4 layout must be the final mobile authority');
assert(main.indexOf("import './mobile-operability.css';") > main.indexOf("import './ink-theme-release.css';"), 'mobile operability CSS must load after the visible theme release');
assert(packageJson.scripts.test.includes('mobile-operability.test.js'), 'client test chain must include mobile operability regression');

console.log('mobile operability regression passed');
