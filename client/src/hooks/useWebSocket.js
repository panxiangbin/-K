import { useEffect, useRef, useCallback, useState } from 'react';
import { createJoinRequestGuard } from '../join-request-guard';
import { createWebSocketCoordinator } from '../websocket-coordinator';

const RENDER_URL = 'wss://henan-50k.onrender.com';
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 15000;
const CONNECT_TIMEOUT = 12000;
const MAX_BUFFERED_AMOUNT = 256 * 1024;
const WAKE_HINT_DELAY = 6000;
const SEND_HINT_COOLDOWN = 1500;
const STATUS_BANNER_ID = 'henan50k-connection-status';

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
  Object.assign(banner.style, {
    position: 'fixed', left: '50%', bottom: 'max(18px, env(safe-area-inset-bottom))',
    transform: 'translateX(-50%)', zIndex: '1200', width: 'min(calc(100% - 32px), 440px)',
    boxSizing: 'border-box', padding: '10px 14px', borderRadius: '14px',
    border: '1px solid rgba(251, 191, 36, 0.38)', background: 'rgba(30, 41, 59, 0.94)',
    color: '#f8fafc', boxShadow: '0 10px 28px rgba(0, 0, 0, 0.32)', backdropFilter: 'blur(10px)',
    fontSize: '13px', lineHeight: '1.45', textAlign: 'center', pointerEvents: 'none',
  });
  document.body.appendChild(banner);
  return banner;
}

function showConnectionStatus(text, tone = 'waking') {
  const banner = getStatusBanner();
  banner.textContent = text;
  banner.style.borderColor = tone === 'offline' ? 'rgba(248, 113, 113, 0.48)' : 'rgba(251, 191, 36, 0.38)';
  banner.style.color = tone === 'offline' ? '#fecaca' : '#fef3c7';
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

  useEffect(() => {
    let stopped = false;

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
        showConnectionStatus('服务器正在启动，首次打开可能需要稍等一会儿，页面会自动连接。');
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
        setConnected(true);
      },
      onClose: (_, __, state) => {
        if (!state.isCurrent) return;
        setConnected(false);
        if (!navigator.onLine) return;
        if (state.reason === 'send-failed') {
          showConnectionStatus('消息发送失败，正在重新连接游戏服务器…');
        } else if (state.reason?.endsWith('-backpressure')) {
          showConnectionStatus('连接响应过慢，正在重新建立连接…');
        }
        scheduleWakeHint();
      },
      onDisposeSocket: (socket) => joinRequestGuard.current.clear(socket),
      onMessage: (event, socket) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'room_joined' || msg.type === 'error') joinRequestGuard.current.clear(socket);
          onMsg.current(msg);
        } catch {
          // 忽略无法解析的非协议消息，保持连接继续工作。
        }
      },
    });
    coordinatorRef.current = coordinator;

    function handleOffline() {
      clearWakeHintTimer();
      setConnected(false);
      showConnectionStatus('当前网络已断开，网络恢复后会自动重新连接。', 'offline');
      coordinator.goOffline();
    }

    function handleOnline() {
      showConnectionStatus('网络已恢复，正在重新连接游戏服务器…');
      coordinator.goOnline();
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      if (!coordinator.ensureCurrent('visibility')) setConnected(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
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
    };
  }, []);

  const send = useCallback((msg) => {
    const coordinator = coordinatorRef.current;
    if (!coordinator?.ensureCurrent('send')) {
      setConnected(false);
      const now = Date.now();
      if (now - lastSendHintAt.current >= SEND_HINT_COOLDOWN) {
        lastSendHintAt.current = now;
        if (navigator.onLine) showConnectionStatus('连接状态异常，正在重新连接游戏服务器…');
        else showConnectionStatus('当前网络已断开，网络恢复后会自动重新连接。', 'offline');
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
      if (navigator.onLine) showConnectionStatus('游戏服务器尚未连接，请稍等，连接成功后再试一次。');
      else showConnectionStatus('当前网络已断开，网络恢复后会自动重新连接。', 'offline');
    }
    return false;
  }, []);

  return { send, connected };
}
