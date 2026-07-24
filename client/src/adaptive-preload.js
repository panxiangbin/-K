const SLOW_CONNECTION_TYPES = new Set(['slow-2g', '2g']);

export function getPreloadPolicy(connection) {
  if (connection?.saveData) {
    return { enabled: false, delayMs: 0, idleTimeoutMs: 0, reason: 'save-data' };
  }

  const effectiveType = connection?.effectiveType || '';
  if (SLOW_CONNECTION_TYPES.has(effectiveType)) {
    return { enabled: false, delayMs: 0, idleTimeoutMs: 0, reason: effectiveType };
  }

  if (effectiveType === '3g') {
    return { enabled: true, delayMs: 4000, idleTimeoutMs: 5000, reason: '3g' };
  }

  return { enabled: true, delayMs: 600, idleTimeoutMs: 1800, reason: effectiveType || 'unknown' };
}

export function scheduleAdaptivePreload({
  windowObject,
  navigatorObject,
  preload,
}) {
  if (!windowObject || typeof preload !== 'function') {
    throw new TypeError('windowObject and preload are required');
  }

  const policy = getPreloadPolicy(navigatorObject?.connection);
  if (!policy.enabled) return { policy, cancel() {} };

  let cancelled = false;
  let delayId = null;
  let idleId = null;

  const run = () => {
    if (cancelled) return;
    Promise.resolve(preload()).catch(() => {});
  };

  const scheduleIdle = () => {
    if (cancelled) return;
    if (typeof windowObject.requestIdleCallback === 'function') {
      idleId = windowObject.requestIdleCallback(run, { timeout: policy.idleTimeoutMs });
    } else {
      idleId = windowObject.setTimeout(run, Math.min(policy.idleTimeoutMs, 1200));
    }
  };

  delayId = windowObject.setTimeout(scheduleIdle, policy.delayMs);

  return {
    policy,
    cancel() {
      if (cancelled) return;
      cancelled = true;
      if (delayId !== null) windowObject.clearTimeout(delayId);
      if (idleId !== null) {
        if (typeof windowObject.cancelIdleCallback === 'function') {
          windowObject.cancelIdleCallback(idleId);
        } else {
          windowObject.clearTimeout(idleId);
        }
      }
    },
  };
}
