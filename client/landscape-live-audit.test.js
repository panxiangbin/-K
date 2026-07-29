import assert from 'node:assert/strict';
import fs from 'node:fs';

const audit = fs.readFileSync(new URL('./landscape-live-audit.mjs', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert.match(audit, /chromium, webkit/, 'audit must load both Chromium and WebKit engines');
assert.match(audit, /chromium-android/, 'audit must cover an Android Chromium browser');
assert.match(audit, /webkit-iphone/, 'audit must cover an iPhone Safari-compatible WebKit browser');
assert.match(audit, /viewport: \{ width: 390, height: 844 \}/, 'audit must start from a standard portrait phone viewport');
assert.match(audit, /layoutMode === 'landscape-r3'/, 'audit must require the repaired forced-lobby release');
assert.match(audit, /force-landscape-active/, 'audit must require the fallback when the browser remains portrait');
assert.match(audit, /landscapePresentation === 'forced'/, 'audit must verify the forced landscape runtime marker');
assert.match(audit, /readForcedLobby/, 'audit must inspect the real forced lobby before navigation');
assert.match(audit, /gridTemplateColumns/, 'audit must reject the portrait one-column lobby inside forced landscape');
assert.match(audit, /panelScrollHeight <= metrics\.panelClientHeight \+ 2/, 'audit must reject a home screen that needs hidden scrolling');
assert.match(audit, /soloHit/, 'audit must prove the physical center of the solo button is hittable');
assert.match(audit, /choice3Hit/, 'audit must prove the physical center of the three-player option is hittable');
assert.match(audit, /\.lobby-solo-button'\)\.tap\(\)/, 'audit must use a real touch action on the visible solo button');
assert.match(audit, /\.lobby-choice-grid \.lobby-choice-card'\)\.first\(\)\.tap\(\)/, 'audit must touch the visible three-player option');
assert.match(audit, /targetCard\.tap\(\)/, 'audit must prove a card can be selected with touch in the transformed table');
assert.match(audit, /setViewportSize\(\{ width: 844, height: 390 \}\)/, 'audit must simulate a later real device rotation');
assert.match(audit, /landscapePresentation === 'native'/, 'audit must verify cleanup into native landscape');
assert.match(audit, /consoleErrors\.length === 0/, 'audit must reject console errors');
assert.match(audit, /requestFailures\.length === 0/, 'audit must reject request failures');
assert.match(pkg.scripts.test, /landscape-live-audit\.test\.js/, 'full suite must include the landscape audit contract');

console.log('landscape r3 visible lobby audit contract tests passed');
