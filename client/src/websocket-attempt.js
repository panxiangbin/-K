import { armConnectionTimeout } from './connection-timeout.js';
import { bindWebSocketLifecycle } from './websocket-lifecycle.js';

export function createWebSocketAttempt({
  url,
  createSocket,
  setCurrent,
  isCurrent,
  timeoutMs,
  connectingState,
  onOpen = () => {},
  onClose = () => {},
  onError = () => {},
  onMessage = () => {},
  armTimeout = armConnectionTimeout,
  bindLifecycle = bindWebSocketLifecycle,
} = {}) {
  if (typeof url !== 'string' || !url) throw new TypeError('url is required');
  if (typeof createSocket !== 'function') throw new TypeError('createSocket must be a function');
  if (typeof setCurrent !== 'function') throw new TypeError('setCurrent must be a function');
  if (typeof isCurrent !== 'function') throw new TypeError('isCurrent must be a function');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs must be positive');
  for (const [name, handler] of Object.entries({ onOpen, onClose, onError, onMessage })) {
    if (typeof handler !== 'function') throw new TypeError(`${name} must be a function`);
  }

  const socket = createSocket(url);
  if (!socket || typeof socket !== 'object') throw new TypeError('createSocket must return a socket');
  setCurrent(socket);

  let disposed = false;
  let cancelTimeout = armTimeout(socket, {
    timeoutMs,
    connectingState,
    isCurrent: (target) => !disposed && isCurrent(target),
  });

  const clearTimeoutGuard = () => {
    if (!cancelTimeout) return;
    cancelTimeout();
    cancelTimeout = null;
  };

  const detach = bindLifecycle(socket, {
    isCurrent: (target) => !disposed && isCurrent(target),
    onOpen: (event, target) => {
      clearTimeoutGuard();
      onOpen(event, target);
    },
    onClose: (event, target, state) => {
      clearTimeoutGuard();
      onClose(event, target, state);
    },
    onError,
    onMessage,
  });

  return {
    socket,
    cancelTimeout: clearTimeoutGuard,
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeoutGuard();
      detach();
    },
  };
}
