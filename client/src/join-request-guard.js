export function createJoinRequestGuard({ cooldownMs = 3000, now = () => Date.now() } = {}) {
  let pending = null;
  let recentlyJoined = null;

  function makeKey(message) {
    if (!message || message.type !== 'join_room') return null;
    return JSON.stringify([
      message.roomId || '',
      message.playerId || '',
      message.playerToken || '',
      message.playerName || '',
    ]);
  }

  return {
    tryStart(socket, message) {
      const key = makeKey(message);
      if (!key) return true;

      const startedAt = now();
      if (
        recentlyJoined
        && recentlyJoined.socket === socket
        && startedAt - recentlyJoined.at < cooldownMs
      ) {
        return false;
      }
      if (
        pending
        && pending.socket === socket
        && pending.key === key
        && startedAt - pending.startedAt < cooldownMs
      ) {
        return false;
      }

      pending = { socket, key, startedAt };
      return true;
    },

    clear(socket) {
      if (socket) recentlyJoined = { socket, at: now() };
      if (!socket || pending?.socket === socket) pending = null;
    },
  };
}
