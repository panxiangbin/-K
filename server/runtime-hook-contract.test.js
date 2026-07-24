const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { replacements, transformServerSource } = require('./runtime-hook-contract');

const indexPath = path.join(__dirname, 'index.js');
const source = fs.readFileSync(indexPath, 'utf8');
const transformed = transformServerSource(source);

for (const replacement of replacements) {
  assert.strictEqual(
    source.split(replacement.oldCode).length - 1,
    1,
    `${replacement.name}接入点必须且只能出现一次`,
  );
  assert.ok(
    transformed.includes(replacement.newCode),
    `${replacement.name}应成功写入转换后的服务器源码`,
  );
}

assert.doesNotThrow(
  () => new Function('require', '__dirname', '__filename', transformed),
  '转换后的服务器入口必须保持可解析',
);

assert.ok(
  !transformed.includes("app.use(express.static(path.join(__dirname, '../client/dist')));"),
  '原始静态资源和兜底路由应由独立HTTP模块整体替换',
);
assert.ok(
  transformed.includes("require('./http-delivery').configureHttpDelivery(app, express, path, __dirname);"),
  '转换后应接入独立HTTP交付模块',
);

assert.throws(
  () => transformServerSource(source.replace(replacements[0].oldCode, '// marker removed')),
  /智能电脑出牌（匹配0处）/,
  '接入点漂移时必须在部署前给出明确错误',
);

assert.throws(
  () => transformServerSource(`${source}\n${replacements[1].oldCode}`),
  /HTTP静态交付与健康检查（匹配2处）/,
  '接入点重复时必须拒绝不确定替换',
);

console.log('runtime-hook-contract tests passed');
