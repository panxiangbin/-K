import { useEffect, useRef, useCallback, useState } from 'react';

const RENDER_URL = 'wss://henan-50k.onrender.com';
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 15000;
const CONNECT_TIMEOUT = 12000;
const WAKE_HINT_DELAY = 6000;
const SEND_HINT_COOLDOWN = 1500;
const STATUS_BANNER_ID = 'henan50k-connection-status';

function getWsUrl() {
  const { protocol, hostname, host } = window.location;

  // Capacitor APK 没有同源 WebSocket，默认连接当前 Render 服务。
  if (protocol === 'capacitor:') return RENDER_URL;

  // Vite 开发、本地打包预览、本地后端测试，都优先连本机服务器。
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `ws://${hostname}:3002`;
  }

  // 生产 Web 走同源 WebSocket，避免部署域名变化后仍连接旧服务器。
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
    position: 'fixed',
    left: '50%',
    bottom: 'max(18px, env(safe-area-inset-bottom))',
    transform: 'translateX(-50%)',
    zIndex: '1200',
    width: 'min(calc(100% - 32px), 440px)',
    boxSizing: 'border-box',
    padding: '10px 14px',
    borderRadius: '14px',
    border: '1px solid rgba(251, 191, 36, 0.38)',
    background: 'rgba(30, 41, 59, 0.94)',
    color: '#f8fafc',
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.32)',
    backdropFilter: 'blur(10px)',
    fontSize: '13px',
    lineHeight: '1.45',
    textAlign: 'center',
    pointerEvents: 'none',
  });
  document.body.appendChild(banner);
  return banner;
}

function showConnectionStatus(text, tone = 'waking') {
  const banner = getStatusBanner();
  banner.textContent = text;
  banner.style.borderColor = tone === 'offline'
    ? 'rgba(248, 113, 113, 0.48)'
    : 'rgba(251, 191, 36, 0.38)';
  banner.style.color = tone === 'offline' ? '#fecaca' : '#fef3c7';
}

function hideConnectionStatus() {
  document.getElementById(STATUS_BANNER_ID)?.remove();
}

export function useWebSocket(onMessage) {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const connectTimer = useRef(null);
  const wakeHintTimer = useRef(null);
  const reconnectDelay = useRef(INITIAL_RECONNECT_DELAY);
  const lastSendHintAt = useRef(0);
  const [connected, setConnected] = useState(false);
  const onMsg = useRef(onMessage);
  onMsg.current = onMessage;

  useEffect(() => {
    const url = getWsUrl();
    let stopped = false;

    function clearReconnectTimer() {
      if (!reconnectTimer.current) return;
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    function clearConnectTimer() {
      if (!connectTimer.current) return;
      clearTimeout(connectTimer.current);
      connectTimer.current = null;
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
        if (stopped || ws.current?.readyState === WebSocket.OPEN || !navigator.onLine) return;
        showConnectionStatus('服务器正在启动，首次打开可能需要稍等一会儿，页面会自动连接。');
      }, WAKE_HINT_DELAY);
    }

    function scheduleReconnect() {
      if (stopped || reconnectTimer.current || !navigator.onLine) return;
      const delay = reconnectDelay.current;
      reconnectTimer.current = setTimeout(() => {
        reconnectTimer.current = null;
        connect();
      }, delay);
      reconnectDelay.current = Math.min(MAX_RECONNECT_DELAY, Math.round(delay * 1.8));
    }

    function connect() {
      if (stopped || !navigator.onLine) return;
      if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) return;

      const socket = new WebSocket(url);
      ws.current = socket;
      clearConnectTimer();
      scheduleWakeHint();

      // 某些手机网络或服务器刚唤醒时，WebSocket 可能长期卡在 CONNECTING。
      // 超时后主动关闭并进入退避重连，避免界面永远停在“连接中”。
      connectTimer.current = setTimeout(() => {
        if (stopped || ws.current !== socket || socket.readyState !== WebSocket.CONNECTING) return;
        socket.close();
      }, CONNECT_TIMEOUT);

      socket.onopen = () => {
        if (stopped || ws.current !== socket) return;
        clearConnectTimer();
        clearReconnectTimer();
        clearWakeHintTimer();
        hideConnectionStatus();
        reconnectDelay.current = INITIAL_RECONNECT_DELAY;
        setConnected(true);
      };

      socket.onclose = () => {
        clearConnectTimer();
        if (ws.current === socket) ws.current = null;
        setConnected(false);
        if (navigator.onLine) scheduleWakeHint();
        scheduleReconnect();
      };

      socket.onerror = () => socket.close();
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          onMsg.current(msg);
        } catch {
          // 忽略无法解析的非协议消息，保持连接继续工作。
        }
      };
    }

    function reconnectNow() {
      if (stopped || !navigator.onLine) return;
      clearReconnectTimer();
      reconnectDelay.current = INITIAL_RECONNECT_DELAY;

      // 页面恢复或网络恢复时，如果旧连接仍卡住，直接丢弃并重新建立。
      if (ws.current?.readyState === WebSocket.CONNECTING) {
        const staleSocket = ws.current;
        ws.current = null;
        clearConnectTimer();
        staleSocket.close();
      }

      if (!ws.current || ws.current.readyState === WebSocket.CLOSED) connect();
    }

    function handleOffline() {
      clearReconnectTimer();
      clearConnectTimer();
      clearWakeHintTimer();
      setConnected(false);
      showConnectionStatus('当前网络已断开，网络恢复后会自动重新连接。', 'offline');

      // 浏览器的 OPEN 状态可能滞后于真实网络状态；主动丢弃，
      // 网络恢复后由 online 事件建立一条全新的连接。
      const staleSocket = ws.current;
      ws.current = null;
      if (staleSocket) staleSocket.close();
    }

    function handleOnline() {
      showConnectionStatus('网络已恢复，正在重新连接游戏服务器…');
      reconnectNow();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') reconnectNow();
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (!navigator.onLine) handleOffline();
    else connect();

    return () => {
      stopped = true;
      clearConnectTimer();
      clearReconnectTimer();
      clearWakeHintTimer();
      hideConnectionStatus();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      const socket = ws.current;
      ws.current = null;
      if (socket) {
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        socket.close();
      }
    };
  }, []);

  const send = useCallback((msg) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
      return true;
    }

    // 用户在服务器尚未唤醒或网络断开时点击按钮，原来会像“没反应”。
    // 现在给出明确提示；冷却时间避免快速连点时反复刷新状态播报。
    const now = Date.now();
    if (now - lastSendHintAt.current >= SEND_HINT_COOLDOWN) {
      lastSendHintAt.current = now;
      if (navigator.onLine) {
        showConnectionStatus('游戏服务器尚未连接，请稍等，连接成功后再试一次。');
      } else {
        showConnectionStatus('当前网络已断开，网络恢复后会自动重新连接。', 'offline');
      }
    }
    return false;
  }, []);

  return { send, connected };
}
