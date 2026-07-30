import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const behavior = fs.readFileSync(new URL('./src/game-landscape-clean-v1.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('./src/game-landscape-clean-v1.css', import.meta.url), 'utf8');
const audit = fs.readFileSync(new URL('./game-clean-live-audit.mjs', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert.match(main, /installGameLandscapeCleanV1/, 'main entry must install the clean landscape table enhancer');
assert(main.indexOf("import './game-landscape-clean-v1.css';") > main.indexOf("import './forced-landscape-lobby-r3.css';"), 'clean game CSS must load after all legacy mobile/landscape patches');
assert.match(main, /game-landscape-clean-v1/, 'startup enhancer must be registered');
assert.match(behavior, /clean-landscape-v1/, 'runtime must expose the clean landscape release marker');
assert.match(behavior, /game-screen-clean-v1/, 'runtime must activate the clean game body class');
assert.match(behavior, /game-clean-toast-stack/, 'runtime must move toasts away from the table center');
assert.match(styles, /grid-template-rows: var\(--clean-header-h\) minmax\(0, 1fr\) var\(--clean-dock-h\)/, 'table must use a clear header/stage/hand hierarchy');
assert.match(styles, /background: #f7f0df !important/, 'hand dock must use a bright readable surface');
assert.match(styles, /game-clean-trick-board/, 'central trick board must receive a dedicated visual treatment');
assert.match(styles, /game-hand-actions/, 'all play controls must be laid out together');
assert.match(styles, /trick-board-summary__meta/, 'pattern summary must be explicitly styled');
assert.match(audit, /playOneLegalTurn/, 'audit must perform real game actions');
assert.match(audit, /index <= 3/, 'audit must play at least three real turns');
assert.match(audit, /四王炸弹/, 'audit must stress the longest pattern summary label');
assert.match(audit, /八张同点炸弹/, 'audit must stress long trick-cell pattern labels');
assert.match(audit, /普通七张/, 'audit must stress the long selected-pattern status');
assert.match(pkg.scripts.test, /game-landscape-clean-v1\.test\.js/, 'full test suite must include clean game regression');
assert.match(pkg.scripts.test, /node --check game-clean-live-audit\.mjs/, 'full test suite must syntax-check the real-play audit');

console.log('clean landscape game visual tests passed');
