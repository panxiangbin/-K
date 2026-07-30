import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const game = fs.readFileSync(new URL('./src/pages/Game.jsx', import.meta.url), 'utf8');
const behavior = fs.readFileSync(new URL('./src/game-landscape-tech-v2.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('./src/game-landscape-tech-v2.css', import.meta.url), 'utf8');
const audit = fs.readFileSync(new URL('./game-clean-live-audit-v2.mjs', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert.match(main, /installGameLandscapeTechV2/, 'main entry must install the tech landscape table runtime');
assert(main.indexOf("import './game-landscape-tech-v2.css';") > main.indexOf("import './forced-landscape-lobby-r3.css';"), 'tech game CSS must load after all legacy mobile/landscape patches');
assert.doesNotMatch(main, /game-landscape-clean-v1\.css/, 'obsolete cream/gold game CSS must not be loaded');
assert.match(behavior, /tech-landscape-v2/, 'runtime must expose the tech landscape release marker');
assert.match(behavior, /game-screen-tech-v2/, 'runtime must activate the tech game body class');
assert.match(behavior, /tech-toast-stack/, 'runtime must move temporary feedback away from the table');
assert.match(game, /tech-game-shell/, 'Game component must render the new dedicated landscape shell');
assert.match(game, /tech-trick-grid/, 'Game component must render one compact horizontal action strip');
assert.match(game, /tech-hand-surface/, 'Game component must render a dedicated full-width hand surface');
assert.match(styles, /grid-template-rows: var\(--tech-header-h\) minmax\(0, 1fr\) var\(--tech-dock-h\)/, 'table must use a clear header/stage/hand hierarchy');
assert.match(styles, /linear-gradient\(145deg, #0d4650/, 'table must use the clean technology teal palette');
assert.doesNotMatch(styles, /#f7f0df/, 'obsolete cream casino-like dock must not return');
assert.match(styles, /tech-trick-grid/, 'central action cells must use the compact horizontal strip');
assert.match(styles, /tech-actions/, 'all five play controls must share one row');
assert.match(styles, /tech-round-meta/, 'pattern summary must be explicitly styled and visible');
assert.match(audit, /playLegalTurn/, 'audit must perform real game actions');
assert.match(audit, /number <= 3/, 'audit must play at least three real turns');
assert.match(audit, /四王炸弹/, 'audit must stress the longest pattern summary label');
assert.match(audit, /八张同点炸弹/, 'audit must stress long trick-cell pattern labels');
assert.match(audit, /普通七张/, 'audit must stress the long selected-pattern status');
assert.match(pkg.scripts.test, /game-landscape-clean-v1\.test\.js/, 'full test suite must include tech game regression');
assert.match(pkg.scripts.test, /node --check game-clean-live-audit-v2\.mjs/, 'full test suite must syntax-check the final real-play audit');

console.log('tech landscape game V2 visual tests passed');
