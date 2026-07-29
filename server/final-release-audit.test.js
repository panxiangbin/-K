'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function requireScript(packageJson, scriptName, requiredFragments) {
  const script = packageJson.scripts?.[scriptName] || '';
  for (const fragment of requiredFragments) {
    assert(script.includes(fragment), `${packageJson.name} ${scriptName} must include ${fragment}`);
  }
}

async function main() {
  const renderConfig = read('render.yaml');
  assert(renderConfig.includes('name: henan-50k'), 'Render service name must remain henan-50k');
  assert(renderConfig.includes('cd client && npm ci'), 'Render must install the client with npm ci');
  assert(renderConfig.includes('npm test && npm run build'), 'Render must test before the client build');
  assert(renderConfig.includes('cd ../server && npm ci --omit=dev'), 'Render must install production server dependencies with npm ci');
  assert(renderConfig.includes('&& npm test'), 'Render must run the server test suite before start');
  assert(renderConfig.includes('startCommand: cd server && npm start'), 'Render start command must remain cd server && npm start');
  assert(renderConfig.includes('healthCheckPath: /healthz'), 'Render health check must remain /healthz');
  assert(renderConfig.includes('autoDeployTrigger: commit'), 'Render must continue auto-deploying main commits');

  const clientPackage = JSON.parse(read('client/package.json'));
  requireScript(clientPackage, 'test', [
    'connection-status.test.js',
    'global-status-priority.test.js',
    'session-recovery.test.js',
    'game-action-guard.test.js',
    'game-action-feedback.test.js',
    'joker-pair-ui-guard.test.js',
    'audio-base-bootstrap.test.js',
    'settlement-semantics.test.js',
    'rules-help.test.js',
    'ui-feedback-governor.test.js',
    'precompress-build.test.js',
  ]);
  requireScript(clientPackage, 'build', ['vite build', 'precompress-build.js', 'build-performance-budget.test.js']);

  const serverPackage = JSON.parse(read('server/package.json'));
  requireScript(serverPackage, 'test', [
    'error-messages.test.js',
    'joker-pair-rule.test.js',
    'duplicate-join-guard.test.js',
    'bot-ai.test.js',
    'bot-ai-minimum-bomb.test.js',
    'bot-public-memory.test.js',
    'runtime-hook-contract.test.js',
    'server-startup-smoke.test.js',
    'server-websocket-smoke.test.js',
    'server-reconnect-smoke.test.js',
  ]);
  requireScript(serverPackage, 'start', ['node -r ./bot-ai-hook.js index.js']);
  const startupHook = read('server/bot-ai-hook.js');
  assert(startupHook.includes('installJokerPairRule'), 'server startup must install the no-joker-pair rule');
  assert(startupHook.includes('transformDuplicateJoinGuard'), 'server startup must suppress duplicate join_room on the same connection');

  const rulesModule = await import(pathToFileURL(path.join(ROOT, 'client/src/rules-help-data.js')).href);
  const rulesText = rulesModule.flattenRulesText();
  const requiredRules = [
    '普通牌型只有单张、对子、三张、四至七张同点牌',
    '任何王都不能组成普通对子，包括两个小王、两个大王或大小王',
    '3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2 < 小王 < 大王',
    '黑桃 > 红桃 > 梅花 > 方块',
    '同点时黑四大于红四',
    '同花五十K < 红四／黑四 < 八张同点 < 四王',
    '有合法更大牌时必须压牌',
    '最后一手出完后，其他玩家仍可继续压牌',
    '当前牌堆由最后成功出牌的玩家得分',
  ];
  for (const rule of requiredRules) {
    assert(rulesText.includes(rule), `Rules help is missing fixed rule: ${rule}`);
  }
  for (const forbidden of rulesModule.FORBIDDEN_RULE_TERMS) {
    assert(!rulesText.includes(forbidden), `Rules help must not introduce unsupported pattern: ${forbidden}`);
  }

  const requiredRuntimeFiles = [
    'server/bot-ai-hook.js',
    'server/joker-pair-rule.js',
    'server/duplicate-join-guard.js',
    'server/runtime-hook-contract.js',
    'server/error-messages.js',
    'client/src/hooks/useWebSocket.js',
    'client/src/joker-pair-ui-guard.js',
    'client/src/audio-base-bootstrap.js',
    'client/src/session-recovery.js',
    'client/src/global-status-priority.js',
  ];
  for (const relativePath of requiredRuntimeFiles) {
    assert(fs.existsSync(path.join(ROOT, relativePath)), `Required runtime file is missing: ${relativePath}`);
  }

  console.log('final release audit passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
