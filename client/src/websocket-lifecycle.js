export function bindWebSocketLifecycle(socket, {
  isCurrent,
  onOpen = () => {},
  onClose = () => {},
  onError = () => {},
  onMessage = () => {},
} = {}) {
  if (!socket || typeof socket !== 'object') throw new TypeError('socket is required');
  if (typeof isCurrent !== 'function') throw new TypeError('isCurrent must be a function');
  for (const [name, handler] of Object.entries({ onOpen, onClose, onError, onMessage })) {
    if (typeof handler !== 'function') throw new TypeError(`${name} must be a function`);
  }

  let detached = false;
  const active = () => !detached && Boolean(isCurrent(socket));

  socket.onopen = (event) => {
    if (active()) onOpen(event, socket);
  };

  socket.onclose = (event) => {
    if (detached) return;
    onClose(event, socket, { isCurrent: active() });
  };

  socket.onerror = (event) => {
    if (active()) onError(event, socket);
  };

  socket.onmessage = (event) => {
    if (active()) onMessage(event, socket);
  };

  return function detach() {
    if (detached) return;
    detached = true;
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
  };
}
