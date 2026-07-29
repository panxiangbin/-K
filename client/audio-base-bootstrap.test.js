import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveNestedAudioUrl } from './src/audio-base-bootstrap.js';

assert.equal(resolveNestedAudioUrl('/audio/langaishou-v2.mp3', {
  hostname: 'panxiangbin.github.io',
  pathname: '/pan/50k/',
  href: 'https://panxiangbin.github.io/pan/50k/',
}), '/pan/50k/audio/langaishou-v2.mp3');
assert.equal(resolveNestedAudioUrl('/audio/langaishou-v2.mp3', {
  hostname: '127.0.0.1', pathname: '/pan/50k/', href: 'http://127.0.0.1/pan/50k/',
}), '/audio/langaishou-v2.mp3');
assert.equal(resolveNestedAudioUrl('/icons/a.svg', {
  hostname: 'panxiangbin.github.io', pathname: '/pan/50k/', href: 'https://panxiangbin.github.io/pan/50k/',
}), '/icons/a.svg');

const main = fs.readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');
assert.match(main, /installNestedAudioBase\(\)/);
console.log('nested audio base tests passed');
