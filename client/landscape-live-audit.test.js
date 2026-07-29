import assert from 'node:assert/strict';
import fs from 'node:fs';

const audit = fs.readFileSync(new URL('./landscape-live-audit.mjs', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert.match(audit, /chromium, webkit/, 'audit must load both Chromium and WebKit engines');
assert.match(audit, /chromium-android/, 'audit must cover an Android Chromium browser');
assert.match(audit, /webkit-iphone/, 'audit must cover an iPhone Safari-compatible WebKit browser');
assert.match(audit, /viewport: \{ width: 390, height: 844 \}/, 'audit must start from a standard portrait phone viewport');
assert.match(audit, /force-landscape-active/, 'audit must require the fallback when the browser remains portrait');
assert.match(audit, /landscapePresentation === 'forced'/, 'audit must verify the forced landscape runtime marker');
assert.match(audit, /enterSoloGame/, 'audit must enter the actual three-player practice table');
assert.match(audit, /targetCard\.click\(\)/, 'audit must prove a card can be selected in the transformed table');
assert.match(audit, /setViewportSize\(\{ width: 844, height: 390 \}\)/, 'audit must simulate a later real device rotation');
assert.match(audit, /landscapePresentation === 'native'/, 'audit must verify cleanup into native landscape');
assert.match(audit, /consoleErrors\.length === 0/, 'audit must reject console errors');
assert.match(audit, /requestFailures\.length === 0/, 'audit must reject request failures');
assert.match(pkg.scripts.test, /landscape-live-audit\.test\.js/, 'full suite must include the landscape audit contract');

console.log('landscape r2 live audit contract tests passed');