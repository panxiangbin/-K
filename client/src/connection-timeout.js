const DEFAULT_CONNECTING_STATE = 0;

export function armConnectionTimeout(socket, options = {}) {
  if (!socket || typeof socket.close !== 'function') {
    throw new TypeError('socket with close() is required');
  }

  const {
    isCurrent,
    timeoutMs = 12000,
    connectingState = DEFAULT_CONNECTING_STATE,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = options;

  if (typeof isCurrent !== 'function') {
    throw new TypeError('isCurrent must be a function');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new TypeError('timeoutMs must be a non-negative number');
  }

  let timer = setTimer(() => {
    timer = null;
    if (!isCurrent(socket) || socket.readyState !== connectingState) return;
    socket.close();
  }, timeoutMs);

  return function cancelConnectionTimeout() {
    if (timer === null) return false;
    clearTimer(timer);
    timer = null;
    return true;
  };
}
