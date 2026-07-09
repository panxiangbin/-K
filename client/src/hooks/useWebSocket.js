import { useEffect, useRef, useCallback, useState } from 'react';

const RAILWAY_URL = 'wss://henan-50k-production-9ecf.up.railway.app';

function getWsUrl() {
  const { protocol, hostname, port, host } = window.location;

  // Capacitor APK 没有同源 WebSocket，默认连线上服务。
  if (protocol === 'capacitor:') return RAILWAY_URL;

  // Vite 开发、本地打包预览、本地后端测试，都优先连本机服务器。
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `ws://${hostname}:3002`;
  }

  // 生产 Web（Railway / Render 等）走同源 WebSocket。
  return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`;
}

export function useWebSocket(onMessage) {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const [connected, setConnected] = useState(false);
  const onMsg = useRef(onMessage);
  onMsg.current = onMessage;

  useEffect(() => {
    const url = getWsUrl();
    let stopped = false;

    function connect() {
      if (stopped) return;
      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (!stopped) reconnectTimer.current = setTimeout(connect, 2000);
      };
      socket.onerror = () => socket.close();
      socket.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          onMsg.current(msg);
        } catch {}
      };
    }

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (ws.current) ws.current.onclose = null;
      ws.current?.close();
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
