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

function incrementCount(target, count) {
  target[count] = (target[count] || 0) + 1;
}

function incrementScore(target, count, score) {
  target[count] = (target[count] || 0) + score;
}

function summarizePublicPlays(plays, { botPlayerId = null, nextOpponentId = null } = {}) {
  const recentPlayCounts = {};
  const opponentPlayCounts = {};
  const nextOpponentPlayCounts = {};
  const tableOpponentPlayCounts = {};
  const nextOpponentRecentShapeScores = {};
  const tableOpponentRecentShapeScores = {};
  const publicBombCounts = {};
  const recentPlays = Array.isArray(plays) ? plays.slice(-12) : [];
  const nextOpponentPlays = [];
  let nextOpponentRecentType = null;
  let nextOpponentRecentCount = 0;

  for (let index = 0; index < recentPlays.length; index++) {
    const play = recentPlays[index];
    if (!play || !Number.isInteger(play.count) || play.count < 1) continue;
    incrementCount(recentPlayCounts, play.count);
    if (play.type === 'bomb' && play.bombType) {
      publicBombCounts[play.bombType] = (publicBombCounts[play.bombType] || 0) + 1;
    }

    const isBotPlay = botPlayerId && play.playerId === botPlayerId;
    if (isBotPlay) continue;
    incrementCount(opponentPlayCounts, play.count);
    const age = recentPlays.length - 1 - index;
    if (nextOpponentId && play.playerId === nextOpponentId) {
      incrementCount(nextOpponentPlayCounts, play.count);
      incrementScore(nextOpponentRecentShapeScores, play.count, Math.max(4, 20 - age * 3));
      nextOpponentRecentType = play.type || null;
      nextOpponentRecentCount = play.count;
      nextOpponentPlays.push(play);
    } else {
      incrementCount(tableOpponentPlayCounts, play.count);
      incrementScore(tableOpponentRecentShapeScores, play.count, Math.max(1, 5 - age));
    }
  }

  let nextOpponentShapeStreakCount = 0;
  let nextOpponentShapeStreakLength = 0;
  for (let index = nextOpponentPlays.length - 1; index >= 0; index--) {
    const play = nextOpponentPlays[index];
    if (!nextOpponentShapeStreakCount) nextOpponentShapeStreakCount = play.count;
    if (play.count !== nextOpponentShapeStreakCount) break;
    nextOpponentShapeStreakLength++;
  }

  return {
    recentPlayCounts,
    opponentPlayCounts,
    nextOpponentPlayCounts,
    tableOpponentPlayCounts,
    nextOpponentRecentShapeScores,
    tableOpponentRecentShapeScores,
    nextOpponentShapeStreakCount,
    nextOpponentShapeStreakLength,
    publicBombCounts,
    recentPlayType: recentPlays.length ? recentPlays[recentPlays.length - 1].type || null : null,
    recentPlayCount: recentPlays.length ? recentPlays[recentPlays.length - 1].count || 0 : 0,
    nextOpponentRecentType,
    nextOpponentRecentCount,
    publicBombTotal: Object.values(publicBombCounts).reduce((sum, count) => sum + count, 0),
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

  const playSummary = summarizePublicPlays(room?.publicPlays || [], {
    botPlayerId,
    nextOpponentId: nextOpponent ? nextOpponent.id : null,
  });
  const nextOpponentCards = nextOpponent ? nextOpponent.hand.length : Infinity;
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
    ...playSummary,
  };
}

module.exports = { getBotTurnContext, isActiveOpponent, summarizePlayedCards, summarizePublicPlays };