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
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  });
}

module.exports = { createStaticOptions, configureHttpDelivery };
