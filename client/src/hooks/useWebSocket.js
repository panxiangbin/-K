import { useEffect, useRef, useCallback, useState } from 'react';
import { createJoinRequestGuard } from '../join-request-guard';
import { createWebSocketCoordinator } from '../websocket-coordinator';
import { CONNECTION_PHASES, getConnectionStatusView } from '../connection-status';
import { publishServerRejection } from '../server-error-feedback';

const RENDER_URL = 'wss://henan-50k.onrender.com';
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 15000;
const CONNECT_TIMEOUT = 12000;
const MAX_BUFFERED_AMOUNT = 256 * 1024;
const WAKE_HINT_DELAY = 6000;
const SEND_HINT_COOLDOWN = 1500;
const STATUS_BANNER_ID = 'henan50k-connection-status';
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

function getStatusBanner() {
  let banner = document.getElementById(STATUS_BANNER_ID);
  if (banner) return banner;
  banner = document.createElement('div');
  banner.id = STATUS_BANNER_ID;
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.setAttribute('aria-atomic', 'true');
  Object.assign(banner.style, {
    position: 'fixed', left: '50%', bottom: 'max(18px, env(safe-area-inset-bottom))',
    transform: 'translateX(-50%)', zIndex: '1200', width: 'min(calc(100% - 32px), 440px)',
    boxSizing: 'border-box', padding: '10px 12px', borderRadius: '14px',
    border: '1px solid rgba(251, 191, 36, 0.38)', background: 'rgba(30, 41, 59, 0.96)',
    color: '#f8fafc', boxShadow: '0 10px 28px rgba(0, 0, 0, 0.32)', backdropFilter: 'blur(10px)',
    fontSize: '13px', lineHeight: '1.45', textAlign: 'center', pointerEvents: 'auto',
  });
  document.body.appendChild(banner);
  return banner;
}

function showConnectionPhase(phase, onRetry) {
  const view = getConnectionStatusView(phase);
  const banner = getStatusBanner();
  banner.replaceChildren();
  const text = document.createElement('span');
  text.textContent = view.text;
  banner.appendChild(text);
  if (view.retryable && typeof onRetry === 'function') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '立即重试';
    button.setAttribute('aria-label', '立即重新连接游戏服务器');
    Object.assign(button.style, {
      marginLeft: '10px', minHeight: '36px', padding: '0 12px', borderRadius: '999px',
      border: '1px solid rgba(250, 204, 21, .55)', background: 'rgba(120, 53, 15, .72)',
      color: '#fef3c7', fontWeight: '800', cursor: 'pointer',
    });
    button.addEventListener('click', onRetry, { once: true });
    banner.appendChild(button);
  }
  banner.style.borderColor = view.tone === 'offline' ? 'rgba(248, 113, 113, 0.48)' : 'rgba(251, 191, 36, 0.38)';
  banner.style.color = view.tone === 'offline' ? '#fecaca' : '#fef3c7';
}

function hideConnectionStatus() {
  document.getElementById(STATUS_BANNER_ID)?.remove();
}

export function useWebSocket(onMessage) {
  const coordinatorRef = useRef(null);
  const wakeHintTimer = useRef(null);
  const lastSendHintAt = useRef(0);
  const joinRequestGuard = useRef(createJoinRequestGuard());
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
      onDisposeSocket: (socket) => joinRequestGuard.current.clear(socket),
      onMessage: (event, socket) => {
        try {
          let msg = JSON.parse(event.data);
          if (msg.type === 'room_joined' || msg.type === 'error') joinRequestGuard.current.clear(socket);
          if (msg.type === 'error') msg = { ...msg, msg: publishServerRejection(msg.msg, window) };
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

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    publishConnectionState(false);
    if (!navigator.onLine) handleOffline();
    else coordinator.connect();

    return () => {
      stopped = true;
      clearWakeHintTimer();
      hideConnectionStatus();
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
      if (!joinRequestGuard.current.tryStart(socket, msg)) return true;
      try {
        socket.send(JSON.stringify(msg));
        if (socket.bufferedAmount > MAX_BUFFERED_AMOUNT) {
          joinRequestGuard.current.clear(socket);
          coordinator.failCurrent('send-backpressure');
          return false;
        }
        return true;
      } catch {
        joinRequestGuard.current.clear(socket);
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
