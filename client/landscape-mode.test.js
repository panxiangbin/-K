import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FORCE_LANDSCAPE_DELAY_MS, isNativeLandscape, shouldRequireLandscape } from './src/landscape-mode.js';

const behavior = fs.readFileSync(new URL('./src/landscape-mode.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('./src/landscape-mode.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('./public/manifest.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert.equal(shouldRequireLandscape({ innerWidth: 390, innerHeight: 844 }), true, 'phone portrait must require landscape');
assert.equal(shouldRequireLandscape({ innerWidth: 844, innerHeight: 390 }), false, 'phone landscape must reveal the game');
assert.equal(shouldRequireLandscape({ innerWidth: 1400, innerHeight: 1800 }), false, 'wide desktop portrait should not be blocked');
assert.equal(shouldRequireLandscape({ innerWidth: 900, innerHeight: 1200 }), true, 'narrow portrait desktop or tablet should receive the landscape gate');
assert.equal(isNativeLandscape({ innerWidth: 390, innerHeight: 844, orientation: 90 }), true, 'legacy iOS orientation angle must reveal landscape even while viewport dimensions lag');
assert.equal(isNativeLandscape({ innerWidth: 390, innerHeight: 844, matchMedia: () => ({ matches: true }) }), true, 'orientation media query must reveal landscape when visualViewport lags');
assert.equal(isNativeLandscape({ innerWidth: 390, innerHeight: 844, screen: { orientation: { angle: 90, type: 'portrait-primary' } } }), false, 'an inconsistent WebKit screen angle alone must not hide the portrait gate');
assert.equal(isNativeLandscape({ innerWidth: 390, innerHeight: 844, screen: { orientation: { angle: 0, type: 'landscape-primary' } } }), true, 'an explicit landscape orientation type may confirm landscape while dimensions lag');
assert.equal(FORCE_LANDSCAPE_DELAY_MS >= 300 && FORCE_LANDSCAPE_DELAY_MS <= 1000, true, 'fallback must engage quickly without racing native rotation');

assert.match(behavior, /LANDSCAPE_LAYOUT_RELEASE = 'landscape-r3'/, 'runtime must expose the repaired landscape lobby release');
assert.match(behavior, /screen\.orientation\.lock\('landscape'\)/, 'supported browsers should attempt a real landscape lock');
assert.match(behavior, /requestFullscreen/, 'orientation lock should be preceded by a user-triggered fullscreen attempt');
assert.match(behavior, /force-landscape-active/, 'runtime must provide a fallback when browsers reject direction lock');
assert.match(behavior, /直接进入横屏/, 'portrait gate must provide a reliable fallback entry');
assert.match(behavior, /orientationchange/, 'runtime must update immediately after device rotation');
assert.match(behavior, /matchMedia\?\.\('\(orientation: landscape\)'\)/, 'runtime must use the orientation media query for Safari viewport lag');
assert.match(behavior, /startsWith\('landscape'\)/, 'runtime must require an explicit modern orientation type instead of trusting angle alone');
assert.match(behavior, /typeof target\?\.orientation !== 'number'/, 'runtime must keep the legacy iOS orientation fallback separate');
assert.match(behavior, /visualViewport/, 'runtime must follow the browser visual viewport');
assert.match(behavior, /\[80, 250, 600, 1200\]/, 'runtime must resample delayed mobile viewport changes');

assert.match(styles, /body\.landscape-gate-active #root/, 'portrait mode must hide the vertical application behind the gate');
assert.match(styles, /body\.force-landscape-active #root/, 'fallback mode must reveal and rotate the actual app');
assert.match(styles, /rotate\(90deg\)/, 'fallback mode must rotate the landscape canvas when system rotation is locked');
assert.match(styles, /--forced-landscape-width/, 'fallback mode must swap viewport width and height');
assert.match(styles, /body\.force-landscape-active \.lobby-shell[\s\S]*grid-template-columns:/, 'forced landscape must override the portrait one-column lobby');
assert.match(styles, /body\.force-landscape-active \.lobby-main[\s\S]*overflow: hidden !important/, 'forced landscape must keep the main lobby inside the rotated viewport');
assert.match(styles, /body\.force-landscape-active \.lobby-panel[\s\S]*overflow-y: auto !important/, 'forced landscape must retain a safe inner scroll fallback');
assert.match(styles, /body\.force-landscape-active \.lobby-action-grid,[\s\S]*grid-template-columns: repeat\(2/, 'forced landscape must keep create and join actions side by side');
assert.match(styles, /@media \(orientation: landscape\)/, 'native landscape layout must have an explicit viewport rule');
assert.match(styles, /width: 100vw !important/, 'native landscape shells must fill the full screen width');
assert.match(styles, /height: 100dvh !important/, 'native landscape shells must fill the dynamic viewport height');
assert.match(styles, /\.game-table-shell/, 'landscape override must cover the game table');
assert.match(styles, /\.lobby-shell/, 'landscape override must cover the lobby');

assert.match(main, /installLandscapeMode/, 'main entry must install landscape mode');
assert.match(main, /landscape-mode\.css/, 'main entry must load landscape styles last');
assert(main.indexOf("import './landscape-mode.css';") > main.indexOf("import './mobile-viewport-lock.css';"), 'landscape overrides must load after old mobile layout CSS');
assert.equal(manifest.orientation, 'landscape', 'installed/PWA mode must request landscape orientation');
assert.match(pkg.scripts.test, /landscape-mode\.test\.js/, 'full test suite must include landscape regression');

console.log('landscape fallback lobby tests passed');
