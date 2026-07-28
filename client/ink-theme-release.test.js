import assert from 'node:assert/strict';
import fs from 'node:fs';

const behavior = fs.readFileSync(new URL('./src/ink-theme-release.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('./src/ink-theme-release.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert(behavior.includes("INK_THEME_ID = 'ink-06'"), 'runtime must identify the selected 06 theme');
assert(behavior.includes("INK_THEME_RELEASE = 'ink-06-r2'"), 'runtime must expose a visible release identifier');
assert(behavior.includes("badge.textContent = '新中式墨韵 · 06'"), 'lobby must visibly confirm the selected theme');
assert(behavior.includes('MutationObserverClass'), 'runtime must reapply theme markers after React page changes');

for (const selector of [
  'html[data-ui-theme="ink-06"] .lobby-brand',
  'html[data-ui-theme="ink-06"] .lobby-solo-button',
  'html[data-ui-theme="ink-06"] .lobby-action-grid',
  'html[data-ui-theme="ink-06"] .game-table-center-column::before',
  'html[data-ui-theme="ink-06"] .game-player-card',
  'html[data-ui-theme="ink-06"] .settlement-experience',
]) {
  assert(styles.includes(selector), `visible ink release must cover ${selector}`);
}

assert(styles.includes('@media (max-width: 680px)'), 'visible theme release must include phone layout changes');
assert(styles.includes('@media (orientation: landscape) and (max-height: 430px)'), 'visible theme release must include short landscape layout changes');
assert(!styles.includes('url('), 'visible theme release must not add first-screen image requests');
assert.equal((styles.match(/{/g) || []).length, (styles.match(/}/g) || []).length, 'visible theme CSS braces must balance');

assert(main.includes("import { installInkThemeRelease } from './ink-theme-release.js';"), 'main must load the theme runtime');
assert(main.includes("import './ink-theme-release.css';"), 'main must load the visible theme styles');
assert(main.indexOf("import './ink-theme-release.css';") > main.indexOf("import './ink-theme.css';"), 'visible release styles must load after the base theme');
assert(main.indexOf('installInkThemeRelease();') > main.indexOf('ReactDOM.createRoot'), 'runtime marker must be installed after app rendering starts');
assert(packageJson.scripts.test.includes('ink-theme-release.test.js'), 'client suite must run the visible theme release regression');

console.log('visible new Chinese ink theme release regression passed');
