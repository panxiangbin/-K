function startWebSocketHeartbeat(wss, WebSocket, options = {}) {
  const intervalMs = options.intervalMs || 30000;
  const onSocketError = typeof options.onSocketError === 'function' ? options.onSocketError : () => {};

  const interval = setInterval(() => {
    for (const socket of wss.clients) {
      if (socket.readyState !== WebSocket.OPEN) continue;

      if (socket.isAlive === false) {
        try {
          socket.terminate();
        } catch (error) {
          onSocketError(error, socket, 'terminate');
        }
        continue;
      }

      socket.isAlive = false;
      try {
        socket.ping();
      } catch (error) {
        onSocketError(error, socket, 'ping');
        try {
          socket.terminate();
        } catch (terminateError) {
          onSocketError(terminateError, socket, 'terminate-after-ping');
        }
      }
    }
  }, intervalMs);

  if (typeof interval.unref === 'function') interval.unref();

  const stop = () => clearInterval(interval);
  wss.once('close', stop);

  wss.on('connection', socket => {
    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });
  });

  return { interval, stop };
}

module.exports = { startWebSocketHeartbeat };
