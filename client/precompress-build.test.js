import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { precompressDirectory } from './precompress-build.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'henan-50k-compress-'));
try {
  const assetsDir = path.join(tempDir, 'assets');
  const audioDir = path.join(tempDir, 'audio');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(audioDir, { recursive: true });

  const jsSource = Buffer.from('const message = "河南五十K";\n'.repeat(1200));
  const cssSource = Buffer.from('.card{display:flex;align-items:center;}\n'.repeat(900));
  const htmlSource = Buffer.from('<main>河南五十K</main>\n'.repeat(700));
  const mp3Source = Buffer.alloc(16 * 1024, 0x55);

  fs.writeFileSync(path.join(assetsDir, 'app.abc123.js'), jsSource);
  fs.writeFileSync(path.join(assetsDir, 'app.abc123.css'), cssSource);
  fs.writeFileSync(path.join(tempDir, 'index.html'), htmlSource);
  fs.writeFileSync(path.join(audioDir, 'voice-v2.mp3'), mp3Source);
  fs.writeFileSync(path.join(assetsDir, 'tiny.js'), 'export default 1;');

  const result = precompressDirectory(tempDir);
  assert.equal(result.brotli, 3);
  assert.equal(result.gzip, 3);

  for (const filePath of [
    path.join(assetsDir, 'app.abc123.js'),
    path.join(assetsDir, 'app.abc123.css'),
    path.join(tempDir, 'index.html'),
  ]) {
    assert.deepEqual(zlib.brotliDecompressSync(fs.readFileSync(`${filePath}.br`)), fs.readFileSync(filePath));
    assert.deepEqual(zlib.gunzipSync(fs.readFileSync(`${filePath}.gz`)), fs.readFileSync(filePath));
    assert.ok(fs.statSync(`${filePath}.br`).size < fs.statSync(filePath).size);
    assert.ok(fs.statSync(`${filePath}.gz`).size < fs.statSync(filePath).size);
  }

  assert.equal(fs.existsSync(path.join(audioDir, 'voice-v2.mp3.br')), false);
  assert.equal(fs.existsSync(path.join(audioDir, 'voice-v2.mp3.gz')), false);
  assert.equal(fs.existsSync(path.join(assetsDir, 'tiny.js.br')), false);

  const secondRun = precompressDirectory(tempDir);
  assert.equal(secondRun.brotli, 3);
  assert.equal(secondRun.gzip, 3);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

assert.throws(() => precompressDirectory(''), /构建目录不存在/);
console.log('precompress build tests passed');
