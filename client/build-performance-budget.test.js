import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';

const DIST_DIR = new URL('./dist/', import.meta.url);
const MANIFEST_PATH = new URL('./dist/.vite/manifest.json', import.meta.url);
const RECORDED_AUDIO_PATH = new URL('./dist/audio/langaishou-v2.mp3', import.meta.url);
const INITIAL_JS_BUDGET = 350 * 1024;
const SINGLE_INITIAL_CHUNK_BUDGET = 220 * 1024;
const MAX_RECORDED_AUDIO_BYTES = 512 * 1024;

async function fileSize(relativePath) {
  const fileUrl = new URL(relativePath, DIST_DIR);
  return (await stat(fileUrl)).size;
}

function collectInitialChunks(manifest, entryKey) {
  const visited = new Set();
  const files = new Set();

  function visit(key) {
    if (!key || visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    assert.ok(chunk, `manifest missing referenced chunk: ${key}`);
    if (chunk.file?.endsWith('.js')) files.add(chunk.file);
    for (const importedKey of chunk.imports || []) visit(importedKey);
  }

  visit(entryKey);
  return [...files];
}

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
const entryKey = Object.keys(manifest).find(key => manifest[key]?.isEntry);
assert.ok(entryKey, 'Vite manifest must contain an entry chunk');

const entry = manifest[entryKey];
assert.equal(entry.src, 'src/main.jsx', 'unexpected Vite entry source');

const initialFiles = collectInitialChunks(manifest, entryKey);
assert.ok(initialFiles.length >= 2, 'initial bundle should keep React vendor code in a separate cacheable chunk');

const vendorFile = initialFiles.find(file => /react-vendor/.test(file));
assert.ok(vendorFile, 'initial bundle must include the dedicated react-vendor chunk');

let initialBytes = 0;
for (const file of initialFiles) {
  const size = await fileSize(file);
  assert.ok(size <= SINGLE_INITIAL_CHUNK_BUDGET, `${file} is ${(size / 1024).toFixed(1)} KiB; initial chunks must stay below ${SINGLE_INITIAL_CHUNK_BUDGET / 1024} KiB`);
  initialBytes += size;
}
assert.ok(initialBytes <= INITIAL_JS_BUDGET, `initial JavaScript is ${(initialBytes / 1024).toFixed(1)} KiB; budget is ${INITIAL_JS_BUDGET / 1024} KiB`);

const assetFiles = await readdir(new URL('./dist/assets/', import.meta.url));
assert.equal(assetFiles.some(file => file.endsWith('.map')), false, 'production build must not publish source maps');

const gameChunk = Object.values(manifest).find(chunk => chunk.src === 'src/pages/Game.jsx');
const settlementChunk = Object.values(manifest).find(chunk => chunk.src === 'src/pages/Settlement.jsx');
const base64AudioChunk = Object.values(manifest).find(chunk => chunk.src === 'src/assets/langaishouBase64.js');
assert.ok(gameChunk?.isDynamicEntry, 'game screen must remain a dynamic entry');
assert.ok(settlementChunk?.isDynamicEntry, 'settlement screen must remain a dynamic entry');
assert.equal(base64AudioChunk, undefined, 'Base64 recorded audio must not be shipped as JavaScript');
assert.equal(initialFiles.includes(gameChunk.file), false, 'game screen must not be in the initial JavaScript closure');
assert.equal(initialFiles.includes(settlementChunk.file), false, 'settlement screen must not be in the initial JavaScript closure');

const recordedAudio = await readFile(RECORDED_AUDIO_PATH);
assert.ok(recordedAudio.length > 1024, 'standalone recorded voice must contain real audio data');
assert.ok(recordedAudio.length <= MAX_RECORDED_AUDIO_BYTES, `recorded voice is ${(recordedAudio.length / 1024).toFixed(1)} KiB; budget is ${MAX_RECORDED_AUDIO_BYTES / 1024} KiB`);
assert.ok(recordedAudio.subarray(0, 3).toString('ascii') === 'ID3' || recordedAudio[0] === 0xff, 'standalone recorded voice must be an MP3');

console.log(`build performance budget passed: ${(initialBytes / 1024).toFixed(1)} KiB initial JS across ${initialFiles.length} chunks; ${(recordedAudio.length / 1024).toFixed(1)} KiB audio outside JavaScript`);
