export function createReconnectController({
  connect,
  isOnline,
  initialDelay = 1000,
  maxDelay = 15000,
  multiplier = 1.8,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (typeof connect !== 'function') throw new TypeError('connect must be a function');
  if (typeof isOnline !== 'function') throw new TypeError('isOnline must be a function');
  if (!(initialDelay > 0)) throw new RangeError('initialDelay must be greater than 0');
  if (!(maxDelay >= initialDelay)) throw new RangeError('maxDelay must be at least initialDelay');
  if (!(multiplier > 1)) throw new RangeError('multiplier must be greater than 1');
  if (typeof setTimer !== 'function' || typeof clearTimer !== 'function') {
    throw new TypeError('timer functions are required');
  }

  let timer = null;
  let nextDelay = initialDelay;
  let stopped = false;

  function cancel() {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  }

  function reset() {
    cancel();
    nextDelay = initialDelay;
  }

  function schedule() {
    if (stopped || timer !== null || !isOnline()) return false;

    const delay = nextDelay;
    timer = setTimer(() => {
      timer = null;
      if (stopped || !isOnline()) return;
      connect();
    }, delay);
    nextDelay = Math.min(maxDelay, Math.round(delay * multiplier));
    return true;
  }

  function reconnectNow() {
    if (stopped || !isOnline()) return false;
    reset();
    connect();
    return true;
  }

  function stop() {
    stopped = true;
    cancel();
  }

  return {
    cancel,
    reset,
    schedule,
    reconnectNow,
    stop,
    getSnapshot: () => ({
      scheduled: timer !== null,
      nextDelay,
      stopped,
    }),
  };
}
