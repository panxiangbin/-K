import assert from 'node:assert/strict';
import fs from 'node:fs';

const logic = fs.readFileSync(new URL('./src/game-player-card-experience.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('./src/game-player-card-experience.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert.match(logic, /PLAYER_STATE_LABELS/);
assert.match(logic, /current:\s*'出牌中'/);
assert.match(logic, /offline:\s*'离线'/);
assert.match(logic, /recovering:\s*'恢复中'/);
assert.match(logic, /finished:\s*'已出完'/);
assert.match(logic, /left:\s*'已退出'/);
assert.match(logic, /setAttribute\('role', 'group'\)/);
assert.match(logic, /setAttribute\('aria-label'/);
assert.match(logic, /attributeFilter:\s*\['style', 'class'\]/);
assert.doesNotMatch(logic, /setInterval\s*\(/);

assert.match(css, /\.game-player-card\[data-player-state='current'\]/);
assert.match(css, /\.game-player-card\[data-player-state='offline'\]/);
assert.match(css, /border-style:\s*dashed/);
assert.match(css, /\.game-player-card__state/);
assert.match(css, /background:\s*#d8b25e/);
assert.match(css, /animation:\s*none\s*!important/);
assert.match(css, /@media \(max-width:\s*520px\)/);
assert.match(css, /@media \(max-height:\s*430px\) and \(orientation:\s*landscape\)/);
assert.match(css, /@media \(prefers-contrast:\s*more\)/);
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
assert.doesNotMatch(css, /#7c3aed|#0891b2/);
assert.doesNotMatch(css, /backdrop-filter/);

assert.match(main, /game-player-card-experience\.js/);
assert.match(main, /game-player-card-experience\.css/);
assert.match(main, /installGamePlayerCardExperience\(\)/);
assert.ok(pkg.scripts.test.includes('game-player-card-experience.test.js'));

console.log('game player card experience tests passed');