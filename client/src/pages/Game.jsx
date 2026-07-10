import React, { useState, useCallback, useEffect, useRef } from 'react';
import Card, { MiniCard } from '../components/Card';

const CARD_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'];
const SCORE_MAP = { '5': 5, '10': 10, 'K': 10 };
const BOMB_LEVEL = { '50K': 1, color4: 2, same8: 3, joker4: 4 };
const SUIT_ORDER = { '♠': 4, '♥': 3, '♣': 2, '♦': 1 };
const TYPE_LABEL = { single:'单张', pair:'对子', triple:'三张', four:'普通四张', five:'普通五张', six:'普通六张', seven:'普通七张', bomb:'炸弹' };
const AVATARS = ['龙','虎','狐','狼'];
const AVATAR_COLORS = ['#7c3aed','#0891b2','#d97706','#dc2626'];
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
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#0f3a24', animation: bombAnim ? 'shake 0.35s ease' : 'none', position:'relative', overflow:'hidden', fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif" }}>
      {bombAnim && <div style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(245,158,11,0.12)', pointerEvents:'none' }} />}
      <div style={{ position:'fixed', top:'40%', left:'50%', transform:'translateX(-50%)', zIndex:110, pointerEvents:'none' }}>
        {floats.map(f => <div key={f.id} style={{ fontSize:30, fontWeight:900, color:'#fbbf24', textShadow:'0 2px 8px rgba(0,0,0,0.45)', animation:'floatUp 2.5s ease-out forwards' }}>{f.text}</div>)}
      </div>

      <div style={{ height:44, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'4px 10px', background:'#0b2417', borderBottom:'1px solid rgba(255,255,255,0.08)', zIndex:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <button onClick={() => setConfirmAction('return')} className="top-action">返回</button>
          <button onClick={() => setConfirmAction('exit')} className="top-action danger">退出</button>
        </div>
        <div style={{ fontSize:12, color:'#f8fafc', fontWeight:900, whiteSpace:'nowrap' }}>河南五十K <span style={{ color:'#94a3b8', fontWeight:600 }}>· {gameState?.mode === 'solo' ? `${gameState?.maxPlayers || players.length}人单机` : `房间${gameState?.id || ''}`}</span></div>
        <div style={{ fontSize:12, color:isMyTurn ? '#fbbf24' : '#cbd5e1', fontWeight:900, minWidth:126, textAlign:'right', whiteSpace:'nowrap' }}>{isMyTurn ? '轮到你：请出牌' : `轮到：${currentPlayer?.name || '等待'}`}</div>
      </div>

      <div style={{ flex:1, display:'flex', position:'relative', zIndex:10, minHeight:0 }}>
        <div style={{ width:'var(--side-col-w, 96px)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {leftOpp && <OpponentSide player={leftOpp} idx={players.indexOf(leftOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(leftOpp)} />}
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
          <div style={{ height:'21%', display:'flex', alignItems:'center', justifyContent:'center', minHeight:0 }}>
            {topOpp && <OpponentTop player={topOpp} idx={players.indexOf(topOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(topOpp)} />}
          </div>
          <div style={{ height:'79%', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', minHeight:0 }}>
            <div style={{ position:'absolute', width:'86%', height:'90%', borderRadius:'28px', border:'1px solid rgba(255,255,255,0.07)', background:'radial-gradient(circle at center, rgba(255,255,255,0.045), rgba(255,255,255,0.015))', boxShadow: isMyTurn ? 'inset 0 0 26px rgba(245,197,24,0.20)' : 'none' }} />
            <TrickBoard items={trickItems} trickPlays={gameState?.trickPlays || []} pileScore={pileScore} isMyTurn={isMyTurn} currentPlayer={currentPlayer} lastPlay={gameState?.lastPlay} />
          </div>
        </div>
        <div style={{ width:'var(--side-col-w, 96px)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {rightOpp && <OpponentSide player={rightOpp} idx={players.indexOf(rightOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(rightOpp)} />}
        </div>
      </div>

      <div style={{ paddingBottom:'var(--hand-bottom-pad, 8px)', zIndex:30, flexShrink:0, background:'linear-gradient(to top, rgba(0,0,0,0.30), transparent)' }}>
        {me && <div style={{ display:'flex', justifyContent:'center', marginBottom:1 }}><SelfPanel player={me} isCurrent={isMyTurn} /></div>}
        <StatusBar myFinished={myFinished} selectedCount={selected.size} selectedType={selectedType} canPlaySelected={canPlaySelected} sending={sending} isMyTurn={isMyTurn} arranged={arranged} lastPlay={gameState?.lastPlay} />
        <div onPointerMove={handleHandPointerMove} onPointerUp={endSlideSelect} onPointerCancel={endSlideSelect} onPointerLeave={endSlideSelect} style={{ display:'flex', justifyContent:'center', padding:'var(--hand-y-pad-top, 10px) var(--hand-x-pad, 40px) var(--hand-y-pad-bottom, 18px)', overflow:'visible', touchAction:'none' }}>
          <div style={{ display:'flex', justifyContent:'center', minWidth:0, opacity: myFinished ? 0.35 : 1 }}>
            {sortedHand.map((card, i) => (
              <div key={card.id} data-card-id={card.id} onPointerDown={() => handleCardPointerDown(card.id)} onClick={() => handleCardClick(card.id)} style={{ marginLeft: i === 0 ? 0 : 'var(--hand-overlap, -24px)', filter:selected.has(card.id) ? 'drop-shadow(0 0 8px rgba(251,191,36,0.8))' : 'none' }}>
                <Card card={card} selected={selected.has(card.id)} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:7, padding:'0 10px 4px' }}>
          <div style={{ display:'flex', gap:10, fontSize:11, color:'#cbd5e1', flex:1, paddingLeft:6, whiteSpace:'nowrap', overflow:'hidden' }}><span>普通</span><span>分牌</span><span>炸弹</span></div>
          <button disabled={sending || myFinished} onClick={toggleArrange} className="btn-lite">{arranged ? '还原' : '理牌'}</button>
          <button disabled={sending || myFinished || selected.size === 0} onClick={clearSelection} className="btn-lite">清空</button>
          <button disabled={sending || myFinished} onClick={hint} className="btn-lite hint">提示</button>
          <button disabled={!isMyTurn || isFirst || sending || myFinished} onClick={pass} className="btn-pass">过牌</button>
          <button disabled={!isMyTurn || !selected.size || sending || myFinished} onClick={playCards} className="btn-play">出牌{selected.size > 0 ? `(${selected.size})` : ''}</button>
        </div>
      </div>

      {confirmAction && <ConfirmModal title={confirmAction === 'return' ? '是否返回大厅？' : '是否退出当前房间？'} desc={confirmAction === 'return' ? '当前房间会保留，你可以从大厅继续回来。' : gameState?.mode === 'solo' ? '退出后单机局直接作废，下次不会自动恢复。' : '退出后会清除本机房间记录，下次不会自动回到这局。'} cancelText="取消" okText={confirmAction === 'return' ? '返回大厅' : '确认退出'} danger={confirmAction === 'exit'} onCancel={() => setConfirmAction(null)} onOk={confirmAction === 'return' ? confirmReturn : confirmExit} />}

      <style>{`
        .top-action { min-height:32px; padding:0 10px; border-radius:11px; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.06); color:#f8fafc; font-size:12px; font-weight:900; }
        .top-action.danger { color:#fecaca; border-color:rgba(248,113,113,0.35); }
        .btn-lite { min-height:44px; padding:0 12px; border-radius:15px; font-size:13px; font-weight:900; background:rgba(255,255,255,0.075); border:1px solid rgba(255,255,255,0.18); color:#f8fafc; }
        .btn-lite.hint { color:#bfdbfe; border-color:rgba(96,165,250,0.35); }
        .btn-lite:disabled { opacity:0.35; }
        .btn-pass { min-height:44px; padding:0 17px; border-radius:15px; font-size:14px; font-weight:900; background:rgba(255,255,255,0.09); border:1px solid rgba(255,255,255,0.22); color:#fff; }
        .btn-pass:disabled { opacity:0.3; }
        .btn-play { min-height:46px; padding:0 24px; border-radius:16px; font-size:17px; font-weight:900; background:#f5c518; border:none; color:#102016; box-shadow:0 3px 12px rgba(0,0,0,0.32); }
        .btn-play:disabled { background:#45524a; color:#9ca3af; box-shadow:none; }
        @keyframes softPulse { 0%,100%{opacity:.85;transform:scale(1)} 50%{opacity:1;transform:scale(1.02)} }
      `}</style>
    </div>
  );
}

function StatusBar({ myFinished, selectedCount, selectedType, canPlaySelected, sending, isMyTurn, arranged, lastPlay }) {
  let text = '';
  let color = '#fbbf24';
  if (myFinished) text = '你已出完，等待本局打完';
  else if (selectedCount > 0) {
    text = `已选${selectedCount}张 · ${selectedType}${canPlaySelected ? '' : '（可点出牌，由系统判断）'}`;
    color = canPlaySelected ? '#fbbf24' : '#fb923c';
  } else if (sending) text = '正在出牌...';
  else if (isMyTurn) text = lastPlay ? `请出牌，需压过：${patternLabel(lastPlay)}` : '你先出牌，选择任意合法牌型';
  else if (arranged) text = '已理牌：再点“还原”恢复普通排序';
  else text = '可点选，也可以按住手牌横向滑动多选';
  return <div style={{ height:22, display:'flex', justifyContent:'center', alignItems:'center' }}><div style={{ padding:'3px 12px', borderRadius:12, background:'rgba(0,0,0,0.24)', border:`1px solid ${color}33`, fontSize:12, color, fontWeight:900, textShadow:'0 1px 2px rgba(0,0,0,0.8)', animation:isMyTurn && selectedCount === 0 ? 'softPulse 1.3s ease-in-out infinite' : 'none' }}>{text}</div></div>;
}

function TrickBoard({ items, trickPlays, pileScore, isMyTurn, currentPlayer, lastPlay }) {
  return (
    <div style={{ zIndex:5, width:'min(700px, 96%)', padding:'10px 12px', borderRadius:24, background:'rgba(4,22,14,0.40)', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 10px 28px rgba(0,0,0,0.18)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, gap:8 }}>
        <div style={{ fontSize:15, fontWeight:900, color:'#fbbf24', whiteSpace:'nowrap' }}>本轮出牌</div>
        <div style={{ fontSize:12, color:isMyTurn ? '#fbbf24' : '#cbd5e1', fontWeight:900, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{isMyTurn ? '轮到你操作' : `等待 ${currentPlayer?.name || ''}`}</div>
        <div style={{ fontSize:12, color:'#e5e7eb', whiteSpace:'nowrap' }}>牌型 <span style={{ color:'#fbbf24', fontWeight:900 }}>{lastPlay ? patternLabel(lastPlay) : '先手'}</span> · 本墩 <span style={{ color:'#fbbf24', fontWeight:900 }}>{pileScore}分</span></div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
        {items.map(({ label, player }) => {
          const entry = trickPlays.find(x => x.playerId === player.id);
          return <TrickCell key={player.id} label={label} player={player} entry={entry} />;
        })}
      </div>
    </div>
  );
}

function TrickCell({ label, player, entry }) {
  const hasPlayed = entry?.action === 'play';
  const passed = entry?.action === 'pass';
  return (
    <div style={{ minHeight:66, borderRadius:16, background:hasPlayed ? 'rgba(245,197,24,0.075)' : 'rgba(255,255,255,0.045)', border:`1px solid ${hasPlayed ? 'rgba(245,197,24,0.18)' : 'rgba(255,255,255,0.07)'}`, padding:'6px 8px', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, marginBottom:4 }}>
        <div style={{ fontSize:11, color:'#94a3b8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{label} · <span style={{ color:'#fff', fontWeight:900 }}>{player.name}</span>{player.isBot ? <span style={{ color:'#fbbf24' }}> 机</span> : null}</div>
        <div style={{ fontSize:11, color:hasPlayed ? '#fbbf24' : passed ? '#94a3b8' : '#64748b', fontWeight:900, flexShrink:0 }}>{hasPlayed ? patternLabel(entry.pattern) : passed ? '过牌' : '待出'}</div>
      </div>
      {hasPlayed ? <div style={{ display:'flex', gap:2, alignItems:'center', overflow:'hidden' }}>{(entry.cards || []).slice(0, 8).map(c => <MiniCard key={c.id} card={c} />)}</div> : <div style={{ height:36, display:'flex', alignItems:'center', color:passed ? '#94a3b8' : 'rgba(255,255,255,0.28)', fontSize:13, fontWeight:800 }}>{passed ? '已过牌' : '等待操作'}</div>}
    </div>
  );
}

function PlayerAvatar({ player, idx, size = 40 }) {
  return <div style={{ width:size, height:size, borderRadius:'50%', background:AVATAR_COLORS[idx] || '#475569', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size > 36 ? 16 : 13, fontWeight:900, color:'#fff', flexShrink:0 }}>{player?.isBot ? '机' : (AVATARS[idx] || '玩')}</div>;
}

function OpponentSide({ player, idx, isCurrent }) {
  return <div style={{ width:76, padding:'10px 5px', borderRadius:18, background:isCurrent?'rgba(245,197,24,0.13)':'rgba(0,0,0,0.16)', border:`1px solid ${isCurrent ? '#f5c518' : 'rgba(255,255,255,0.08)'}`, boxShadow:isCurrent?'0 0 14px rgba(245,197,24,0.32)':'none', display:'flex', flexDirection:'column', alignItems:'center', gap:4, opacity: player.isOnline ? 1 : 0.45 }}><PlayerAvatar player={player} idx={idx} size={38} /><div style={{ fontSize:11, fontWeight:900, color:'#fff', maxWidth:68, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{player.name}</div><div style={{ fontSize:10, color:'#fbbf24', fontWeight:800 }}>{player.score}分</div><div style={{ fontSize:10, color:'#cbd5e1' }}>{player.left ? '已退出' : player.cardCount === 0 ? '已出完' : `${player.cardCount}张`}</div></div>;
}

function OpponentTop({ player, idx, isCurrent }) {
  return <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:18, background:isCurrent?'rgba(245,197,24,0.14)':'rgba(0,0,0,0.16)', border:`1px solid ${isCurrent ? '#f5c518' : 'rgba(255,255,255,0.08)'}`, boxShadow:isCurrent?'0 0 14px rgba(245,197,24,0.32)':'none', opacity: player.isOnline ? 1 : 0.45 }}><PlayerAvatar player={player} idx={idx} size={34} /><div><div style={{ fontSize:12, color:'#fff', fontWeight:900 }}>{player.name}</div><div style={{ fontSize:10, color:'#cbd5e1' }}>{player.score}分 · {player.left ? '已退出' : player.cardCount === 0 ? '已出完' : `${player.cardCount}张`}</div></div></div>;
}

function SelfPanel({ player, isCurrent }) {
  return <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 12px', borderRadius:16, background:isCurrent?'rgba(245,197,24,0.14)':'rgba(0,0,0,0.22)', border:`1px solid ${isCurrent ? '#f5c518' : 'rgba(255,255,255,0.08)'}` }}><div style={{ fontSize:11, color:'#fbbf24', fontWeight:900 }}>我</div><div style={{ fontSize:12, color:'#fff', fontWeight:900 }}>{player.name}</div><div style={{ fontSize:11, color:'#cbd5e1' }}>{player.score}分 · {player.cardCount}张</div></div>;
}

function ConfirmModal({ title, desc, cancelText, okText, danger, onCancel, onOk }) {
  return <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}><div style={{ width:330, borderRadius:22, background:'#f8fafc', color:'#0f172a', padding:18, boxShadow:'0 12px 30px rgba(0,0,0,0.35)' }}><div style={{ fontSize:20, fontWeight:900, marginBottom:8 }}>{title}</div><div style={{ fontSize:14, color:'#475569', lineHeight:1.6, marginBottom:18 }}>{desc}</div><div style={{ display:'flex', gap:10 }}><button onClick={onCancel} style={{ flex:1, height:46, borderRadius:14, border:'1px solid #cbd5e1', background:'#fff', color:'#334155', fontSize:15, fontWeight:900 }}>{cancelText}</button><button onClick={onOk} style={{ flex:1, height:46, borderRadius:14, border:'none', background:danger ? '#ef4444' : '#f5c518', color:danger ? '#fff' : '#102016', fontSize:15, fontWeight:900 }}>{okText}</button></div></div></div>;
}
