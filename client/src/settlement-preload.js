const VERY_SLOW_CONNECTION_TYPES = new Set(['slow-2g', '2g']);

export function getSettlementPreloadPolicy(connection) {
  if (connection?.saveData) {
    return { enabled: false, delayMs: 0, idleTimeoutMs: 0, reason: 'save-data' };
  }

  const effectiveType = connection?.effectiveType || '';
  if (VERY_SLOW_CONNECTION_TYPES.has(effectiveType)) {
    return { enabled: false, delayMs: 0, idleTimeoutMs: 0, reason: effectiveType };
  }

  if (effectiveType === '3g') {
    return { enabled: true, delayMs: 6000, idleTimeoutMs: 5000, reason: '3g' };
  }

  return { enabled: true, delayMs: 1200, idleTimeoutMs: 2200, reason: effectiveType || 'unknown' };
}

export function isSettlementImminent(gameState, threshold = 5) {
  if (gameState?.status !== 'playing' || !Array.isArray(gameState.players)) return false;
  return gameState.players.some(player => (
    !player?.left
    && Number.isFinite(player.cardCount)
    && player.cardCount > 0
    && player.cardCount <= threshold
  ));
}

export function scheduleSettlementPreload({
  windowObject,
  navigatorObject,
  preload,
}) {
  if (!windowObject || typeof preload !== 'function') {
    throw new TypeError('windowObject and preload are required');
  }

  const policy = getSettlementPreloadPolicy(navigatorObject?.connection);
  let cancelled = false;
  let started = false;
  let delayId = null;
  let idleId = null;

  const clearScheduled = () => {
    if (delayId !== null) {
      windowObject.clearTimeout(delayId);
      delayId = null;
    }
    if (idleId !== null) {
      if (typeof windowObject.cancelIdleCallback === 'function') {
        windowObject.cancelIdleCallback(idleId);
      } else {
        windowObject.clearTimeout(idleId);
      }
      idleId = null;
    }
  };

  const run = () => {
    if (cancelled || started) return false;
    started = true;
    clearScheduled();
    Promise.resolve(preload()).catch(() => {});
    return true;
  };

  const scheduleIdle = () => {
    if (cancelled || started) return;
    delayId = null;
    if (typeof windowObject.requestIdleCallback === 'function') {
      idleId = windowObject.requestIdleCallback(run, { timeout: policy.idleTimeoutMs });
    } else {
      idleId = windowObject.setTimeout(run, Math.min(policy.idleTimeoutMs, 1200));
    }
  };

  if (policy.enabled) {
    delayId = windowObject.setTimeout(scheduleIdle, policy.delayMs);
  }

  return {
    policy,
    preloadNow: run,
    cancel() {
      if (cancelled) return;
      cancelled = true;
      clearScheduled();
    },
  };
}
