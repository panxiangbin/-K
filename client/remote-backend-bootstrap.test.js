import assert from 'node:assert/strict';
import {
  DEFAULT_REMOTE_BACKEND,
  installRemoteBackendWebSocket,
  resolveBackendWebSocketUrl,
} from './src/remote-backend-bootstrap.js';

const githubPagesLocation = {
  hostname: 'panxiangbin.github.io',
  href: 'https://panxiangbin.github.io/pan/50k/',
};

assert.equal(
  resolveBackendWebSocketUrl('wss://panxiangbin.github.io', githubPagesLocation),
  DEFAULT_REMOTE_BACKEND,
  'GitHub Pages 同源 WebSocket 必须转到可用的游戏服务器',
);
assert.equal(
  resolveBackendWebSocketUrl('wss://example.com/socket', githubPagesLocation),
  'wss://example.com/socket',
  '已经明确指定的外部 WebSocket 不应被改写',
);
assert.equal(
  resolveBackendWebSocketUrl('ws://localhost:3002', {
    hostname: 'localhost',
    href: 'http://localhost:4173/pan/50k/',
  }),
  'ws://localhost:3002',
  '本地开发环境必须继续使用本地服务器',
);
assert.equal(
  resolveBackendWebSocketUrl('wss://henan-50k.onrender.com', githubPagesLocation),
  'wss://henan-50k.onrender.com',
  'Render 地址本身不应重复改写',
);

class FakeWebSocket {
  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
  }
}

const localTarget = {
  WebSocket: FakeWebSocket,
  location: { hostname: 'localhost', href: 'http://localhost:4173/pan/50k/' },
};
assert.equal(installRemoteBackendWebSocket(localTarget), true, '本地环境安装流程应安全返回');
assert.equal(localTarget.WebSocket, FakeWebSocket, '本地环境不应改写原生 WebSocket');

const pagesTarget = { WebSocket: FakeWebSocket, location: githubPagesLocation };
assert.equal(installRemoteBackendWebSocket(pagesTarget), true, 'GitHub Pages 应安装安全的后端转发');
const redirected = new pagesTarget.WebSocket('wss://panxiangbin.github.io');
assert.equal(redirected.url, DEFAULT_REMOTE_BACKEND, '实际创建连接时必须转到 Render 后端');
assert.equal(installRemoteBackendWebSocket(pagesTarget), true, '重复安装必须保持幂等');

console.log('remote backend bootstrap tests passed');
