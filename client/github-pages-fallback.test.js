import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.DEPLOY_TARGET = 'github-pages';
const pagesConfig = (await import(`./vite.config.js?pages=${Date.now()}`)).default;
assert.equal(pagesConfig.base, '/-K/', 'GitHub Pages build must use the repository base path');

const runtimePlugin = pagesConfig.plugins.find((plugin) => plugin?.name === 'henan-50k-github-pages-runtime');
assert(runtimePlugin, 'GitHub Pages build must install the runtime rewrite plugin');

const wsSource = fs.readFileSync(new URL('./src/hooks/useWebSocket.js', import.meta.url), 'utf8');
const wsResult = runtimePlugin.transform(wsSource, '/workspace/client/src/hooks/useWebSocket.js');
assert(wsResult?.code.includes("hostname.endsWith('.github.io')"), 'Pages client must connect to the Render WebSocket backend');
assert(wsResult.code.includes("return RENDER_URL"), 'Pages client must retain the production WebSocket URL');

const appSource = fs.readFileSync(new URL('./src/App.jsx', import.meta.url), 'utf8');
const appResult = runtimePlugin.transform(appSource, '/workspace/client/src/App.jsx');
assert(appResult?.code.includes('import.meta.env.BASE_URL'), 'Pages audio must respect the repository base path');
assert(!appResult.code.includes("RECORDED_BOMB_AUDIO_SRC = '/audio/"), 'Pages audio must not use a site-root absolute path');

delete process.env.DEPLOY_TARGET;
const normalConfig = (await import(`./vite.config.js?normal=${Date.now()}`)).default;
assert.equal(normalConfig.base, '/', 'Render build must keep the root base path');

console.log('GitHub Pages fallback tests passed');
