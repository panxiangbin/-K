import { useEffect, useRef, useCallback, useState } from 'react';

const RAILWAY_URL = 'wss://henan-50k-production-9ecf.up.railway.app';

function getWsUrl() {
  const { protocol, hostname, port, host } = window.location;
  // Vite 开发模式
  if (port === '5173') return 'ws://localhost:3002';
  // Capacitor APK / 本地 localhost (非开发)
  if (protocol === 'capacitor:' || hostname === 'localhost' || hostname === '127.0.0.1') {
    return RAILWAY_URL;
  }
  // 生产 Web（Railway 等）
  return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`;
}

export function useWebSocket(onMessage) {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const onMsg = useRef(onMessage);
  onMsg.current = onMessage;

  useEffect(() => {
    const url = getWsUrl();

    function connect() {
      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        setTimeout(connect, 2000);
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
      if (ws.current) ws.current.onclose = null;
      ws.current?.close();
    };
  }, []);

  const send = useCallback((msg) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send, connected };
}
