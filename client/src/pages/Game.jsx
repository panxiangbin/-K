import React, { useState, useCallback, useEffect, useRef } from 'react';
import Card, { MiniCard } from '../components/Card';

const CARD_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'];
const SCORE_MAP = { '5': 5, '10': 10, 'K': 10 };
const BOMB_LEVEL = { '50K': 1, color4: 2, same8: 3, joker4: 4 };
const SUIT_ORDER = { '♠': 4, '♥': 3, '♣': 2, '♦': 1 };
const TYPE_LABEL = { single:'单张', pair:'对子', triple:'三张', four:'普通四张', five:'普通五张', six:'普通六张', seven:'普通七张', bomb:'炸弹' };
const AVATARS = ['龙','虎','狐','狼'];
const AVATAR_COLORS = ['#13b8c8','#6559e8','#e85d93','#20b878'];
const SCORE_RANKS = new Set(['5', '10', 'K']);

function cardValue(rank) { return CARD_ORDER.indexOf(rank); }
function isBlack(suit) { return suit === '♠' || suit === '♣'; }
function isRed(suit) { return suit === '♥' || suit === '♦'; }
function sortCards(cards) { return [...cards].sort((a,b) => cardValue(a.rank) - cardValue(b.rank)); }
function calcScore(cards = []) { return cards.reduce((sum, c) => sum + (SCORE_MAP[c.rank] || 0), 0); }
function isSameRank(cards) { return cards.length > 0 && cards.every(c => c.rank === cards[0].rank); }
function groupByRank(cards) { const g = {}; for (const c of cards) { if (!g[c.rank]) g[c.rank] = []; g[c.rank].push(c); } return g; }

function detect50K(cards) {
  if (cards.length !== 3) return null;
  const sorted = sortCards(cards);
  if (sorted.map(c => c.rank).join(',') !== '5,10,K') return null;
  const suit = sorted[0].suit;
  if (suit !== 'joker' && sorted.every(c => c.suit === suit)) return { type: 'bomb', bombType: '50K', rank: 'K', suit };
  return null;
}

function detectPattern(cards) {
  if (!cards || cards.length === 0) return null;
  const n = cards.length;
  if (n === 1) return { type: 'single', rank: cards[0].rank };
  if (n === 2) return cards[0].rank === cards[1].rank ? { type: 'pair', rank: cards[0].rank } : null;
  if (n === 3) {
    const f50k = detect50K(cards);
    if (f50k) return f50k;
    return isSameRank(cards) ? { type: 'triple', rank: cards[0].rank } : null;
  }
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
      const allRed = cards.every(c => isRed(c.suit));
      if (allBlack) return { type: 'bomb', bombType: 'color4', rank, color: 'black' };
      if (allRed) return { type: 'bomb', bombType: 'color4', rank, color: 'red' };
      return { type: 'four', rank };
    }
    return null;
  }
  if (n === 5 && isSameRank(cards)) return { type: 'five', rank: cards[0].rank };
  if (n === 6 && isSameRank(cards)) return { type: 'six', rank: cards[0].rank };
  if (n === 7 && isSameRank(cards)) return { type: 'seven', rank: cards[0].rank };
  if (n === 8 && isSameRank(cards)) return { type: 'bomb', bombType: 'same8', rank: cards[0].rank };
  return null;
}

function comparePatterns(newP, oldP) {
  if (!newP) return false;
  if (!oldP) return true;
  const newBomb = newP.type === 'bomb';
  const oldBomb = oldP.type === 'bomb';
  if (newBomb && !oldBomb) return true;
  if (!newBomb && oldBomb) return false;
  if (newBomb && oldBomb) {
    const nl = BOMB_LEVEL[newP.bombType];
    const ol = BOMB_LEVEL[oldP.bombType];
    if (nl !== ol) return nl > ol;
    if (newP.bombType === 'joker4') return false;
    if (newP.bombType === 'same8') return cardValue(newP.rank) > cardValue(oldP.rank);
    if (newP.bombType === 'color4') {
      const rankDiff = cardValue(newP.rank) - cardValue(oldP.rank);
      if (rankDiff !== 0) return rankDiff > 0;
      const colorOrder = { red: 1, black: 2 };
      return colorOrder[newP.color] > colorOrder[oldP.color];
    }
    if (newP.bombType === '50K') return (SUIT_ORDER[newP.suit] || 0) > (SUIT_ORDER[oldP.suit] || 0);
  }
  if (newP.type !== oldP.type) return false;
  return cardValue(newP.rank) > cardValue(oldP.rank);
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

function getNormalCandidates(hand, n) {
  if (n === 1) return hand.map(c => [c]);
  const groups = groupByRank(hand);
  const combos = [];
  for (const group of Object.values(groups)) if (group.length >= n) combos.push(group.slice(0, n));
  return combos;
}

function getAllBombs(hand) {
  const results = [];
  const big = hand.filter(c => c.rank === '大王');
  const small = hand.filter(c => c.rank === '小王');
  if (big.length >= 2 && small.length >= 2) results.push([big[0], big[1], small[0], small[1]]);
  const groups = groupByRank(hand);
  for (const group of Object.values(groups)) {
    if (group.length >= 8) results.push(group.slice(0, 8));
    const blacks = group.filter(c => isBlack(c.suit));
    const reds = group.filter(c => isRed(c.suit));
    if (blacks.length >= 4) results.push(blacks.slice(0, 4));
    if (reds.length >= 4) results.push(reds.slice(0, 4));
  }
  for (const suit of ['♠','♥','♣','♦']) {
    const five = hand.find(c => c.rank === '5' && c.suit === suit);
    const ten = hand.find(c => c.rank === '10' && c.suit === suit);
    const king = hand.find(c => c.rank === 'K' && c.suit === suit);
    if (five && ten && king) results.push([five, ten, king]);
  }
  return results;
}

function getBombIds(hand) { const ids = new Set(); getAllBombs(hand).forEach(combo => combo.forEach(card => ids.add(card.id))); return ids; }
function arrangeHand(hand) {
  const sorted = sortCards(hand);
  const bombIds = getBombIds(sorted);
  const normal = [], scoreCards = [], bombs = [];
  sorted.forEach(card => { if (bombIds.has(card.id)) bombs.push(card); else if (SCORE_RANKS.has(card.rank)) scoreCards.push(card); else normal.push(card); });
  return [...normal, ...scoreCards, ...bombs];
}

function getHints(hand, lastPlay) {
  if (!hand.length) return [];
  if (!lastPlay) return [[hand[0].id]];
  const candidates = [];
  if (lastPlay.type !== 'bomb') {
    const n = getPatternLen(lastPlay);
    candidates.push(...getNormalCandidates(hand, n));
  }
  candidates.push(...getAllBombs(hand));
  const seen = new Set();
  const result = [];
  for (const combo of candidates) {
    const pattern = detectPattern(combo);
    if (pattern && comparePatterns(pattern, lastPlay)) {
      const ids = combo.map(c => c.id);
      const key = ids.join('|');
      if (!seen.has(key)) {
        seen.add(key);
        result.push(ids);
      }
    }
  }
  return result;
}

function patternLabel(pattern) {
  if (!pattern) return '出牌';
  if (pattern.type !== 'bomb') return TYPE_LABEL[pattern.type] || '出牌';
  if (pattern.bombType === '50K') return `${pattern.suit}五十K`;
  if (pattern.bombType === 'color4') return `${pattern.color === 'black' ? '黑' : '红'}四炸`;
  if (pattern.bombType === 'same8') return '八张炸弹';
  if (pattern.bombType === 'joker4') return '四王炸弹';
  return '炸弹';
}

function detectSelectedType(cards) {
  if (!cards.length) return '';
  const pattern = detectPattern(cards);
  return pattern ? patternLabel(pattern) : '非法牌型';
}

export default function Game({ send, gameState, myHand, myInfo, toast, onReturnLobby, onExitRoom }) {
  const [selected, setSelected] = useState(new Set());
  const [floats, setFloats] = useState([]);
  const [bombAnim, setBombAnim] = useState(false);
  const [sending, setSending] = useState(false);
  const [arranged, setArranged] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const floatId = useRef(0);
  const prevScores = useRef({});
  const pointerDownRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragStartCardRef = useRef(null);
  const ignoreClickRef = useRef(false);
  const hintCursorRef = useRef(0);

  const players = gameState?.players || [];
  const myIdx = players.findIndex(p => p.id === myInfo?.playerId);
  const me = players[myIdx] || null;
  const isMyTurn = gameState?.currentPlayer === myIdx;
  const isFirst = !gameState?.lastPlay;
  const sortedHand = arranged ? arrangeHand(myHand) : sortCards(myHand);
  const lastPlayKey = gameState?.lastPlayCards?.map(c => c.id).join('|') || '';
  const myFinished = myHand.length === 0 && gameState?.status === 'playing';

  useEffect(() => {
    document.documentElement.dataset.gameVisual = 'tech-landscape-v2';
    document.body.classList.add('game-screen-tech-v2');
    return () => {
      document.body.classList.remove('game-screen-tech-v2');
      if (document.documentElement.dataset.gameVisual === 'tech-landscape-v2') delete document.documentElement.dataset.gameVisual;
    };
  }, []);
  useEffect(() => { if (isMyTurn && navigator.vibrate) navigator.vibrate([100, 50, 100]); }, [isMyTurn]);
  useEffect(() => { setSending(false); }, [myHand, gameState?.currentPlayer]);
  useEffect(() => { hintCursorRef.current = 0; }, [lastPlayKey, myHand.length]);
  useEffect(() => {
    if (!gameState) return;
    gameState.players.forEach(p => {
      const prev = prevScores.current[p.id] ?? 0;
      if (p.score > prev) {
        const diff = p.score - prev;
        const id = floatId.current++;
        setFloats(f => [...f, { id, text: '+' + diff + '分' }]);
        setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 2500);
      }
      prevScores.current[p.id] = p.score;
    });
  }, [gameState?.players]);
  useEffect(() => {
    if (gameState?.lastPlay?.type === 'bomb') { setBombAnim(true); setTimeout(() => setBombAnim(false), 700); }
  }, [lastPlayKey, gameState?.lastPlay?.type]);

  const addSelected = useCallback((id) => {
    if (sending || myFinished || !id) return;
    setSelected(s => {
      if (s.has(id)) return s;
      const n = new Set(s);
      n.add(id);
      return n;
    });
  }, [sending, myFinished]);
  const toggleCard = useCallback((id) => {
    if (sending || myFinished) return;
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, [sending, myFinished]);

  function handleCardPointerDown(id) {
    if (sending || myFinished) return;
    pointerDownRef.current = true;
    dragMovedRef.current = false;
    dragStartCardRef.current = id;
  }
  function handleHandPointerMove(e) {
    if (!pointerDownRef.current || sending || myFinished) return;
    dragMovedRef.current = true;
    addSelected(dragStartCardRef.current);
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-card-id]');
    if (el) addSelected(el.dataset.cardId);
  }
  function endSlideSelect() {
    if (dragMovedRef.current) {
      ignoreClickRef.current = true;
      setTimeout(() => { ignoreClickRef.current = false; }, 250);
    }
    pointerDownRef.current = false;
    dragMovedRef.current = false;
    dragStartCardRef.current = null;
  }
  function handleCardClick(id) { if (!ignoreClickRef.current) toggleCard(id); }

  function releaseSendingSoon() { setTimeout(() => setSending(false), 1200); }
  function playCards() {
    if (!isMyTurn || !selected.size || sending || myFinished) return;
    send({ type: 'play_cards', cardIds: [...selected] });
    setSending(true);
    setSelected(new Set());
    releaseSendingSoon();
  }
  function pass() { if (!isMyTurn || isFirst || sending || myFinished) return; send({ type: 'pass' }); setSending(true); setSelected(new Set()); releaseSendingSoon(); }
  function hint() {
    const hints = getHints(sortedHand, gameState?.lastPlay);
    if (!hints.length) { toast('没有合适的牌可以出', 'dim'); return; }
    const idx = hintCursorRef.current % hints.length;
    setSelected(new Set(hints[idx]));
    hintCursorRef.current += 1;
    toast(`提示 ${idx + 1}/${hints.length}`, 'success');
  }
  function toggleArrange() { setArranged(v => { const next = !v; toast?.(next ? '已理牌：分牌和炸弹靠右' : '已还原普通排序', 'success'); return next; }); setSelected(new Set()); hintCursorRef.current = 0; }
  function clearSelection() { setSelected(new Set()); toast?.('已清空选牌', 'dim'); }

  const selectedCards = sortedHand.filter(c => selected.has(c.id));
  const selectedType = detectSelectedType(selectedCards);
  const selectedPattern = detectPattern(selectedCards);
  const canPlaySelected = Boolean(selectedPattern && comparePatterns(selectedPattern, gameState?.lastPlay));
  const currentPlayer = players[gameState?.currentPlayer];
  const pileScore = calcScore(gameState?.pile || []);

  let leftOpp = null, topOpp = null, rightOpp = null;
  if (players.length === 4) {
    rightOpp = players[(myIdx + 1 + 4) % 4];
    topOpp = players[(myIdx + 2 + 4) % 4];
    leftOpp = players[(myIdx + 3 + 4) % 4];
  } else if (players.length === 3) {
    rightOpp = players[(myIdx + 1 + 3) % 3];
    leftOpp = players[(myIdx + 2 + 3) % 3];
  } else if (players.length === 2) {
    topOpp = players[(myIdx + 1 + 2) % 2];
  }
  const trickItems = [
    { label: '上方', player: topOpp },
    { label: '左边', player: leftOpp },
    { label: '右边', player: rightOpp },
    { label: '我', player: me },
  ].filter(x => x.player);

  function confirmReturn() { setConfirmAction(null); onReturnLobby?.(); }
  function confirmExit() { setConfirmAction(null); onExitRoom?.(); }

  return (
    <div className={`tech-game-shell game-table-shell${bombAnim ? ' is-bombing' : ''}`}>
      {bombAnim && <div className="tech-bomb-flash" />}
      <div className="tech-score-floats" aria-hidden="true">
        {floats.map(f => <div key={f.id}>{f.text}</div>)}
      </div>

      <header className="tech-topbar game-table-header">
        <div className="tech-top-actions game-table-header__actions">
          <button onClick={() => setConfirmAction('return')} className="top-action">返回</button>
          <button onClick={() => setConfirmAction('exit')} className="top-action danger">退出</button>
        </div>
        <div className="tech-room-title game-table-header__room">
          <strong>河南五十K</strong>
          <span>{gameState?.mode === 'solo' ? `${gameState?.maxPlayers || players.length}人单机` : `房间 ${gameState?.id || ''}`}</span>
        </div>
        <div className="tech-turn-status game-table-header__turn" data-turn-state={isMyTurn ? 'self' : 'other'}>
          <span className="tech-turn-dot" />
          {isMyTurn ? '轮到你出牌' : `等待 ${currentPlayer?.name || '玩家'}`}
        </div>
      </header>

      <main className="tech-stage game-table-stage">
        <aside className="tech-player-rail game-table-player-rail game-table-player-rail--left">
          {leftOpp && <PlayerHud player={leftOpp} idx={players.indexOf(leftOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(leftOpp)} position="left" />}
        </aside>

        <section className="tech-center game-table-center-column">
          <div className="tech-top-seat-slot">
            {topOpp && <PlayerHud player={topOpp} idx={players.indexOf(topOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(topOpp)} position="top" />}
          </div>
          <div className="tech-board-wrap">
            <TrickBoard items={trickItems} trickPlays={gameState?.trickPlays || []} pileScore={pileScore} isMyTurn={isMyTurn} currentPlayer={currentPlayer} lastPlay={gameState?.lastPlay} />
          </div>
        </section>

        <aside className="tech-player-rail game-table-player-rail game-table-player-rail--right">
          {rightOpp && <PlayerHud player={rightOpp} idx={players.indexOf(rightOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(rightOpp)} position="right" />}
        </aside>
      </main>

      <footer className="tech-hand-dock game-table-hand-dock">
        <div className="tech-self-row">
          {me && <SelfPanel player={me} isCurrent={isMyTurn} />}
        </div>
        <StatusBar myFinished={myFinished} selectedCount={selected.size} selectedType={selectedType} canPlaySelected={canPlaySelected} sending={sending} isMyTurn={isMyTurn} arranged={arranged} lastPlay={gameState?.lastPlay} />
        <div className="tech-hand-surface game-hand-surface" onPointerMove={handleHandPointerMove} onPointerUp={endSlideSelect} onPointerCancel={endSlideSelect} onPointerLeave={endSlideSelect}>
          <div className="tech-hand-cards" style={{ opacity: myFinished ? 0.35 : 1 }}>
            {sortedHand.map((card, i) => (
              <div key={card.id} data-card-id={card.id} onPointerDown={() => handleCardPointerDown(card.id)} onClick={() => handleCardClick(card.id)} style={{ marginLeft: i === 0 ? 0 : 'var(--hand-overlap, -34px)', filter:selected.has(card.id) ? 'drop-shadow(0 0 8px rgba(54,225,255,0.72))' : 'none' }}>
                <Card card={card} selected={selected.has(card.id)} />
              </div>
            ))}
          </div>
        </div>
        <div className="tech-actions game-hand-actions">
          <button disabled={sending || myFinished} onClick={toggleArrange} className="btn-lite">{arranged ? '还原' : '理牌'}</button>
          <button disabled={sending || myFinished || selected.size === 0} onClick={clearSelection} className="btn-lite">清空</button>
          <button disabled={sending || myFinished} onClick={hint} className="btn-lite hint">提示</button>
          <button disabled={!isMyTurn || isFirst || sending || myFinished} onClick={pass} className="btn-pass">过牌</button>
          <button disabled={!isMyTurn || !selected.size || sending || myFinished} onClick={playCards} className="btn-play">出牌{selected.size > 0 ? `(${selected.size})` : ''}</button>
        </div>
      </footer>

      {confirmAction && <ConfirmModal title={confirmAction === 'return' ? '是否返回大厅？' : '是否退出当前房间？'} desc={confirmAction === 'return' ? '当前房间会保留，你可以从大厅继续回来。' : gameState?.mode === 'solo' ? '退出后单机局直接作废，下次不会自动恢复。' : '退出后会清除本机房间记录，下次不会自动回到这局。'} cancelText="取消" okText={confirmAction === 'return' ? '返回大厅' : '确认退出'} danger={confirmAction === 'exit'} onCancel={() => setConfirmAction(null)} onOk={confirmAction === 'return' ? confirmReturn : confirmExit} />}
    </div>
  );
}

function StatusBar({ myFinished, selectedCount, selectedType, canPlaySelected, sending, isMyTurn, arranged, lastPlay }) {
  let text = '';
  let tone = 'idle';
  if (myFinished) { text = '你已出完，等待本墩结束'; tone = 'done'; }
  else if (selectedCount > 0) {
    text = `已选${selectedCount}张 · ${selectedType}${canPlaySelected ? '' : ' · 可尝试出牌'}`;
    tone = canPlaySelected ? 'ready' : 'warning';
  } else if (sending) { text = '正在出牌…'; tone = 'busy'; }
  else if (isMyTurn) { text = lastPlay ? `请压过：${patternLabel(lastPlay)}` : '你先出牌，选择任意合法牌型'; tone = 'ready'; }
  else if (arranged) { text = '已理牌：分牌与炸弹已靠右'; tone = 'idle'; }
  else { text = '轻点选牌，左右滑动查看全部手牌'; tone = 'idle'; }
  return <div className="tech-selection-status game-hand-selection-status" data-tone={tone}><div>{text}</div></div>;
}

function TrickBoard({ items, trickPlays, pileScore, isMyTurn, currentPlayer, lastPlay }) {
  return (
    <section className="tech-trick-board game-table-trick-board">
      <div className="tech-round-summary trick-board-summary">
        <div className="tech-round-title trick-board-summary__title">本轮出牌</div>
        <div className="tech-round-turn trick-board-summary__turn">{isMyTurn ? '请你操作' : `等待 ${currentPlayer?.name || ''}`}</div>
        <div className="tech-round-meta trick-board-summary__meta">
          <span className="tech-meta-label">牌型</span>
          <strong>{lastPlay ? patternLabel(lastPlay) : '先手'}</strong>
          <span className="tech-meta-separator">·</span>
          <span className="tech-meta-label">本墩</span>
          <strong>{pileScore}分</strong>
        </div>
      </div>
      <div className="tech-trick-grid trick-action-grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))` }}>
        {items.map(({ label, player }) => {
          const entry = trickPlays.find(x => x.playerId === player.id);
          return <TrickCell key={player.id} label={label} player={player} entry={entry} />;
        })}
      </div>
    </section>
  );
}

function TrickCell({ label, player, entry }) {
  const hasPlayed = entry?.action === 'play';
  const passed = entry?.action === 'pass';
  const state = hasPlayed ? 'played' : passed ? 'passed' : 'waiting';
  return (
    <article className={`tech-trick-cell trick-action-card is-${state}`} data-trick-state={state}>
      <div className="tech-trick-cell-head trick-action-card__header">
        <span>{label} · <b>{player.name}</b>{player.isBot ? ' 机' : ''}</span>
        <strong>{hasPlayed ? patternLabel(entry.pattern) : passed ? '过牌' : '待出'}</strong>
      </div>
      <div className="tech-trick-cell-body trick-action-card__body">
        {hasPlayed ? (entry.cards || []).slice(0, 8).map(c => <MiniCard key={c.id} card={c} />) : <span>{passed ? '已过牌' : '等待操作'}</span>}
      </div>
    </article>
  );
}

function TurnBadge() {
  return <span className="tech-player-state">出牌中</span>;
}

function PlayerAvatar({ player, idx, isCurrent = false }) {
  return <div className={`tech-player-avatar${isCurrent ? ' is-current' : ''}`} style={{ '--avatar-color': AVATAR_COLORS[idx] || '#13b8c8' }}>{player?.isBot ? '机' : (AVATARS[idx] || '玩')}</div>;
}

function PlayerHud({ player, idx, isCurrent, position }) {
  const stateText = player.left ? '已退出' : player.cardCount === 0 ? '已出完' : `${player.cardCount}张`;
  return (
    <div className={`tech-player-hud tech-player-hud--${position}${isCurrent ? ' is-current' : ''}`} style={{ opacity: player.isOnline ? 1 : 0.5 }}>
      <PlayerAvatar player={player} idx={idx} isCurrent={isCurrent} />
      <div className="tech-player-copy">
        <strong>{player.name}</strong>
        <span>{player.score}分 · {stateText}</span>
      </div>
      {isCurrent && <TurnBadge />}
    </div>
  );
}

function SelfPanel({ player, isCurrent }) {
  return (
    <div className={`tech-self-panel${isCurrent ? ' is-current' : ''}`}>
      <span className="tech-self-tag">我</span>
      <strong>{player.name}</strong>
      <span>{player.score}分</span>
      <span>{player.cardCount}张</span>
      {isCurrent && <TurnBadge />}
    </div>
  );
}

function ConfirmModal({ title, desc, cancelText, okText, danger, onCancel, onOk }) {
  return <div className="tech-modal-backdrop"><div className="tech-modal"><h2>{title}</h2><p>{desc}</p><div><button onClick={onCancel}>{cancelText}</button><button className={danger ? 'danger' : 'primary'} onClick={onOk}>{okText}</button></div></div></div>;
}
