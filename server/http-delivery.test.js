const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  UI_RELEASE,
  applyHtmlNoStoreHeaders,
  createPrecompressedMiddleware,
  createStaticOptions,
  configureHttpDelivery,
  isCompressibleFile,
  isMediaFile,
  isStaticAssetRequest,
  selectPrecompressedEncoding,
} = require('./http-delivery');

function createResponse() {
  const headers = {};
  return {
    headers,
    statusCode: null,
    contentType: null,
    body: null,
    file: null,
    setHeader(name, value) { headers[name] = value; return this; },
    getHeader(name) { return headers[name]; },
    status(code) { this.statusCode = code; return this; },
    type(value) { this.contentType = value; return this; },
    send(value) { this.body = value; return this; },
    sendFile(value) { this.file = value; return this; },
  };
}

assert.strictEqual(UI_RELEASE, 'ink-06-mobile-r4');
const directHtmlResponse = createResponse();
applyHtmlNoStoreHeaders(directHtmlResponse);
assert.strictEqual(directHtmlResponse.headers['Cache-Control'], 'no-store, max-age=0, must-revalidate');
assert.strictEqual(directHtmlResponse.headers.Pragma, 'no-cache');
assert.strictEqual(directHtmlResponse.headers.Expires, '0');
assert.strictEqual(directHtmlResponse.headers['X-Henan50K-Release'], UI_RELEASE);

const options = createStaticOptions();
const htmlResponse = createResponse();
options.setHeaders(htmlResponse, '/tmp/index.html');
assert.strictEqual(htmlResponse.headers['Cache-Control'], 'no-store, max-age=0, must-revalidate');
assert.strictEqual(htmlResponse.headers['X-Henan50K-Release'], UI_RELEASE);

const assetResponse = createResponse();
options.setHeaders(assetResponse, '/tmp/assets/app.abc123.js');
assert.strictEqual(assetResponse.headers['Cache-Control'], 'public, max-age=31536000, immutable');
assert.strictEqual(options.etag, true);
assert.strictEqual(options.lastModified, true);

const mediaResponse = createResponse();
options.setHeaders(mediaResponse, '/tmp/audio/langaishou-v2.mp3');
assert.strictEqual(mediaResponse.headers['Cache-Control'], 'public, max-age=31536000, immutable');
assert.strictEqual(mediaResponse.headers['Accept-Ranges'], 'bytes');
assert.strictEqual(mediaResponse.headers['X-Content-Type-Options'], 'nosniff');
assert.strictEqual(mediaResponse.headers['Cross-Origin-Resource-Policy'], 'same-origin');
assert.strictEqual(isMediaFile('/tmp/audio/voice.MP3'), true);
assert.strictEqual(isMediaFile('/tmp/assets/app.js'), false);
assert.strictEqual(isCompressibleFile('/assets/app.js'), true);
assert.strictEqual(isCompressibleFile('/assets/app.css?x=1'), true);
assert.strictEqual(isCompressibleFile('/audio/voice.mp3'), false);

assert.strictEqual(selectPrecompressedEncoding('gzip, br'), 'br');
assert.strictEqual(selectPrecompressedEncoding('br;q=0.4, gzip;q=0.9'), 'gzip');
assert.strictEqual(selectPrecompressedEncoding('br;q=0, gzip;q=0'), null);
assert.strictEqual(selectPrecompressedEncoding('*;q=0.5'), 'br');
assert.strictEqual(selectPrecompressedEncoding('identity'), null);

assert.strictEqual(isStaticAssetRequest('/assets/app.missing.js'), true);
assert.strictEqual(isStaticAssetRequest('/audio/missing.mp3?cache=1'), true);
assert.strictEqual(isStaticAssetRequest('/icons/card.svg#symbol'), true);
assert.strictEqual(isStaticAssetRequest('/room/ABC123'), false);
assert.strictEqual(isStaticAssetRequest('/rules'), false);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'henan-50k-http-'));
try {
  const assetDir = path.join(tempDir, 'assets');
  fs.mkdirSync(assetDir, { recursive: true });
  const original = path.join(assetDir, 'app.abc123.js');
  fs.writeFileSync(original, 'console.log("ok")');
  fs.writeFileSync(`${original}.br`, 'brotli');
  fs.writeFileSync(`${original}.gz`, 'gzip');

  const compressedMiddleware = createPrecompressedMiddleware(path, tempDir);
  const brResponse = createResponse();
  let nextCalls = 0;
  compressedMiddleware({ method: 'GET', path: '/assets/app.abc123.js', headers: { 'accept-encoding': 'gzip, br' } }, brResponse, () => { nextCalls += 1; });
  assert.strictEqual(nextCalls, 0);
  assert.strictEqual(brResponse.file, `${original}.br`);
  assert.strictEqual(brResponse.headers['Content-Encoding'], 'br');
  assert.strictEqual(brResponse.headers.Vary, 'Accept-Encoding');
  assert.strictEqual(brResponse.headers['Cache-Control'], 'public, max-age=31536000, immutable');
  assert.strictEqual(brResponse.headers['X-Content-Type-Options'], 'nosniff');
  assert.strictEqual(brResponse.contentType, original);

  const gzipResponse = createResponse();
  compressedMiddleware({ method: 'GET', path: '/assets/app.abc123.js', headers: { 'accept-encoding': 'gzip' } }, gzipResponse, () => { nextCalls += 1; });
  assert.strictEqual(gzipResponse.file, `${original}.gz`);
  assert.strictEqual(gzipResponse.headers['Content-Encoding'], 'gzip');

  const identityResponse = createResponse();
  compressedMiddleware({ method: 'GET', path: '/assets/app.abc123.js', headers: {} }, identityResponse, () => { nextCalls += 1; });
  assert.strictEqual(identityResponse.file, null);
  assert.strictEqual(nextCalls, 1);

  const mediaCompressed = createResponse();
  compressedMiddleware({ method: 'GET', path: '/audio/voice.mp3', headers: { 'accept-encoding': 'br' } }, mediaCompressed, () => { nextCalls += 1; });
  assert.strictEqual(mediaCompressed.file, null);
  assert.strictEqual(nextCalls, 2);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

const routes = new Map();
const middleware = [];
const app = {
  use(value) { middleware.push(value); },
  get(route, handler) { routes.set(route, handler); },
};
const express = {
  static(dir, staticOptions) { return { dir, staticOptions }; },
};

configureHttpDelivery(app, express, path, __dirname);
assert.strictEqual(middleware.length, 2);
assert.strictEqual(typeof middleware[0], 'function');
assert.strictEqual(middleware[1].dir, path.join(__dirname, '../client/dist'));
assert.ok(routes.has('/healthz'));
assert.ok(routes.has('*'));

const healthResponse = createResponse();
routes.get('/healthz')({}, healthResponse);
assert.strictEqual(healthResponse.statusCode, 200);
assert.strictEqual(healthResponse.contentType, 'text/plain');
assert.strictEqual(healthResponse.body, 'ok');
assert.strictEqual(healthResponse.headers['Cache-Control'], 'no-store');
assert.strictEqual(healthResponse.headers['X-Henan50K-Release'], UI_RELEASE);

const fallbackResponse = createResponse();
routes.get('*')({ path: '/room/ABC123', headers: {} }, fallbackResponse);
assert.strictEqual(fallbackResponse.headers['Cache-Control'], 'no-store, max-age=0, must-revalidate');
assert.strictEqual(fallbackResponse.headers.Pragma, 'no-cache');
assert.strictEqual(fallbackResponse.headers.Expires, '0');
assert.strictEqual(fallbackResponse.headers['X-Henan50K-Release'], UI_RELEASE);
assert.strictEqual(fallbackResponse.file, path.join(__dirname, '../client/dist/index.html'));

const missingAssetResponse = createResponse();
routes.get('*')({ path: '/assets/missing.abc123.js', headers: {} }, missingAssetResponse);
assert.strictEqual(missingAssetResponse.statusCode, 404);
assert.strictEqual(missingAssetResponse.contentType, 'text/plain');
assert.strictEqual(missingAssetResponse.body, '资源不存在');
assert.strictEqual(missingAssetResponse.file, null);
assert.strictEqual(missingAssetResponse.headers['Cache-Control'], 'no-store');
assert.strictEqual(missingAssetResponse.headers['X-Content-Type-Options'], 'nosniff');

const missingMediaResponse = createResponse();
routes.get('*')({ originalUrl: '/audio/missing.mp3?cache=1', headers: {} }, missingMediaResponse);
assert.strictEqual(missingMediaResponse.statusCode, 404);
assert.strictEqual(missingMediaResponse.file, null);

assert.throws(() => configureHttpDelivery(null, express, path, __dirname), /Express 应用/);
console.log('http-delivery tests passed');
