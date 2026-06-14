import { useEffect, useRef, useCallback, useState } from 'react';

export function useWebSocket(onMessage) {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const onMsg = useRef(onMessage);
  onMsg.current = onMessage;

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // 开发时 vite 在 5173，服务器在 3002；生产时同 host
    const host = window.location.port === '5173' ? `${window.location.hostname}:3002` : window.location.host;
    const url = `${proto}://${host}`;

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
