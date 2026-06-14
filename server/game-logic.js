// 牌面大小顺序
const CARD_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'];
const SCORE_MAP = { '5': 5, '10': 10, 'K': 10 };

function cardValue(card) {
  return CARD_ORDER.indexOf(card.rank);
}

function createDeck() {
  const suits = ['♠','♥','♦','♣'];
  const ranks = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
  const deck = [];
  // 两副牌
  for (let d = 0; d < 2; d++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ rank, suit, id: `${d}-${suit}-${rank}` });
      }
    }
    deck.push({ rank: '小王', suit: 'joker', id: `${d}-small-joker` });
    deck.push({ rank: '大王', suit: 'joker', id: `${d}-big-joker` });
  }
  return deck;
}

function shuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function dealCards(playerCount) {
  const deck = shuffle(createDeck()); // 108张
  let perPlayer, leftover;
  if (playerCount === 3) {
    perPlayer = 36; leftover = 0; // 108/3=36, 无剩余
  } else {
    perPlayer = 27; leftover = 0; // 108/4=27, 无剩余
  }
  const hands = [];
  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.slice(i * perPlayer, (i + 1) * perPlayer));
  }
  const extra = deck.slice(playerCount * perPlayer);
  return { hands, extra };
}

// 排序手牌
function sortCards(cards) {
  return [...cards].sort((a, b) => cardValue(a) - cardValue(b));
}

// 判断牌型
function detectPattern(cards) {
  if (!cards || cards.length === 0) return null;
  const n = cards.length;

  // 单张
  if (n === 1) return { type: 'single', rank: cards[0].rank, len: 1 };

  // 检查是否全是王的炸弹（大王+小王）
  const isJokerBomb = n === 2 && cards.some(c => c.rank === '大王') && cards.some(c => c.rank === '小王');
  if (isJokerBomb) return { type: 'bomb', rank: '小王', len: 2, isBiggest: true };

  // 按点数分组
  const rankCounts = {};
  for (const c of cards) {
    rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
  }
  const ranks = Object.keys(rankCounts);

  // 炸弹（四张+）
  if (ranks.length === 1) {
    if (n >= 4) return { type: 'bomb', rank: ranks[0], len: n, isBiggest: false };
    if (n === 3) return { type: 'triple', rank: ranks[0] };
    if (n === 2) return { type: 'pair', rank: ranks[0] };
  }

  // 顺子（5张以上连续单张，不含王和2）
  if (n >= 5 && ranks.length === n) {
    const vals = ranks.map(r => CARD_ORDER.indexOf(r));
    const noJokerNo2 = vals.every(v => v < CARD_ORDER.indexOf('2'));
    if (noJokerNo2) {
      const sorted = vals.sort((a, b) => a - b);
      let isSeq = true;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i-1] + 1) { isSeq = false; break; }
      }
      if (isSeq) return { type: 'straight', rank: CARD_ORDER[sorted[0]], len: n };
    }
  }

  // 连对（3对以上）
  const pairRanks = ranks.filter(r => rankCounts[r] === 2);
  if (pairRanks.length === ranks.length && pairRanks.length >= 3) {
    const vals = pairRanks.map(r => CARD_ORDER.indexOf(r));
    const noJokerNo2 = vals.every(v => v < CARD_ORDER.indexOf('2'));
    if (noJokerNo2) {
      const sorted = vals.sort((a, b) => a - b);
      let isSeq = true;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i-1] + 1) { isSeq = false; break; }
      }
      if (isSeq) return { type: 'pairs', rank: CARD_ORDER[sorted[0]], len: pairRanks.length };
    }
  }

  return null; // 不合法
}

// 比较两个牌型大小，返回true表示newPattern > oldPattern
function comparePatterns(newP, oldP) {
  if (!oldP) return true; // 首出

  // 炸弹压一切非炸弹
  if (newP.type === 'bomb' && oldP.type !== 'bomb') return true;
  if (newP.type !== 'bomb' && oldP.type === 'bomb') return false;

  // 同为炸弹：先比张数，再比点数
  if (newP.type === 'bomb' && oldP.type === 'bomb') {
    if (newP.isBiggest) return true;
    if (oldP.isBiggest) return false;
    if (newP.len !== oldP.len) return newP.len > oldP.len;
    return CARD_ORDER.indexOf(newP.rank) > CARD_ORDER.indexOf(oldP.rank);
  }

  // 类型不同，无法比较（不合法）
  if (newP.type !== oldP.type) return false;

  // 顺子/连对需相同长度
  if ((newP.type === 'straight' || newP.type === 'pairs') && newP.len !== oldP.len) return false;

  return CARD_ORDER.indexOf(newP.rank) > CARD_ORDER.indexOf(oldP.rank);
}

// 计算一墩牌中的得分
function calcPileScore(cards) {
  let score = 0;
  for (const c of cards) {
    score += SCORE_MAP[c.rank] || 0;
  }
  return score;
}

// 获得目标分数
function getTargetScores(playerCount) {
  if (playerCount === 3) return [30, 70, 100];
  return [20, 40, 60, 80];
}

module.exports = { createDeck, shuffle, dealCards, sortCards, detectPattern, comparePatterns, calcPileScore, getTargetScores, CARD_ORDER };
