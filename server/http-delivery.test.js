const assert = require('assert');
const path = require('path');
const { createStaticOptions, configureHttpDelivery } = require('./http-delivery');

function createResponse() {
  const headers = {};
  return {
    headers,
    statusCode: null,
    contentType: null,
    body: null,
    file: null,
    setHeader(name, value) { headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    type(value) { this.contentType = value; return this; },
    send(value) { this.body = value; return this; },
    sendFile(value) { this.file = value; return this; },
  };
}

const options = createStaticOptions();
const htmlResponse = createResponse();
options.setHeaders(htmlResponse, '/tmp/index.html');
assert.strictEqual(htmlResponse.headers['Cache-Control'], 'no-cache');

const assetResponse = createResponse();
options.setHeaders(assetResponse, '/tmp/assets/app.abc123.js');
assert.strictEqual(assetResponse.headers['Cache-Control'], 'public, max-age=31536000, immutable');
assert.strictEqual(options.etag, true);
assert.strictEqual(options.lastModified, true);

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
assert.strictEqual(middleware.length, 1);
assert.strictEqual(middleware[0].dir, path.join(__dirname, '../client/dist'));
assert.ok(routes.has('/healthz'));
assert.ok(routes.has('*'));

const healthResponse = createResponse();
routes.get('/healthz')({}, healthResponse);
assert.strictEqual(healthResponse.statusCode, 200);
assert.strictEqual(healthResponse.contentType, 'text/plain');
assert.strictEqual(healthResponse.body, 'ok');
assert.strictEqual(healthResponse.headers['Cache-Control'], 'no-store');

const fallbackResponse = createResponse();
routes.get('*')({}, fallbackResponse);
assert.strictEqual(fallbackResponse.headers['Cache-Control'], 'no-cache');
assert.strictEqual(fallbackResponse.file, path.join(__dirname, '../client/dist/index.html'));

assert.throws(
  () => configureHttpDelivery(null, express, path, __dirname),
  /Express 应用/,
);

console.log('http-delivery tests passed');
