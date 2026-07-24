import { createReconnectController } from './reconnect-controller';
import { createWebSocketAttempt } from './websocket-attempt';

export function createWebSocketCoordinator({
  url,
  createSocket,
  isOnline,
  openState,
  connectingState,
  closedState,
  timeoutMs,
  initialDelay = 1000,
  maxDelay = 15000,
  onOpen = () => {},
  onClose = () => {},
  onMessage = () => {},
  onConnecting = () => {},
  onDisposeSocket = () => {},
  createAttempt = createWebSocketAttempt,
  createReconnect = createReconnectController,
  reconnectOptions = {},
} = {}) {
  if (typeof url !== 'string' || !url) throw new TypeError('url is required');
  if (typeof createSocket !== 'function') throw new TypeError('createSocket must be a function');
  if (typeof isOnline !== 'function') throw new TypeError('isOnline must be a function');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs must be positive');
  for (const [name, handler] of Object.entries({ onOpen, onClose, onMessage, onConnecting, onDisposeSocket })) {
    if (typeof handler !== 'function') throw new TypeError(`${name} must be a function`);
  }

  const attempts = new WeakMap();
  let current = null;
  let stopped = false;

  function disposeSocket(socket, reason) {
    if (!socket) return;
    const attempt = attempts.get(socket);
    if (attempt) {
      attempt.dispose();
      attempts.delete(socket);
    }
    onDisposeSocket(socket, reason);
  }

  function closeCurrent(reason) {
    const socket = current;
    current = null;
    if (!socket) return false;
    disposeSocket(socket, reason);
    if (socket.readyState !== closedState) socket.close();
    return true;
  }

  function connect() {
    if (stopped || !isOnline()) return false;
    if (current && (current.readyState === openState || current.readyState === connectingState)) return false;

    onConnecting();
    const attempt = createAttempt({
      url,
      createSocket,
      setCurrent: (socket) => { current = socket; },
      isCurrent: (socket) => !stopped && current === socket,
      timeoutMs,
      connectingState,
      onOpen: (event, socket) => {
        reconnectController.reset();
        onOpen(event, socket);
      },
      onClose: (event, socket, state) => {
        attempts.delete(socket);
        onDisposeSocket(socket, 'close');
        if (state.isCurrent) current = null;
        onClose(event, socket, state);
        if (state.isCurrent) reconnectController.schedule();
      },
      onError: (_, socket) => socket.close(),
      onMessage,
    });
    attempts.set(attempt.socket, attempt);
    return true;
  }

  const reconnectController = createReconnect({
    connect,
    isOnline,
    initialDelay,
    maxDelay,
    ...reconnectOptions,
  });

  function reconnectNow() {
    if (stopped || !isOnline()) return false;
    if (current?.readyState === connectingState) closeCurrent('replace-connecting');
    if (!current || current.readyState === closedState) return reconnectController.reconnectNow();
    reconnectController.reset();
    return false;
  }

  function goOffline() {
    reconnectController.cancel();
    closeCurrent('offline');
  }

  function goOnline() {
    return reconnectNow();
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    reconnectController.stop();
    closeCurrent('stop');
  }

  return {
    connect,
    reconnectNow,
    goOffline,
    goOnline,
    stop,
    getCurrent: () => current,
    getSnapshot: () => ({
      stopped,
      hasCurrent: Boolean(current),
      reconnect: reconnectController.getSnapshot(),
    }),
  };
}
