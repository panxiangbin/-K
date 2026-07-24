import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const COMPRESSIBLE_EXTENSIONS = new Set([
  '.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml',
]);
const MIN_SOURCE_BYTES = 1024;
const MIN_SAVINGS_RATIO = 0.05;

function shouldCompress(filePath, size) {
  return size >= MIN_SOURCE_BYTES
    && COMPRESSIBLE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
    && !filePath.endsWith('.br')
    && !filePath.endsWith('.gz');
}

function writeIfWorthwhile(targetPath, sourceSize, compressed) {
  if (compressed.length >= sourceSize * (1 - MIN_SAVINGS_RATIO)) {
    try { fs.rmSync(targetPath); } catch {}
    return false;
  }
  fs.writeFileSync(targetPath, compressed);
  return true;
}

export function precompressDirectory(rootDir) {
  if (!rootDir || !fs.existsSync(rootDir)) {
    throw new Error(`构建目录不存在: ${rootDir || '(empty)'}`);
  }

  const result = { scanned: 0, brotli: 0, gzip: 0, skipped: 0 };
  const pending = [rootDir];

  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(filePath);
        continue;
      }
      if (!entry.isFile()) continue;

      const size = fs.statSync(filePath).size;
      result.scanned += 1;
      if (!shouldCompress(filePath, size)) {
        result.skipped += 1;
        continue;
      }

      const source = fs.readFileSync(filePath);
      const brotli = zlib.brotliCompressSync(source, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 9,
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        },
      });
      const gzip = zlib.gzipSync(source, { level: 9 });

      if (writeIfWorthwhile(`${filePath}.br`, size, brotli)) result.brotli += 1;
      else result.skipped += 1;
      if (writeIfWorthwhile(`${filePath}.gz`, size, gzip)) result.gzip += 1;
      else result.skipped += 1;
    }
  }

  return result;
}

const isCli = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const distDir = path.resolve(process.cwd(), process.argv[2] || 'dist');
  const result = precompressDirectory(distDir);
  console.log(`precompressed assets: br=${result.brotli}, gzip=${result.gzip}, scanned=${result.scanned}`);
}
