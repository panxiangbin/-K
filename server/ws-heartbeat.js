function startWebSocketHeartbeat(wss, WebSocket, options = {}) {
  const intervalMs = options.intervalMs || 30000;
  const onSocketError = typeof options.onSocketError === 'function' ? options.onSocketError : () => {};
  const boundSockets = new WeakSet();

  function bindSocket(socket, initialize = false) {
    if (!socket || boundSockets.has(socket)) return;
    boundSockets.add(socket);
    if (initialize || typeof socket.isAlive !== 'boolean') socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });
  }

  // 服务接管、测试或热重载时，现存连接也必须能通过pong恢复存活状态。
  // 显式标记为false的连接保持失活，下一次检查仍会被清理。
  for (const socket of wss.clients || []) bindSocket(socket, false);

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
  wss.on('connection', socket => bindSocket(socket, true));

  return { interval, stop };
}

module.exports = { startWebSocketHeartbeat };
