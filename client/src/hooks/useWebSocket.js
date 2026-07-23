import { useEffect, useRef, useCallback, useState } from 'react';

const RENDER_URL = 'wss://henan-50k.onrender.com';
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 15000;
const CONNECT_TIMEOUT = 12000;

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

export function useWebSocket(onMessage) {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const connectTimer = useRef(null);
  const reconnectDelay = useRef(INITIAL_RECONNECT_DELAY);
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
        reconnectDelay.current = INITIAL_RECONNECT_DELAY;
        setConnected(true);
      };

      socket.onclose = () => {
        clearConnectTimer();
        if (ws.current === socket) ws.current = null;
        setConnected(false);
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
      setConnected(false);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') reconnectNow();
    }

    window.addEventListener('online', reconnectNow);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    connect();

    return () => {
      stopped = true;
      clearConnectTimer();
      clearReconnectTimer();
      window.removeEventListener('online', reconnectNow);
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
    return false;
  }, []);

  return { send, connected };
}
