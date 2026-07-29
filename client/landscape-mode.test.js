import assert from 'node:assert/strict';
import fs from 'node:fs';
import { shouldRequireLandscape } from './src/landscape-mode.js';

const behavior = fs.readFileSync(new URL('./src/landscape-mode.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('./src/landscape-mode.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('./public/manifest.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

assert.equal(shouldRequireLandscape({ innerWidth: 390, innerHeight: 844 }), true, 'phone portrait must require landscape');
assert.equal(shouldRequireLandscape({ innerWidth: 844, innerHeight: 390 }), false, 'phone landscape must reveal the game');
assert.equal(shouldRequireLandscape({ innerWidth: 1400, innerHeight: 1800 }), false, 'wide desktop portrait should not be blocked');
assert.equal(shouldRequireLandscape({ innerWidth: 900, innerHeight: 1200 }), true, 'narrow portrait desktop or tablet should receive the landscape gate');

assert.match(behavior, /LANDSCAPE_LAYOUT_RELEASE = 'landscape-r1'/, 'runtime must expose the landscape layout release');
assert.match(behavior, /screen\.orientation\.lock\('landscape'\)/, 'supported browsers should attempt a real landscape lock');
assert.match(behavior, /requestFullscreen/, 'orientation lock should be preceded by a user-triggered fullscreen attempt');
assert.match(behavior, /请横屏使用/, 'portrait gate must give a direct Chinese instruction');
assert.match(behavior, /手机请横过来，电脑请把浏览器窗口拉宽/, 'gate must explain both phone and desktop actions');
assert.match(behavior, /orientationchange/, 'runtime must update immediately after device rotation');
assert.match(behavior, /visualViewport/, 'runtime must follow the browser visual viewport');

assert.match(styles, /body\.landscape-gate-active #root/, 'portrait mode must hide the vertical application behind the gate');
assert.match(styles, /#henan50k-landscape-gate/, 'landscape gate must have dedicated styles');
assert.match(styles, /@media \(orientation: landscape\)/, 'landscape layout must have an explicit viewport rule');
assert.match(styles, /width: 100vw !important/, 'landscape shells must fill the full screen width');
assert.match(styles, /height: 100dvh !important/, 'landscape shells must fill the dynamic viewport height');
assert.match(styles, /\.game-table-shell/, 'landscape override must cover the game table');
assert.match(styles, /\.lobby-shell/, 'landscape override must cover the lobby');
assert.doesNotMatch(styles, /rotate\(90deg\)/, 'the app must not fake landscape by rotating a vertical page');

assert.match(main, /installLandscapeMode/, 'main entry must install landscape mode');
assert.match(main, /landscape-mode\.css/, 'main entry must load landscape styles last');
assert(main.indexOf("import './landscape-mode.css';") > main.indexOf("import './mobile-viewport-lock.css';"), 'landscape overrides must load after old mobile layout CSS');
assert.equal(manifest.orientation, 'landscape', 'installed/PWA mode must request landscape orientation');
assert.match(pkg.scripts.test, /landscape-mode\.test\.js/, 'full test suite must include landscape regression');

console.log('landscape-first mode tests passed');
