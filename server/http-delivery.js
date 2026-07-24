const MEDIA_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.webm']);
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

function isStaticAssetRequest(requestPath) {
  const normalized = String(requestPath || '').toLowerCase().split(/[?#]/, 1)[0];
  return normalized.startsWith('/assets/')
    || normalized.startsWith('/audio/')
    || STATIC_ASSET_EXTENSIONS.has(getExtension(normalized));
}

function createStaticOptions() {
  return {
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        // HTML 每次校验，确保自动部署后用户及时拿到新入口文件。
        res.setHeader('Cache-Control', 'no-cache');
        return;
      }

      // 音频文件名带显式版本号，允许长期缓存；范围请求由 express.static 处理。
      if (isMediaFile(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        return;
      }

      // Vite 构建资源带内容哈希，可安全长期缓存，减少重复打开时的下载量。
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

  app.use(express.static(distDir, createStaticOptions()));

  app.get('/healthz', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
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

    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  });
}

module.exports = {
  createStaticOptions,
  configureHttpDelivery,
  isMediaFile,
  isStaticAssetRequest,
};
