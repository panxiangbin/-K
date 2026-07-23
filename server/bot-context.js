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

  const nextOpponentCards = nextOpponent ? nextOpponent.hand.length : Infinity;

  // 下家已进入1～3张的直接收尾区时，优先封锁马上行动的人。
  // 若下家暂时安全（4张以上），但桌上另有人只剩1～2张，则提前按全桌最危险玩家布防，
  // 避免电脑只盯着下家，等下一圈才发现远处玩家已经可以一手走完。
  let minOpponentCards = nextOpponentCards;
  let threatSource = nextOpponent ? 'next' : 'none';
  if (!Number.isFinite(nextOpponentCards)) {
    minOpponentCards = globalMinOpponentCards;
    threatSource = Number.isFinite(globalMinOpponentCards) ? 'table' : 'none';
  } else if (nextOpponentCards > 3 && globalMinOpponentCards <= 2) {
    minOpponentCards = globalMinOpponentCards;
    threatSource = 'table';
  }

  return {
    pileScore: calcPileScore(room?.pile || []),
    minOpponentCards,
    nextOpponentCards,
    globalMinOpponentCards,
    threatSource,
  };
}

module.exports = { getBotTurnContext };
