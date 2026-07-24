const replacements = [
  {
    name: '智能电脑出牌',
    oldCode: 'const move = chooseBotMove(player.hand, room.lastPlay);',
    newCode: `const botContext = require('./bot-context').getBotTurnContext(room, idx, player.id, calcPileScore);
    const move = require('./bot-ai').chooseBotMove(player.hand, room.lastPlay, botContext);`,
  },
  {
    name: 'HTTP静态交付与健康检查',
    oldCode: `app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});`,
    newCode: `require('./http-delivery').configureHttpDelivery(app, express, path, __dirname);`,
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
