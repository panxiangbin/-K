const fs = require('fs');
const path = require('path');
const Module = require('module');

const targetFile = path.resolve(__dirname, 'index.js');
const originalJsLoader = Module._extensions['.js'];

const replacements = [
  {
    name: '智能电脑出牌',
    oldCode: 'const move = chooseBotMove(player.hand, room.lastPlay);',
    newCode: "const move = require('./bot-ai').chooseBotMove(player.hand, room.lastPlay);",
  },
  {
    name: '静态资源缓存',
    oldCode: "app.use(express.static(path.join(__dirname, '../client/dist')));",
    newCode: `app.use(express.static(path.join(__dirname, '../client/dist'), {
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
}));`,
  },
  {
    name: '轻量健康检查',
    oldCode: "app.get('*', (req, res) => {",
    newCode: `app.get('/healthz', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).type('text/plain').send('ok');
});

app.get('*', (req, res) => {`,
  },
];

Module._extensions['.js'] = function optimizedServerLoader(module, filename) {
  if (path.resolve(filename) !== targetFile) {
    return originalJsLoader(module, filename);
  }

  // 只拦截一次服务器入口，随后立即恢复 Node 默认加载器，避免影响后续模块。
  Module._extensions['.js'] = originalJsLoader;

  let source = fs.readFileSync(filename, 'utf8');
  for (const replacement of replacements) {
    if (!source.includes(replacement.oldCode)) {
      throw new Error(`无法接入${replacement.name}：服务器对应代码位置已变化`);
    }
    source = source.replace(replacement.oldCode, replacement.newCode);
  }

  module._compile(source, filename);
};