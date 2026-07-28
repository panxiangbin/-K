const fs = require('fs');

const UI_RELEASE = 'ink-06-r2';
const MEDIA_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.webm']);
const COMPRESSIBLE_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml']);
const STATIC_ASSET_EXTENSIONS = new Set([
  '.js', '.mjs', '.css', '.map', '.json',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.otf',
  ...MEDIA_EXTENSIONS,
]);

function getExtension(filePath) {
  const normalized = String(filePath || '').toLowerCase().split(/[?#]/, 1)[0];
  const lastDot = normalized.lastIndexOf('.');
  const lastSlash = normalized.lastIndexOf('/');
  return lastDot > lastSlash ? normalized.slice(lastDot) : '';
}

function isMediaFile(filePath) {
  return MEDIA_EXTENSIONS.has(getExtension(filePath));
}

function isCompressibleFile(filePath) {
  return COMPRESSIBLE_EXTENSIONS.has(getExtension(filePath));
}

function isStaticAssetRequest(requestPath) {
  const normalized = String(requestPath || '').toLowerCase().split(/[?#]/, 1)[0];
  return normalized.startsWith('/assets/')
    || normalized.startsWith('/audio/')
    || STATIC_ASSET_EXTENSIONS.has(getExtension(normalized));
}

function parseEncodingQuality(headerValue) {
  const qualities = new Map();
  for (const part of String(headerValue || '').toLowerCase().split(',')) {
    const [namePart, ...params] = part.trim().split(';');
    if (!namePart) continue;
    let quality = 1;
    for (const param of params) {
      const match = param.trim().match(/^q=(0(?:\.\d+)?|1(?:\.0+)?)$/);
      if (match) quality = Number(match[1]);
    }
    qualities.set(namePart, quality);
  }
  return qualities;
}

function selectPrecompressedEncoding(headerValue) {
  const qualities = parseEncodingQuality(headerValue);
  const wildcard = qualities.get('*') || 0;
  const br = qualities.has('br') ? qualities.get('br') : wildcard;
  const gzip = qualities.has('gzip') ? qualities.get('gzip') : wildcard;
  if (br <= 0 && gzip <= 0) return null;
  return br >= gzip ? 'br' : 'gzip';
}

function appendVary(res, value) {
  const existing = typeof res.getHeader === 'function' ? res.getHeader('Vary') : undefined;
  const values = new Set(String(existing || '').split(',').map((item) => item.trim()).filter(Boolean));
  values.add(value);
  res.setHeader('Vary', Array.from(values).join(', '));
}

function applyHtmlNoStoreHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Henan50K-Release', UI_RELEASE);
}

function applyCompressedHeaders(res, originalPath, encoding) {
  res.setHeader('Content-Encoding', encoding);
  appendVary(res, 'Accept-Encoding');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (originalPath.endsWith('.html')) {
    applyHtmlNoStoreHeaders(res);
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  if (typeof res.type === 'function') res.type(originalPath);
}

function resolveCompressedVariant(requestPath, acceptEncoding, path, distDir) {
  if (!isCompressibleFile(requestPath)) return null;
  const encoding = selectPrecompressedEncoding(acceptEncoding);
  if (!encoding) return null;
  let decoded;
  try { decoded = decodeURIComponent(String(requestPath || '').split(/[?#]/, 1)[0]); } catch { return null; }
  const originalPath = path.resolve(distDir, decoded.replace(/^\/+/, ''));
  const root = `${path.resolve(distDir)}${path.sep}`;
  if (originalPath !== path.resolve(distDir) && !originalPath.startsWith(root)) return null;
  const compressedPath = `${originalPath}.${encoding === 'br' ? 'br' : 'gz'}`;
  return fs.existsSync(compressedPath) ? { originalPath, compressedPath, encoding } : null;
}

function createPrecompressedMiddleware(path, distDir) {
  return (req, res, next) => {
    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') return next();
    const requestPath = req.path || req.originalUrl || req.url || '';
    const variant = resolveCompressedVariant(requestPath, req.headers && req.headers['accept-encoding'], path, distDir);
    if (!variant) return next();
    applyCompressedHeaders(res, variant.originalPath, variant.encoding);
    return res.sendFile(variant.compressedPath);
  };
}

function createStaticOptions() {
  return {
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        applyHtmlNoStoreHeaders(res);
        return;
      }
      if (isMediaFile(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  };
}

function configureHttpDelivery(app, express, path, dirname) {
  if (!app || typeof app.use !== 'function' || typeof app.get !== 'function') {
    throw new TypeError('必须提供有效的 Express 应用');
  }
  const distDir = path.join(dirname, '../client/dist');
  const indexFile = path.join(distDir, 'index.html');
  app.use(createPrecompressedMiddleware(path, distDir));
  app.use(express.static(distDir, createStaticOptions()));
  app.get('/healthz', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Henan50K-Release', UI_RELEASE);
    res.status(200).type('text/plain').send('ok');
  });
  app.get('*', (req, res) => {
    const requestPath = req.path || req.originalUrl || req.url || '';
    if (isStaticAssetRequest(requestPath)) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.status(404).type('text/plain').send('资源不存在');
      return;
    }
    const variant = resolveCompressedVariant('/index.html', req.headers && req.headers['accept-encoding'], path, distDir);
    if (variant) {
      applyCompressedHeaders(res, indexFile, variant.encoding);
      res.sendFile(variant.compressedPath);
      return;
    }
    applyHtmlNoStoreHeaders(res);
    res.sendFile(indexFile);
  });
}

module.exports = {
  UI_RELEASE,
  applyHtmlNoStoreHeaders,
  createPrecompressedMiddleware,
  createStaticOptions,
  configureHttpDelivery,
  isCompressibleFile,
  isMediaFile,
  isStaticAssetRequest,
  resolveCompressedVariant,
  selectPrecompressedEncoding,
};
