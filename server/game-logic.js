// 牌序（从小到大）
const CARD_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'];
const SCORE_MAP = { '5': 5, '10': 10, 'K': 10 };

// 炸弹等级（从小到大）
const BOMB_LEVEL = { '50K': 1, 'color4': 2, 'same8': 3, 'joker4': 4 };

// 五十K花色大小：黑桃 > 红桃 > 梅花 > 方块
const SUIT_ORDER = { '♠': 4, '♥': 3, '♣': 2, '♦': 1 };

function cardValue(rank) {
  return CARD_ORDER.indexOf(rank);
}

function isBlack(suit) { return suit === '♠' || suit === '♣'; }
function isRed(suit)   { return suit === '♥' || suit === '♦'; }

function createDeck() {
  const suits = ['♠','♥','♦','♣'];
  const ranks = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
  const deck = [];
  for (let d = 0; d < 2; d++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ rank, suit, id: `${d}-${suit}-${rank}` });
      }
    }
    deck.push({ rank: '小王', suit: 'joker', id: `${d}-small-joker` });
    deck.push({ rank: '大王', suit: 'joker', id: `${d}-big-joker` });
  }
  return deck; // 108张
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
  const deck = shuffle(createDeck());
  const perPlayer = playerCount === 3 ? 36 : 27;
  const hands = [];
  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.slice(i * perPlayer, (i + 1) * perPlayer));
  }
  // 翻明牌：从最后一张开始找非王的牌
  let flipIdx = deck.length - 1;
  while (flipIdx >= 0 && deck[flipIdx].suit === 'joker') flipIdx--;
  const flipCard = deck[flipIdx] || deck[deck.length - 1];
  return { hands, flipCard };
}

function sortCards(cards) {
  return [...cards].sort((a, b) => cardValue(a.rank) - cardValue(b.rank));
}

function isSameRank(cards) {
  return cards.length > 0 && cards.every(c => c.rank === cards[0].rank);
}

// 检测同花色五十K（5+10+K 同花色）
function detect50K(cards) {
  if (cards.length !== 3) return null;
  const sorted = [...cards].sort((a,b) => cardValue(a.rank) - cardValue(b.rank));
  if (sorted.map(c => c.rank).join(',') !== '5,10,K') return null;
  const suit = sorted[0].suit;
  if (suit !== 'joker' && sorted.every(c => c.suit === suit)) {
    return { type: 'bomb', bombType: '50K', rank: 'K', suit };
  }
  return null;
}

// ─── 判断牌型 ────────────────────────────────────────────────
function detectPattern(cards) {
  if (!cards || cards.length === 0) return null;
  const n = cards.length;

  // 单张
  if (n === 1) return { type: 'single', rank: cards[0].rank };

  // 对子：小王+大王不算对子，因为点数不同
  if (n === 2) {
    if (cards[0].rank === cards[1].rank) return { type: 'pair', rank: cards[0].rank };
    return null;
  }

  // 三张 / 同花五十K
  if (n === 3) {
    const f50k = detect50K(cards);
    if (f50k) return f50k;
    if (isSameRank(cards)) return { type: 'triple', rank: cards[0].rank };
    return null;
  }

  // 四张：四王炸 / 红四炸 / 黑四炸 / 普通四张
  if (n === 4) {
    const jokers = cards.filter(c => c.suit === 'joker');
    if (jokers.length === 4) {
      const hasBig = jokers.filter(c => c.rank === '大王').length === 2;
      const hasSmall = jokers.filter(c => c.rank === '小王').length === 2;
      if (hasBig && hasSmall) return { type: 'bomb', bombType: 'joker4', rank: '大王', suit: null };
    }

    if (isSameRank(cards)) {
      const rank = cards[0].rank;
      const allBlack = cards.every(c => isBlack(c.suit));
      const allRed   = cards.every(c => isRed(c.suit));
      if (allBlack) return { type: 'bomb', bombType: 'color4', rank, color: 'black' };
      if (allRed)   return { type: 'bomb', bombType: 'color4', rank, color: 'red' };
      return { type: 'four', rank };
    }
    return null;
  }

  // 5/6/7 张同点数：普通牌型，不是炸弹，也不自动拆四炸
  if (n === 5 && isSameRank(cards)) return { type: 'five', rank: cards[0].rank };
  if (n === 6 && isSameRank(cards)) return { type: 'six', rank: cards[0].rank };
  if (n === 7 && isSameRank(cards)) return { type: 'seven', rank: cards[0].rank };

  // 八张同点数：八张炸弹
  if (n === 8 && isSameRank(cards)) {
    return { type: 'bomb', bombType: 'same8', rank: cards[0].rank };
  }

  // 禁止：顺子、连对、三带一、杂牌组合、不同花五十K、小王+大王
  return null;
}

// ─── 比较牌型 ────────────────────────────────────────────────
// 返回 true 表示 newP 能压 oldP
function comparePatterns(newP, oldP) {
  if (!newP) return false;
  if (!oldP) return true; // 先手，任何合法牌型都可出

  const newBomb = newP.type === 'bomb';
  const oldBomb = oldP.type === 'bomb';

  // 炸弹压非炸弹
  if (newBomb && !oldBomb) return true;
  if (!newBomb && oldBomb) return false;

  // 同为炸弹：比较等级
  if (newBomb && oldBomb) {
    const nl = BOMB_LEVEL[newP.bombType];
    const ol = BOMB_LEVEL[oldP.bombType];
    if (nl !== ol) return nl > ol;

    if (newP.bombType === 'joker4') return false; // 四王炸只有一种，最大但不能互压
    if (newP.bombType === 'same8') return cardValue(newP.rank) > cardValue(oldP.rank);

    if (newP.bombType === 'color4') {
      // 红/黑四炸：先比点数；点数相同，黑 > 红
      const rankDiff = cardValue(newP.rank) - cardValue(oldP.rank);
      if (rankDiff !== 0) return rankDiff > 0;
      const colorOrder = { black: 2, red: 1 };
      return colorOrder[newP.color] > colorOrder[oldP.color];
    }

    if (newP.bombType === '50K') {
      // 同花五十K：黑桃 > 红桃 > 梅花 > 方块
      return (SUIT_ORDER[newP.suit] || 0) > (SUIT_ORDER[oldP.suit] || 0);
    }
  }

  // 非炸弹：必须同类型、同张数压同张数
  if (newP.type !== oldP.type) return false;
  return cardValue(newP.rank) > cardValue(oldP.rank);
}

// ─── 检查玩家手牌中是否存在能压当前牌的出法 ─────────────────
function canBeat(hand, lastPattern) {
  if (!lastPattern) return true; // 先手，总能出

  const n = lastPattern.type === 'bomb' ? null : getPatternLen(lastPattern);
  const candidates = n ? getCombinations(hand, n) : getAllBombs(hand);
  for (const combo of candidates) {
    const p = detectPattern(combo);
    if (p && comparePatterns(p, lastPattern)) return true;
  }

  // 如果上家是非炸弹，还要检查炸弹
  if (lastPattern.type !== 'bomb') {
    for (const combo of getAllBombs(hand)) {
      const p = detectPattern(combo);
      if (p && comparePatterns(p, lastPattern)) return true;
    }
  }
  return false;
}

function getPatternLen(p) {
  if (p.type === 'single') return 1;
  if (p.type === 'pair') return 2;
  if (p.type === 'triple') return 3;
  if (p.type === 'four') return 4;
  if (p.type === 'five') return 5;
  if (p.type === 'six') return 6;
  if (p.type === 'seven') return 7;
  return null;
}

// 获取手牌中所有可能的炸弹组合
function getAllBombs(hand) {
  const results = [];

  // 4张王炸弹：小王小王大王大王
  const big = hand.filter(c => c.rank === '大王');
  const small = hand.filter(c => c.rank === '小王');
  if (big.length >= 2 && small.length >= 2) {
    results.push([big[0], big[1], small[0], small[1]]);
  }

  const rankGroups = {};
  for (const c of hand) {
    if (!rankGroups[c.rank]) rankGroups[c.rank] = [];
    rankGroups[c.rank].push(c);
  }

  for (const [, group] of Object.entries(rankGroups)) {
    // 8张同点数是大炸弹
    if (group.length >= 8) results.push(group.slice(0, 8));

    // 只有刚好选出纯黑/纯红4张同点数，才是同色四炸；5/6/7张不自动拆炸弹
    const blacks = group.filter(c => isBlack(c.suit));
    const reds   = group.filter(c => isRed(c.suit));
    if (blacks.length >= 4) results.push(blacks.slice(0, 4));
    if (reds.length >= 4)   results.push(reds.slice(0, 4));
  }

  // 同花色五十K
  const suits = ['♠','♥','♣','♦'];
  for (const suit of suits) {
    const five = hand.find(c => c.rank === '5' && c.suit === suit);
    const ten  = hand.find(c => c.rank === '10' && c.suit === suit);
    const king = hand.find(c => c.rank === 'K' && c.suit === suit);
    if (five && ten && king) results.push([five, ten, king]);
  }
  return results;
}

// 获取 n 张牌的组合
function getCombinations(arr, n) {
  if (n === 1) return arr.map(c => [c]);
  if (n > arr.length) return [];
  const result = [];
  function pick(start, current) {
    if (current.length === n) { result.push([...current]); return; }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      pick(i + 1, current);
      current.pop();
    }
  }
  pick(0, []);
  return result;
}

// 计算得分
function calcPileScore(cards) {
  let score = 0;
  for (const c of cards) score += SCORE_MAP[c.rank] || 0;
  return score;
}

// 目标分数（达到即可晋级/胜利）
function getTargetScores(playerCount) {
  if (playerCount === 3) return [30, 70, 100];
  return [20, 40, 60, 80];
}

module.exports = {
  createDeck, shuffle, dealCards, sortCards,
  detectPattern, comparePatterns, canBeat,
  calcPileScore, getTargetScores, CARD_ORDER
};
