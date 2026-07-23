const fs = require('fs');
const path = require('path');
const Module = require('module');

const targetFile = path.resolve(__dirname, 'index.js');
const originalJsLoader = Module._extensions['.js'];
const oldCall = 'const move = chooseBotMove(player.hand, room.lastPlay);';
const newCall = "const move = require('./bot-ai').chooseBotMove(player.hand, room.lastPlay);";

Module._extensions['.js'] = function smartBotLoader(module, filename) {
  if (path.resolve(filename) !== targetFile) {
    return originalJsLoader(module, filename);
  }

  // 只拦截一次服务器入口，随后立即恢复 Node 默认加载器，避免影响后续模块。
  Module._extensions['.js'] = originalJsLoader;

  const source = fs.readFileSync(filename, 'utf8');
  if (!source.includes(oldCall)) {
    throw new Error('无法接入智能电脑：服务器出牌调用位置已变化');
  }

  module._compile(source.replace(oldCall, newCall), filename);
};
