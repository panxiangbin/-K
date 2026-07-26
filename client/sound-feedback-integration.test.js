import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('./src/App.jsx', import.meta.url), 'utf8');

assert.match(app, /from '\.\/sound-feedback\.js'/, 'App must use the shared sound feedback module');
assert.match(app, /readSoundPreference\(localStorage\)/, 'saved sound preference must be restored');
assert.match(app, /writeSoundPreference\(localStorage, result\.enabled\)/, 'toggle result must be persisted');
assert.match(app, /aria-pressed=\{soundButton\.pressed\}/, 'sound button must expose its state');
assert.match(app, /onClick=\{toggleSound\}/, 'sound button must support both enabling and disabling');
assert.match(app, /bombPlaybackGate\.current\?\.tryStart\(\)/, 'bomb voice must be protected from rapid duplicate playback');
assert.match(app, /setSoundOn\(false\)/, 'autoplay failure must disable the saved sound state');
assert.match(app, /reducedFeedback\.current \? 'none' : 'floatUp/, 'reduced motion must suppress toast animation');
assert.doesNotMatch(app, /可在大厅开启炸弹人声/, 'every bomb must not repeat the same sound promotion');
assert.doesNotMatch(app, /setSoundOn\(true\);\s*const ok = await playBombLine/, 'sound must not be marked enabled before the test succeeds');

console.log('sound feedback integration tests passed');
