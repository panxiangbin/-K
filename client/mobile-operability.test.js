import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('./src/mobile-operability.css', import.meta.url), 'utf8');
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
  'grid-template-columns: repeat(5, minmax(0, 1fr))',
  'max-width: 100vw',
  'env(safe-area-inset-bottom)',
  '@media (orientation: landscape) and (max-height: 430px)',
]) {
  assert(css.includes(required), `mobile operability CSS must include ${required}`);
}

assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length, 'mobile operability CSS braces must balance');
assert(!css.includes('overflow-x: auto'), 'mobile lobby and game must not hide layout mistakes behind horizontal scrolling');
assert(main.includes("import './mobile-operability.css';"), 'main entry must load mobile operability CSS');
assert(main.indexOf("import './mobile-operability.css';") > main.indexOf("import './ink-theme-release.css';"), 'mobile operability CSS must load after the visible theme release');
assert(packageJson.scripts.test.includes('mobile-operability.test.js'), 'client test chain must include mobile operability regression');

console.log('mobile operability regression passed');
