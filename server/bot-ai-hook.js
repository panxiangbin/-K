const fs = require('fs');
const path = require('path');
const Module = require('module');
const { transformServerSource } = require('./runtime-hook-contract');

const targetFile = path.resolve(__dirname, 'index.js');
const originalJsLoader = Module._extensions['.js'];

Module._extensions['.js'] = function optimizedServerLoader(module, filename) {
  if (path.resolve(filename) !== targetFile) {
    return originalJsLoader(module, filename);
  }

  // 只拦截一次服务器入口，随后立即恢复 Node 默认加载器，避免影响后续模块。
  Module._extensions['.js'] = originalJsLoader;

  const source = fs.readFileSync(filename, 'utf8');
  module._compile(transformServerSource(source), filename);
};
