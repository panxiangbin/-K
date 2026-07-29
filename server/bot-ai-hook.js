const fs = require('fs');
const path = require('path');
const Module = require('module');
const { transformServerSource } = require('./runtime-hook-contract');
const { transformDuplicateJoinGuard } = require('./duplicate-join-guard');
const { installJokerPairRule } = require('./joker-pair-rule');

// 在服务器入口和电脑AI加载规则模块前统一安装：任何王都不能组成普通对子。
installJokerPairRule(require('./game-logic'));

const targetFile = path.resolve(__dirname, 'index.js');
const originalJsLoader = Module._extensions['.js'];

Module._extensions['.js'] = function optimizedServerLoader(module, filename) {
  if (path.resolve(filename) !== targetFile) {
    return originalJsLoader(module, filename);
  }

  // 只拦截一次服务器入口，随后立即恢复 Node 默认加载器，避免影响后续模块。
  Module._extensions['.js'] = originalJsLoader;

  const source = fs.readFileSync(filename, 'utf8');
  const optimizedSource = transformDuplicateJoinGuard(transformServerSource(source));
  module._compile(optimizedSource, filename);
};
