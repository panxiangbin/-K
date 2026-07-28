import assert from 'node:assert/strict';
import fs from 'node:fs';

const theme = fs.readFileSync(new URL('./src/ink-theme.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

for (const token of [
  '--ink-paper',
  '--ink-black',
  '--ink-pine',
  '--ink-gold',
  '--ink-cinnabar',
  '--ui-control-min',
]) {
  assert(theme.includes(token), `ink theme must define or preserve ${token}`);
}

for (const selector of [
  '.lobby-shell',
  '.lobby-panel',
  '.waiting-room-card',
  '.game-table-shell',
  '.game-table-trick-board',
  '.game-player-card',
  '.game-table-hand-dock',
  '.settlement-experience',
  '.rules-help-dialog',
]) {
  assert(theme.includes(selector), `ink theme must cover ${selector}`);
}

assert(theme.includes('@media (max-width: 680px)'), 'ink theme must include mobile adaptation');
assert(theme.includes('@media (orientation: landscape) and (max-height: 430px)'), 'ink theme must include low-height landscape adaptation');
assert(theme.includes('@media (prefers-contrast: more)'), 'ink theme must preserve high-contrast support');
assert(theme.includes('@media (prefers-reduced-motion: reduce)'), 'ink theme must preserve reduced-motion support');
assert(!theme.includes('url('), 'ink theme must not add image requests to the first screen');
assert.equal((theme.match(/{/g) || []).length, (theme.match(/}/g) || []).length, 'ink theme CSS braces must balance');

const themeImport = "import './ink-theme.css';";
assert(main.includes(themeImport), 'main entry must import the ink theme');
assert(main.indexOf(themeImport) > main.indexOf("import './settlement-experience.css';"), 'ink theme must load after existing page styles');
assert(packageJson.scripts.test.includes('ink-theme.test.js'), 'client test suite must include ink theme regression');

console.log('new Chinese ink theme regression passed');