const {
  sortCards,
  detectPattern,
  comparePatterns,
  calcPileScore,
  CARD_ORDER,
} = require('./game-logic');

function cardValue(rank) {
  const value = CARD_ORDER.indexOf(rank);
  return value < 0 ? CARD_ORDER.length : value;
}

function isBlack(suit) {
  return suit === '♠' || suit === '♣';
}

function isRed(suit) {
  return suit === '♥' || suit === '♦';
}

function groupByRank(hand) {
  const groups = {};
  for (const card of hand) {
    if (!groups[card.rank]) groups[card.rank] = [];
    groups[card.rank].push(card);
  }
  return groups;
}

function find50KBombs(hand) {
  const results = [];
  for (const suit of ['♠', '♥', '♣', '♦']) {
    const five = hand.find(card => card.rank === '5' && card.suit === suit);
    const ten = hand.find(card => card.rank === '10' && card.suit === suit);
    const king = hand.find(card => card.rank === 'K' && card.suit === suit);
    if (five && ten && king) results.push([five, ten, king]);
  }
  return results;
}

function comboKey(cards) {
  return cards.map(card => card.id).sort().join('|');
}

function getCandidateCombos(hand) {
  const sorted = sortCards(hand);
  const groups = groupByRank(sorted);
  const combos = [];
  const seen = new Set();

  function add(cards) {
    if (!cards || !cards.length) return;
    const key = comboKey(cards);
    if (seen.has(key)) return;
    seen.add(key);
    combos.push(cards);
  }

  for (const card of sorted) add([card]);

  for (const group of Object.values(groups)) {
    for (let count = 2; count <= Math.min(8, group.length); count++) {
      add(group.slice(0, count));
    }

    const blacks = group.filter(card => isBlack(card.suit));
    const reds = group.filter(card => isRed(card.suit));
    if (blacks.length >= 4) add(blacks.slice(0, 4));
    if (reds.length >= 4) add(reds.slice(0, 4));
  }

  for (const bomb of find50KBombs(sorted)) add(bomb);

  const big = sorted.filter(card => card.rank === '大王');
  const small = sorted.filter(card => card.rank === '小王');
  if (big.length >= 2 && small.length >= 2) {
    add([big[0], big[1], small[0], small[1]]);
  }

  return combos;
}

function getProtectedBombCardIds(hand) {
  const protectedIds = new Set();
  const groups = groupByRank(hand);

  for (const group of Object.values(groups)) {
    if (group.length >= 8) {
      for (const card of group.slice(0, 8)) protectedIds.add(card.id);
    }

    const blacks = group.filter(card => isBlack(card.suit));
    const reds = group.filter(card => isRed(card.suit));
    if (blacks.length >= 4) {
      for (const card of blacks.slice(0, 4)) protectedIds.add(card.id);
    }
    if (reds.length >= 4) {
      for (const card of reds.slice(0, 4)) protectedIds.add(card.id);
    }
  }

  for (const bomb of find50KBombs(hand)) {
    for (const card of bomb) protectedIds.add(card.id);
  }

  const big = hand.filter(card => card.rank === '大王');
  const small = hand.filter(card => card.rank === '小王');
  if (big.length >= 2 && small.length >= 2) {
    for (const card of [big[0], big[1], small[0], small[1]]) protectedIds.add(card.id);
  }

  return protectedIds;
}

function patternWeight(pattern) {
  if (!pattern) return 999999;
  if (pattern.type !== 'bomb') return cardValue(pattern.rank);

  const bombOrder = { '50K': 1, color4: 2, same8: 3, joker4: 4 };
  let score = (bombOrder[pattern.bombType] || 9) * 1000;

  if (pattern.bombType === '50K') {
    score += ['♦', '♣', '♥', '♠'].indexOf(pattern.suit) + 1;
  } else if (pattern.bombType === 'color4') {
    score += cardValue(pattern.rank) * 2 + (pattern.color === 'black' ? 2 : 1);
  } else {
    score += cardValue(pattern.rank || '3');
  }

  return score;
}

function estimateRemainingStructure(hand, playedCards) {
  const playedIds = new Set(playedCards.map(card => card.id));
  const remainingHand = hand.filter(card => !playedIds.has(card.id));
  const groups = Object.values(groupByRank(remainingHand));
  const singletonCount = groups.filter(group => group.length === 1).length;
  const pairOrBetterCount = groups.filter(group => group.length >= 2).length;
  const controlGroups = groups.filter(group => group.length >= 2);
  const strongestControlGroup = controlGroups.sort((a, b) => {
    const rankDiff = cardValue(b[0].rank) - cardValue(a[0].rank);
    return rankDiff || b.length - a.length;
  })[0] || null;

  return {
    estimatedTurns: groups.length,
    singletonCount,
    pairOrBetterCount,
    remainingPoints: calcPileScore(remainingHand),
    remainingControlRank: strongestControlGroup ? cardValue(strongestControlGroup[0].rank) : -1,
    remainingControlSize: strongestControlGroup ? strongestControlGroup.length : 0,
  };
}

function describeCandidate(candidate, hand, groups, protectedIds) {
  const { cards, pattern } = candidate;
  const isBomb = pattern.type === 'bomb';
  const sameRank = cards.every(card => card.rank === cards[0].rank);
  const sourceGroupSize = sameRank ? (groups[cards[0].rank]?.length || cards.length) : cards.length;
  const splitCount = !isBomb && sameRank ? Math.max(0, sourceGroupSize - cards.length) : 0;
  const breaksBomb = !isBomb && cards.some(card => protectedIds.has(card.id));
  const remaining = hand.length - cards.length;
  const points = calcPileScore(cards);
  const structure = estimateRemainingStructure(hand, cards);

  return {
    ...candidate,
    isBomb,
    splitCount,
    breaksBomb,
    remaining,
    points,
    rankValue: cardValue(pattern.rank || cards[0]?.rank),
    ...structure,
  };
}

function normalizeContext(context) {
  const pileScore = Number.isFinite(context?.pileScore) ? Math.max(0, context.pileScore) : 0;
  const minOpponentCards = Number.isFinite(context?.minOpponentCards)
    ? Math.max(0, context.minOpponentCards)
    : Infinity;
  return { pileScore, minOpponentCards };
}

function scoreLead(candidate, handLength, context) {
  if (candidate.remaining === 0) return -1000000;

  let score = 0;
  score -= candidate.cards.length * 190;
  score += candidate.rankValue * 12;

  // 对手只剩一张时，主动出单张等于把最容易匹配的牌型送到对方面前。
  // 只要手里还有对子、三张等合法非炸弹牌型，就优先用多张牌封住对手的单张收尾机会。
  if (context.minOpponentCards <= 1) {
    if (candidate.pattern.type === 'single') score += 2600;
    else if (!candidate.isBomb) score -= Math.min(candidate.cards.length, 4) * 180;
  }

  // 中前盘避免过早把10、K等成组分牌直接送出；进入残局或对手牌少时，
  // 则主动处理完整分牌组，避免高分对子/三张拖到最后失去牌权。
  const scoreCardUrgency = handLength <= 6 || context.minOpponentCards <= 2;
  score += candidate.points * (scoreCardUrgency ? -8 : 10);

  if (candidate.splitCount > 0) score += 850 + candidate.splitCount * 180;
  if (candidate.breaksBomb) score += 3200;

  score += candidate.estimatedTurns * 210;
  score += candidate.singletonCount * 95;
  score -= candidate.pairOrBetterCount * 25;

  // 两三手残局优先先处理较难重新拿牌权的低牌组，把较大的对子/三张留作控制牌。
  // 只在剩余结构很短时启用，避免中盘为了“留大牌”而破坏正常的整组出牌节奏。
  if (handLength <= 7 && candidate.estimatedTurns <= 2 && candidate.remainingControlSize >= 2) {
    score -= candidate.remainingControlRank * 14;
    score -= Math.min(candidate.remainingControlSize, 4) * 12;
  }

  // 残局里不要把5、10、K分牌孤零零留到最后送给对手。
  // 手牌越少，留下的分值惩罚越高；中前盘只做轻微倾向，避免过早乱甩分。
  if (candidate.remaining <= 5) {
    const endgameFactor = 6 - candidate.remaining;
    score += candidate.remainingPoints * endgameFactor * 18;
  } else {
    score += candidate.remainingPoints * 2;
  }

  if (candidate.isBomb) {
    score += handLength <= 8 ? 180 : 1900;
    score += patternWeight(candidate.pattern) / 20;
  }

  return score;
}

function scoreFollow(candidate, context) {
  if (candidate.remaining === 0) return -1000000;

  let score = candidate.rankValue * 20 + candidate.points * 8;
  if (candidate.splitCount > 0) score += 700 + candidate.splitCount * 160;
  if (candidate.breaksBomb) score += 3000;

  // 跟牌不只看“刚好压住”，还看出完后手牌是否更整齐。
  // 少孤张、保留更多对子或三张，通常比留下散牌更容易连续收尾。
  score += candidate.estimatedTurns * 120;
  score += candidate.singletonCount * 260;
  score -= candidate.pairOrBetterCount * 60;

  if (candidate.remaining <= 4) {
    score += candidate.remainingPoints * (5 - candidate.remaining) * 12;
  }

  if (candidate.isBomb) {
    score += patternWeight(candidate.pattern);

    const endgameEmergency = context.minOpponentCards <= 1;
    const highValueEmergency = context.minOpponentCards <= 2 && context.pileScore >= 20;
    if (endgameEmergency) score -= 2600;
    else if (highValueEmergency) score -= 1800;
  }

  return score;
}

function chooseBotMove(hand, lastPlay, rawContext = {}) {
  if (!Array.isArray(hand) || hand.length === 0) return null;

  const context = normalizeContext(rawContext);
  const groups = groupByRank(hand);
  const protectedIds = getProtectedBombCardIds(hand);
  const candidates = getCandidateCombos(hand)
    .map(cards => ({ cards, pattern: detectPattern(cards) }))
    .filter(candidate => candidate.pattern && comparePatterns(candidate.pattern, lastPlay))
    .map(candidate => describeCandidate(candidate, hand, groups, protectedIds));

  if (!candidates.length) return null;

  const finishing = candidates
    .filter(candidate => candidate.remaining === 0)
    .sort((a, b) => b.cards.length - a.cards.length || patternWeight(a.pattern) - patternWeight(b.pattern));
  if (finishing.length) return finishing[0].cards;

  if (!lastPlay) {
    const nonBombs = candidates.filter(candidate => !candidate.isBomb);
    const pool = nonBombs.length ? nonBombs : candidates;
    return pool.sort((a, b) => scoreLead(a, hand.length, context) - scoreLead(b, hand.length, context))[0].cards;
  }

  if (lastPlay.type !== 'bomb') {
    const sameType = candidates.filter(candidate => candidate.pattern.type === lastPlay.type);
    const urgent = context.minOpponentCards <= 1 || (context.minOpponentCards <= 2 && context.pileScore >= 20);
    if (sameType.length && !urgent) {
      return sameType.sort((a, b) => scoreFollow(a, context) - scoreFollow(b, context))[0].cards;
    }
  }

  return candidates.sort((a, b) => scoreFollow(a, context) - scoreFollow(b, context))[0].cards;
}

module.exports = { chooseBotMove };
