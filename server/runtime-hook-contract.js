const replacements = [
  {
    name: '智能电脑出牌',
    oldCode: 'const move = chooseBotMove(player.hand, room.lastPlay);',
    newCode: `const botContext = require('./bot-context').getBotTurnContext(room, idx, player.id, calcPileScore);
    const move = require('./bot-ai').chooseBotMove(player.hand, room.lastPlay, botContext);`,
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
  {
    name: 'WebSocket心跳清理',
    oldCode: "wss.on('connection', (ws) => {",
    newCode: `require('./ws-heartbeat').startWebSocketHeartbeat(wss, WebSocket, {
  onSocketError(error, socket, phase) {
    console.warn('[ws-heartbeat]', phase, error && error.message ? error.message : error);
  },
});

wss.on('connection', (ws) => {`,
  },
];

function transformServerSource(source) {
  if (typeof source !== 'string') throw new TypeError('服务器源码必须是字符串');

  let transformed = source;
  const missing = [];

  for (const replacement of replacements) {
    const occurrences = transformed.split(replacement.oldCode).length - 1;
    if (occurrences !== 1) {
      missing.push(`${replacement.name}（匹配${occurrences}处）`);
      continue;
    }
    transformed = transformed.replace(replacement.oldCode, replacement.newCode);
  }

  if (missing.length) {
    throw new Error(`服务器运行时接入点失效：${missing.join('、')}`);
  }

  return transformed;
}

module.exports = { replacements, transformServerSource };
