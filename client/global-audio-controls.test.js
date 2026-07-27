import fs from 'node:fs';
import assert from 'node:assert/strict';
import { getSoundButtonState } from './src/sound-feedback.js';

const css = fs.readFileSync(new URL('./src/global-audio-controls.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const on = getSoundButtonState(true, 'V2');
const off = getSoundButtonState(false, 'V2');

assert.equal(on.label, off.label, 'toggle accessible name must stay stable');
assert.equal(on.label, '炸弹人声V2');
assert.equal(on.pressed, true);
assert.equal(off.pressed, false);
assert.match(on.text, /人声：开/);
assert.match(off.text, /人声：关/);
assert.match(on.statusText, /已开启/);
assert.match(off.statusText, /已关闭/);

assert.match(css, /aria-label\^="炸弹人声"/);
assert.match(css, /min-height:\s*44px\s*!important/);
assert.match(css, /safe-area-inset-right/);
assert.match(css, /aria-pressed="true"/);
assert.match(css, /aria-pressed="false"/);
assert.match(css, /focus-visible/);
assert.match(css, /outline:\s*3px/);
assert.match(css, /orientation:\s*landscape/);
assert.match(css, /min-height:\s*40px\s*!important/);
assert.match(css, /prefers-contrast:\s*more/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.doesNotMatch(css, /backdrop-filter|backdropFilter/);
assert.doesNotMatch(css, /#(?:7c3aed|8b5cf6|6366f1|2563eb)/i);

assert.match(main, /global-audio-controls\.css/);
assert.match(packageJson.scripts.test, /global-audio-controls\.test\.js/);

console.log('global audio controls tests passed');
