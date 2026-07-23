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
  const pileScore = calcPileScore(room?.pile || []);

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
  // 若下家暂时安全，但远处玩家只剩1～2张，则按牌堆价值分级处理：
  // 低分牌堆只保持观察，避免电脑过早改变正常牌型；20分及以上时才升级为全桌紧急威胁，
  // 让电脑更积极抢回高价值牌堆，同时不会因为远处一张牌就无条件乱炸。
  let minOpponentCards = nextOpponentCards;
  let threatSource = nextOpponent ? 'next' : 'none';
  if (!Number.isFinite(nextOpponentCards)) {
    minOpponentCards = globalMinOpponentCards;
    threatSource = Number.isFinite(globalMinOpponentCards) ? 'table' : 'none';
  } else if (nextOpponentCards > 3 && globalMinOpponentCards <= 2) {
    if (pileScore >= 20) {
      minOpponentCards = globalMinOpponentCards;
      threatSource = 'table';
    } else {
      minOpponentCards = nextOpponentCards;
      threatSource = 'table-watch';
    }
  }

  return {
    pileScore,
    minOpponentCards,
    nextOpponentCards,
    globalMinOpponentCards,
    threatSource,
  };
}

module.exports = { getBotTurnContext };
