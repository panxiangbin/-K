import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { materializeRecordedVoice } from './materialize-audio-asset.js';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'henan50k-audio-'));
const outputPath = path.join(tempDir, 'audio', 'voice.mp3');

try {
  const first = await materializeRecordedVoice({ outputPath });
  const second = await materializeRecordedVoice({ outputPath });
  const file = await readFile(outputPath);
  const info = await stat(outputPath);

  assert.ok(first.bytes > 1024, 'recorded voice must contain real audio data');
  assert.equal(second.bytes, first.bytes, 'materialization must be deterministic');
  assert.equal(info.size, first.bytes, 'written MP3 size must match decoded bytes');
  assert.ok(file.subarray(0, 3).toString('ascii') === 'ID3' || file[0] === 0xff, 'output must look like an MP3');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log('recorded voice asset tests passed');
