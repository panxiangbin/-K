const DEFAULT_REMOTE_BACKEND = 'wss://henan-50k.onrender.com';

export function resolveBackendWebSocketUrl(url, locationObject = globalThis.location) {
  if (!url || !locationObject) return url;
  const hostname = String(locationObject.hostname || '').toLowerCase();
  if (!hostname.endsWith('.github.io')) return url;

  try {
    const target = new URL(url, locationObject.href);
    if (target.hostname.toLowerCase() !== hostname) return url;
    return DEFAULT_REMOTE_BACKEND;
  } catch {
    return url;
  }
}

export function installRemoteBackendWebSocket(target = globalThis) {
  const NativeWebSocket = target?.WebSocket;
  if (typeof NativeWebSocket !== 'function') return false;
  if (NativeWebSocket.__henan50kRemoteBackend === true) return true;

  class RemoteBackendWebSocket extends NativeWebSocket {
    constructor(url, protocols) {
      const resolvedUrl = resolveBackendWebSocketUrl(url, target.location);
      if (protocols === undefined) super(resolvedUrl);
      else super(resolvedUrl, protocols);
    }
  }

  Object.defineProperty(RemoteBackendWebSocket, '__henan50kRemoteBackend', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
  target.WebSocket = RemoteBackendWebSocket;
  return true;
}

export { DEFAULT_REMOTE_BACKEND };
