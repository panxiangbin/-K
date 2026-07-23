function isActiveOpponent(player, botPlayerId) {
  return Boolean(
    player
    && player.id !== botPlayerId
    && !player.left
    && player.hand
    && player.hand.length > 0
  );
}

function getBotTurnContext(room, currentIndex, botPlayerId, calcPileScore) {
  const players = Array.isArray(room?.players) ? room.players : [];
  const activeOpponents = players.filter(player => isActiveOpponent(player, botPlayerId));
  const globalMinOpponentCards = activeOpponents.length
    ? Math.min(...activeOpponents.map(player => player.hand.length))
    : Infinity;

  let nextOpponent = null;
  for (let offset = 1; offset < players.length; offset++) {
    const candidate = players[(currentIndex + offset) % players.length];
    if (isActiveOpponent(candidate, botPlayerId)) {
      nextOpponent = candidate;
      break;
    }
  }

  return {
    pileScore: calcPileScore(room?.pile || []),
    // 先看紧接着行动的人。纸牌残局里，下家能否立刻走完比远处玩家更紧迫。
    // 若座位数据异常或没有可行动下家，再退回全桌最少手牌数。
    minOpponentCards: nextOpponent ? nextOpponent.hand.length : globalMinOpponentCards,
    nextOpponentCards: nextOpponent ? nextOpponent.hand.length : Infinity,
    globalMinOpponentCards,
  };
}

module.exports = { getBotTurnContext };
