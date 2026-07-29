import assert from 'node:assert/strict';
import fs from 'node:fs';

const audit = fs.readFileSync(new URL('./landscape-live-audit.mjs', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert.match(audit, /phone-portrait-390x844/, 'audit must cover a standard phone held vertically');
assert.match(audit, /tablet-portrait-820x1180/, 'audit must cover a portrait tablet or narrow desktop');
assert.match(audit, /phone-landscape-844x390/, 'audit must cover a standard landscape phone');
assert.match(audit, /large-phone-landscape-932x430/, 'audit must cover a large landscape phone');
assert.match(audit, /mode: 'gate'/, 'portrait profiles must validate the rotation gate');
assert.match(audit, /mode: 'game'/, 'landscape profiles must validate the real table');
assert.match(audit, /rootVisibility === 'hidden'/, 'portrait audit must ensure the old vertical lobby is hidden');
assert.match(audit, /shell\.width >= metrics\.viewport\.width - 2/, 'landscape audit must ensure the table fills the width');
assert.match(audit, /targetCard\.click\(\)/, 'landscape audit must prove a card can be selected');
assert.match(pkg.scripts.test, /landscape-live-audit\.test\.js/, 'full suite must include the landscape audit contract');

console.log('landscape live audit contract tests passed');
