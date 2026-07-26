import assert from 'node:assert/strict';
import {
  BOMB_SOUND_COOLDOWN_MS,
  SOUND_STORAGE_KEY,
  createPlaybackGate,
  getSoundButtonState,
  getSoundToggleResult,
  prefersReducedFeedback,
  readSoundPreference,
  writeSoundPreference,
} from './src/sound-feedback.js';

const values = new Map();
const storage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};

assert.equal(readSoundPreference(storage), false);
assert.equal(writeSoundPreference(storage, true), true);
assert.equal(values.get(SOUND_STORAGE_KEY), '1');
assert.equal(readSoundPreference(storage), true);
assert.equal(writeSoundPreference(storage, false), true);
assert.equal(values.get(SOUND_STORAGE_KEY), '0');

assert.deepEqual(getSoundButtonState(false, 'V2'), {
  label: '开启并测试炸弹人声V2',
  text: '开启人声V2',
  pressed: false,
  title: '点击后播放一次测试人声；浏览器允许播放后才会保存为开启',
});
assert.equal(getSoundButtonState(true).pressed, true);
assert.match(getSoundButtonState(true).label, /关闭炸弹人声/);

const enabled = getSoundToggleResult({ currentlyOn: false, playbackSucceeded: true });
assert.equal(enabled.enabled, true);
assert.equal(enabled.type, 'success');
assert.match(enabled.message, /刷新页面后仍保持开启/);

const blocked = getSoundToggleResult({ currentlyOn: false, playbackSucceeded: false });
assert.equal(blocked.enabled, false);
assert.equal(blocked.type, 'error');
assert.match(blocked.message, /手机未静音/);

const disabled = getSoundToggleResult({ currentlyOn: true, playbackSucceeded: true });
assert.equal(disabled.enabled, false);
assert.match(disabled.message, /仍保持关闭/);

let time = 1000;
const gate = createPlaybackGate({ now: () => time });
assert.equal(gate.tryStart(), true);
time += BOMB_SOUND_COOLDOWN_MS - 1;
assert.equal(gate.tryStart(), false);
time += 1;
assert.equal(gate.tryStart(), true);
gate.reset();
assert.equal(gate.tryStart(), true);

assert.equal(prefersReducedFeedback(() => ({ matches: true })), true);
assert.equal(prefersReducedFeedback(() => ({ matches: false })), false);
assert.equal(prefersReducedFeedback(() => { throw new Error('blocked'); }), false);

console.log('sound feedback tests passed');
