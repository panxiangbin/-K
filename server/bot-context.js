function isActiveOpponent(player, botPlayerId) {
  return Boolean(
    player
    && player.id !== botPlayerId
    && !player.left
    && player.hand
    && player.hand.length > 0
  );
}

function summarizePlayedCards(cards) {
  const publicRankCounts = {};
  let playedJokers = 0;
  let publicScoreCards = 0;

  for (const card of Array.isArray(cards) ? cards : []) {
    if (!card || typeof card.rank !== 'string') continue;
    publicRankCounts[card.rank] = (publicRankCounts[card.rank] || 0) + 1;
    if (card.rank === '小王' || card.rank === '大王') playedJokers++;
    if (card.rank === '5') publicScoreCards += 5;
    else if (card.rank === '10' || card.rank === 'K') publicScoreCards += 10;
  }

  return {
    publicRankCounts,
    publicPlayedCount: Object.values(publicRankCounts).reduce((sum, count) => sum + count, 0),
    playedJokers,
    publicScoreCards,
  };
}

function getBotTurnContext(room, currentIndex, botPlayerId, calcPileScore) {
  const players = Array.isArray(room?.players) ? room.players : [];
  const activeOpponents = players.filter(player => isActiveOpponent(player, botPlayerId));
  const activeOpponentCount = activeOpponents.length;
  const globalMinOpponentCards = activeOpponentCount
    ? Math.min(...activeOpponents.map(player => player.hand.length))
    : Infinity;
  const pileScore = calcPileScore(room?.pile || []);
  const playedSummary = summarizePlayedCards(room?.playedCards || room?.pile || []);

  let nextOpponent = null;
  let nextOpponentSeatDistance = Infinity;
  for (let offset = 1; offset < players.length; offset++) {
    const candidate = players[(currentIndex + offset) % players.length];
    if (isActiveOpponent(candidate, botPlayerId)) {
      nextOpponent = candidate;
      nextOpponentSeatDistance = offset;
      break;
    }
  }

  const nextOpponentCards = nextOpponent ? nextOpponent.hand.length : Infinity;

  // “下家”指按当前出牌方向下一位仍在局且还有手牌的玩家；离场或已出完者必须跳过。
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
    nextOpponentId: nextOpponent ? nextOpponent.id : null,
    nextOpponentSeatDistance,
    globalMinOpponentCards,
    activeOpponentCount,
    threatSource,
    ...playedSummary,
  };
}

module.exports = { getBotTurnContext, isActiveOpponent, summarizePlayedCards };
