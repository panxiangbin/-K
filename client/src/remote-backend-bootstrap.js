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
  const hostname = String(target?.location?.hostname || '').toLowerCase();
  if (typeof NativeWebSocket !== 'function') return false;
  if (!hostname.endsWith('.github.io')) return true;
  if (NativeWebSocket.__henan50kRemoteBackend === true) return true;

  try {
    const RemoteBackendWebSocket = new Proxy(NativeWebSocket, {
      construct(Target, args) {
        const [url, protocols] = args;
        const resolvedUrl = resolveBackendWebSocketUrl(url, target.location);
        if (protocols === undefined) return new Target(resolvedUrl);
        return new Target(resolvedUrl, protocols);
      },
    });

    Object.defineProperty(RemoteBackendWebSocket, '__henan50kRemoteBackend', {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false,
    });
    target.WebSocket = RemoteBackendWebSocket;
    return target.WebSocket === RemoteBackendWebSocket;
  } catch {
    return false;
  }
}

export { DEFAULT_REMOTE_BACKEND };
