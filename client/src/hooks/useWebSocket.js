import { useEffect, useRef, useCallback, useState } from 'react';
import { createJoinRequestGuard } from '../join-request-guard';
import { createWebSocketCoordinator } from '../websocket-coordinator';
import { CONNECTION_PHASES, getConnectionStatusView } from '../connection-status';
import { publishServerRejection } from '../server-error-feedback';
import {
  GLOBAL_STATUS_CHANNELS,
  GLOBAL_STATUS_PRIORITY,
  dismissGlobalStatus,
  publishGlobalStatus,
} from '../global-status-priority';
import {
  RECOVERY_STATUS_EVENT,
  createRecoveryRequestTracker,
  getRecoveryAttempt,
  installManualRecoverySourceMarker,
  invalidateSavedSession,
  stripRecoveryMetadata,
} from '../session-recovery';

const RENDER_URL = 'wss://henan-50k.onrender.com';
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 15000;
const CONNECT_TIMEOUT = 12000;
const MAX_BUFFERED_AMOUNT = 256 * 1024;
const WAKE_HINT_DELAY = 6000;
const SEND_HINT_COOLDOWN = 1500;
const CONNECTION_EVENT = 'henan50k-connection-change';

function publishConnectionState(connected) {
  window.__henan50kConnected = Boolean(connected);
  window.dispatchEvent(new CustomEvent(CONNECTION_EVENT, { detail: { connected: Boolean(connected) } }));
}

function getWsUrl() {
  const { protocol, hostname, host } = window.location;
  if (protocol === 'capacitor:') return RENDER_URL;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return `ws://${hostname}:3002`;
  return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`;
}

function showConnectionPhase(phase, onRetry) {
  const view = getConnectionStatusView(phase);
  publishGlobalStatus(
    GLOBAL_STATUS_CHANNELS.CONNECTION,
    { ...view, onRetry },
    {
      priority: view.tone === 'offline' || view.tone === 'failed'
        ? GLOBAL_STATUS_PRIORITY.CONNECTION_FAILURE
        : GLOBAL_STATUS_PRIORITY.CONNECTION_PROGRESS,
    },
    window,
  );
}

function hideConnectionStatus() {
  dismissGlobalStatus(GLOBAL_STATUS_CHANNELS.CONNECTION, window);
}

export function useWebSocket(onMessage) {
  const coordinatorRef = useRef(null);
  const wakeHintTimer = useRef(null);
  const lastSendHintAt = useRef(0);
  const joinRequestGuard = useRef(createJoinRequestGuard());
  const recoveryTracker = useRef(createRecoveryRequestTracker());
  const [connected, setConnected] = useState(false);
  const onMsg = useRef(onMessage);
  onMsg.current = onMessage;

  const retryNow = useCallback(() => {
    const coordinator = coordinatorRef.current;
    if (!navigator.onLine) {
      showConnectionPhase(CONNECTION_PHASES.OFFLINE);
      return;
    }
    showConnectionPhase(CONNECTION_PHASES.RECONNECTING, retryNow);
    coordinator?.ensureCurrent('manual-retry');
  }, []);

  useEffect(() => {
    let stopped = false;
    const removeRecoveryMarker = installManualRecoverySourceMarker(window);

    function handleRecoveryStatus(event) {
      const detail = event?.detail;
      if (!detail?.text) return;
      publishGlobalStatus(
        GLOBAL_STATUS_CHANNELS.RECOVERY,
        detail,
        {
          priority: detail.status === 'pending'
            ? GLOBAL_STATUS_PRIORITY.RECOVERY_PENDING
            : GLOBAL_STATUS_PRIORITY.RECOVERY_RESULT,
          duration: detail.status === 'pending'
            ? 0
            : detail.status === 'invalidated' || detail.status === 'timeout'
              ? 6500
              : 4200,
        },
        window,
      );
    }

    function setConnectionState(nextConnected) {
      setConnected(nextConnected);
      publishConnectionState(nextConnected);
    }

    function clearWakeHintTimer() {
      if (!wakeHintTimer.current) return;
      clearTimeout(wakeHintTimer.current);
      wakeHintTimer.current = null;
    }

    function scheduleWakeHint() {
      clearWakeHintTimer();
      wakeHintTimer.current = setTimeout(() => {
        wakeHintTimer.current = null;
        const socket = coordinatorRef.current?.getCurrent();
        if (stopped || socket?.readyState === WebSocket.OPEN || !navigator.onLine) return;
        showConnectionPhase(CONNECTION_PHASES.WAKING, retryNow);
      }, WAKE_HINT_DELAY);
    }

    const coordinator = createWebSocketCoordinator({
      url: getWsUrl(),
      createSocket: (targetUrl) => new WebSocket(targetUrl),
      isOnline: () => navigator.onLine,
      openState: WebSocket.OPEN,
      connectingState: WebSocket.CONNECTING,
      closedState: WebSocket.CLOSED,
      timeoutMs: CONNECT_TIMEOUT,
      maxBufferedAmount: MAX_BUFFERED_AMOUNT,
      initialDelay: INITIAL_RECONNECT_DELAY,
      maxDelay: MAX_RECONNECT_DELAY,
      onConnecting: scheduleWakeHint,
      onOpen: () => {
        clearWakeHintTimer();
        hideConnectionStatus();
        setConnectionState(true);
      },
      onClose: (_, __, state) => {
        if (!state.isCurrent) return;
        setConnectionState(false);
        if (!navigator.onLine) return;
        if (state.reason === 'send-failed' || state.reason?.endsWith('-backpressure')) {
          showConnectionPhase(CONNECTION_PHASES.FAILED, retryNow);
        }
        scheduleWakeHint();
      },
      onDisposeSocket: (socket) => {
        joinRequestGuard.current.clear(socket);
        recoveryTracker.current.cancel(socket);
      },
      onMessage: (event, socket) => {
        try {
          let msg = JSON.parse(event.data);
          if (msg.type === 'room_joined' || msg.type === 'error') joinRequestGuard.current.clear(socket);
          if (msg.type === 'room_joined') recoveryTracker.current.complete(socket);
          if (msg.type === 'error') {
            const rawMessage = msg.msg;
            const resolution = recoveryTracker.current.reject(socket, rawMessage);
            if (!resolution.matched) msg = { ...msg, msg: publishServerRejection(rawMessage, window) };
            if (resolution.shouldClear) {
              invalidateSavedSession({
                storage: window.localStorage,
                roomId: resolution.roomId,
                target: window,
                source: resolution.source,
              });
            }
          }
          onMsg.current(msg);
        } catch {
          // 忽略无法解析的非协议消息，保持连接继续工作。
        }
      },
    });
    coordinatorRef.current = coordinator;

    function handleOffline() {
      clearWakeHintTimer();
      setConnectionState(false);
      showConnectionPhase(CONNECTION_PHASES.OFFLINE);
      coordinator.goOffline();
    }

    function handleOnline() {
      showConnectionPhase(CONNECTION_PHASES.RECONNECTING, retryNow);
      coordinator.goOnline();
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      if (!coordinator.ensureCurrent('visibility')) setConnectionState(false);
    }

    window.addEventListener(RECOVERY_STATUS_EVENT, handleRecoveryStatus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    publishConnectionState(false);
    if (!navigator.onLine) handleOffline();
    else coordinator.connect();

    return () => {
      stopped = true;
      clearWakeHintTimer();
      dismissGlobalStatus(GLOBAL_STATUS_CHANNELS.CONNECTION, window);
      dismissGlobalStatus(GLOBAL_STATUS_CHANNELS.RECOVERY, window);
      removeRecoveryMarker();
      window.removeEventListener(RECOVERY_STATUS_EVENT, handleRecoveryStatus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      coordinator.stop();
      coordinatorRef.current = null;
      publishConnectionState(false);
    };
  }, [retryNow]);

  const send = useCallback((msg) => {
    const coordinator = coordinatorRef.current;
    if (!coordinator?.ensureCurrent('send')) {
      setConnected(false);
      publishConnectionState(false);
      const now = Date.now();
      if (now - lastSendHintAt.current >= SEND_HINT_COOLDOWN) {
        lastSendHintAt.current = now;
        showConnectionPhase(navigator.onLine ? CONNECTION_PHASES.RECONNECTING : CONNECTION_PHASES.OFFLINE, navigator.onLine ? retryNow : undefined);
      }
      return false;
    }

    const socket = coordinator.getCurrent();
    if (socket?.readyState === WebSocket.OPEN) {
      const recoveryAttempt = getRecoveryAttempt(msg, window);
      const wireMessage = stripRecoveryMetadata(msg);
      if (!joinRequestGuard.current.tryStart(socket, wireMessage)) return true;
      try {
        socket.send(JSON.stringify(wireMessage));
        if (recoveryAttempt) recoveryTracker.current.start(socket, recoveryAttempt);
        if (socket.bufferedAmount > MAX_BUFFERED_AMOUNT) {
          joinRequestGuard.current.clear(socket);
          recoveryTracker.current.cancel(socket);
          coordinator.failCurrent('send-backpressure');
          return false;
        }
        return true;
      } catch {
        joinRequestGuard.current.clear(socket);
        recoveryTracker.current.cancel(socket);
        coordinator.failCurrent('send-failed');
        return false;
      }
    }

    const now = Date.now();
    if (now - lastSendHintAt.current >= SEND_HINT_COOLDOWN) {
      lastSendHintAt.current = now;
      showConnectionPhase(navigator.onLine ? CONNECTION_PHASES.WAKING : CONNECTION_PHASES.OFFLINE, navigator.onLine ? retryNow : undefined);
    }
    return false;
  }, [retryNow]);

  return { send, connected, retryNow };
}
