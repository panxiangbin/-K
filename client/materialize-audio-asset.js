import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.join(ROOT_DIR, 'src/assets/langaishouBase64.js');
const OUTPUT_DIR = path.join(ROOT_DIR, 'public/audio');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'langaishou-v2.mp3');

export async function materializeRecordedVoice({ sourcePath = SOURCE_PATH, outputPath = OUTPUT_PATH } = {}) {
  const source = await readFile(sourcePath, 'utf8');
  const match = source.match(/`([A-Za-z0-9+/=\r\n]+)`/);
  if (!match) throw new Error(`recorded voice Base64 payload missing: ${sourcePath}`);

  const payload = match[1].replace(/\s+/g, '');
  const audio = Buffer.from(payload, 'base64');
  if (audio.length < 1024) throw new Error(`recorded voice payload is unexpectedly small: ${audio.length} bytes`);
  if (audio.subarray(0, 3).toString('ascii') !== 'ID3' && audio[0] !== 0xff) {
    throw new Error('recorded voice payload is not a recognizable MP3');
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, audio);
  return { outputPath, bytes: audio.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await materializeRecordedVoice();
  console.log(`recorded voice materialized: ${result.bytes} bytes -> ${path.relative(ROOT_DIR, result.outputPath)}`);
}
