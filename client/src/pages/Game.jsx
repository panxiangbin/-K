import React, { useState, useCallback, useEffect, useRef } from 'react';
import Card, { MiniCard } from '../components/Card';

const CARD_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'];
const BOMB_LEVEL = { '50K': 1, color4: 2, same8: 3, joker4: 4 };
const SUIT_ORDER = { '♠': 4, '♥': 3, '♣': 2, '♦': 1 };
const TYPE_LABEL = { single:'单张', pair:'对子', triple:'三张', four:'四张', bomb:'炸弹' };
const AVATARS = ['龙','虎','狐','狼'];
const AVATAR_COLORS = ['#7c3aed','#0891b2','#d97706','#dc2626'];
const SCORE_RANKS = new Set(['5', '10', 'K']);

function cardValue(rank) { return CARD_ORDER.indexOf(rank); }
function isBlack(suit) { return suit === '♠' || suit === '♣'; }
function isRed(suit) { return suit === '♥' || suit === '♦'; }
function sortCards(cards) { return [...cards].sort((a,b) => cardValue(a.rank) - cardValue(b.rank)); }

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

function detectPattern(cards) {
  if (!cards || cards.length === 0) return null;
  const n = cards.length;
  if (n === 1) return { type: 'single', rank: cards[0].rank };
  if (n === 2) return cards[0].rank === cards[1].rank ? { type: 'pair', rank: cards[0].rank } : null;
  if (n === 3) {
    const f50k = detect50K(cards);
    if (f50k) return f50k;
    return cards.every(c => c.rank === cards[0].rank) ? { type: 'triple', rank: cards[0].rank } : null;
  }
  if (n === 4) {
    const jokers = cards.filter(c => c.suit === 'joker');
    if (jokers.length === 4) {
      const hasBig = jokers.filter(c => c.rank === '大王').length === 2;
      const hasSmall = jokers.filter(c => c.rank === '小王').length === 2;
      if (hasBig && hasSmall) return { type: 'bomb', bombType: 'joker4', rank: '大王', suit: null };
    }
    if (cards.every(c => c.rank === cards[0].rank)) {
      const rank = cards[0].rank;
      const allBlack = cards.every(c => isBlack(c.suit));
      const allRed = cards.every(c => isRed(c.suit));
      if (allBlack) return { type: 'bomb', bombType: 'color4', rank, color: 'black' };
      if (allRed) return { type: 'bomb', bombType: 'color4', rank, color: 'red' };
      return { type: 'four', rank };
    }
    return null;
  }
  if (n === 8 && cards.every(c => c.rank === cards[0].rank)) return { type: 'bomb', bombType: 'same8', rank: cards[0].rank };
  return null;
}

function comparePatterns(newP, oldP) {
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
      const colorOrder = { black: 2, red: 1 };
      if (newP.color !== oldP.color) return colorOrder[newP.color] > colorOrder[oldP.color];
      return cardValue(newP.rank) > cardValue(oldP.rank);
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
  return null;
}

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

function getAllBombs(hand) {
  const results = [];
  const big = hand.filter(c => c.rank === '大王');
  const small = hand.filter(c => c.rank === '小王');
  if (big.length >= 2 && small.length >= 2) results.push([big[0], big[1], small[0], small[1]]);

  const rankGroups = {};
  for (const c of hand) {
    if (!rankGroups[c.rank]) rankGroups[c.rank] = [];
    rankGroups[c.rank].push(c);
  }
  for (const group of Object.values(rankGroups)) {
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

function getBombIds(hand) {
  const ids = new Set();
  getAllBombs(hand).forEach(combo => combo.forEach(card => ids.add(card.id)));
  return ids;
}

function arrangeHand(hand) {
  const sorted = sortCards(hand);
  const bombIds = getBombIds(sorted);
  const normal = [];
  const scoreCards = [];
  const bombs = [];

  sorted.forEach(card => {
    if (bombIds.has(card.id)) bombs.push(card);
    else if (SCORE_RANKS.has(card.rank)) scoreCards.push(card);
    else normal.push(card);
  });

  return [...normal, ...scoreCards, ...bombs];
}

function getHint(hand, lastPlay) {
  if (!hand.length) return [];
  if (!lastPlay) return [hand[0].id];
  const candidates = [];
  const normalLen = lastPlay.type === 'bomb' ? null : getPatternLen(lastPlay);
  if (normalLen) candidates.push(...getCombinations(hand, normalLen));
  candidates.push(...getAllBombs(hand));
  for (const combo of candidates) {
    const pattern = detectPattern(combo);
    if (pattern && comparePatterns(pattern, lastPlay)) return combo.map(c => c.id);
  }
  return [];
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
  return pattern ? patternLabel(pattern) : '?';
}

export default function Game({ send, gameState, myHand, setMyHand, myInfo, toast }) {
  const [selected, setSelected] = useState(new Set());
  const [floats, setFloats] = useState([]);
  const [bombAnim, setBombAnim] = useState(false);
  const [sending, setSending] = useState(false);
  const [arranged, setArranged] = useState(false);
  const floatId = useRef(0);
  const prevScores = useRef({});

  const myIdx = gameState?.players?.findIndex(p => p.id === myInfo?.playerId) ?? -1;
  const isMyTurn = gameState?.currentPlayer === myIdx;
  const isFirst = !gameState?.lastPlay;
  const sortedHand = arranged ? arrangeHand(myHand) : sortCards(myHand);
  const lastPlayKey = gameState?.lastPlayCards?.map(c => c.id).join('|') || '';
  const myFinished = myHand.length === 0 && gameState?.status === 'playing';

  useEffect(() => { if (isMyTurn && navigator.vibrate) navigator.vibrate([100, 50, 100]); }, [isMyTurn]);
  useEffect(() => { setSending(false); }, [myHand, gameState?.currentPlayer]);

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
    if (gameState?.lastPlay?.type === 'bomb') {
      setBombAnim(true);
      setTimeout(() => setBombAnim(false), 700);
    }
  }, [lastPlayKey, gameState?.lastPlay?.type]);

  const toggleCard = useCallback((id) => {
    if (sending || myFinished) return;
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, [sending, myFinished]);

  function releaseSendingSoon() { setTimeout(() => setSending(false), 1500); }

  function playCards() {
    if (!isMyTurn || !selected.size || sending || myFinished) return;
    const cardIds = [...selected];
    send({ type: 'play_cards', cardIds });
    setSending(true);
    setSelected(new Set());
    releaseSendingSoon();
  }

  function pass() {
    if (!isMyTurn || isFirst || sending || myFinished) return;
    send({ type: 'pass' });
    setSending(true);
    setSelected(new Set());
    releaseSendingSoon();
  }

  function hint() {
    const ids = getHint(sortedHand, gameState?.lastPlay);
    if (ids.length) setSelected(new Set(ids));
    else toast('没有合适的牌可以出', 'dim');
  }

  function arrangeCards() {
    setArranged(true);
    setSelected(new Set());
    toast?.('已理牌：得分牌和炸弹在右侧', 'success');
  }

  function selectAll() { setSelected(new Set(sortedHand.map(c => c.id))); }

  const players = gameState?.players || [];
  const selectedCards = sortedHand.filter(c => selected.has(c.id));
  const selectedType = detectSelectedType(selectedCards);

  let leftOpp = null, topOpp = null, rightOpp = null;
  if (players.length === 4) {
    rightOpp = players[(myIdx + 1) % 4];
    topOpp = players[(myIdx + 2) % 4];
    leftOpp = players[(myIdx + 3) % 4];
  } else if (players.length === 3) {
    topOpp = players[(myIdx + 1) % 3];
    leftOpp = players[(myIdx + 2) % 3];
  } else if (players.length === 2) {
    topOpp = players[(myIdx + 1) % 2];
  }

  const lp = gameState?.lastPlay;
  const lpCards = gameState?.lastPlayCards || [];
  const lpPlayer = players.find(p => p.id === gameState?.lastPlayerId);

  return (
    <div style={{
      height:'100%', display:'flex', flexDirection:'column', background:'#0f3a24',
      animation: bombAnim ? 'shake 0.35s ease' : 'none', position:'relative', overflow:'hidden',
      fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif",
    }}>
      {bombAnim && <div style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(245,158,11,0.12)', pointerEvents:'none' }} />}

      <div style={{ position:'fixed', top:'40%', left:'50%', transform:'translateX(-50%)', zIndex:110, pointerEvents:'none' }}>
        {floats.map(f => <div key={f.id} style={{ fontSize:30, fontWeight:900, color:'#fbbf24', textShadow:'0 2px 8px rgba(0,0,0,0.45)', animation:'floatUp 2.5s ease-out forwards' }}>{f.text}</div>)}
      </div>

      <div style={{ height:'var(--scorebar-h, 48px)', display:'flex', padding:'4px 8px', alignItems:'center', background:'#0b2417', borderBottom:'1px solid rgba(255,255,255,0.08)', zIndex:20 }}>
        {players.map((p, i) => {
          const isCurrent = gameState?.currentPlayer === i;
          const finishIndex = gameState?.finishOrder?.indexOf(p.id) ?? -1;
          const finished = finishIndex >= 0 || p.cardCount === 0;
          return (
            <div key={p.id} style={{
              flex:1, minWidth:0, display:'flex', alignItems:'center', gap:6, padding:'3px 7px',
              borderRadius:14, margin:'0 3px', background: isCurrent ? 'rgba(245,197,24,0.14)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isCurrent ? '#f5c518' : 'rgba(255,255,255,0.05)'}`,
              boxShadow: isCurrent ? '0 0 10px rgba(245,197,24,0.25)' : 'none',
              transition:'all 0.2s', opacity:p.isOnline ? 1 : 0.45,
            }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:AVATAR_COLORS[i], display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, color:'#fff', flexShrink:0 }}>{AVATARS[i]}</div>
              <div style={{ flex:1, overflow:'hidden' }}>
                <div style={{ fontSize:10, color:'#f8fafc', whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden' }}>{p.name}{!p.isOnline ? ' 离线' : ''}</div>
                <div style={{ fontSize:11, fontWeight:900, color:'#fbbf24' }}>{p.score}分</div>
              </div>
              <div style={{ fontSize:10, color: finished ? '#4ade80' : '#cbd5e1', flexShrink:0, fontWeight:800 }}>{finished ? `第${finishIndex + 1 || ''}走` : `牌${p.cardCount}`}</div>
            </div>
          );
        })}
      </div>

      <div style={{ flex:1, display:'flex', position:'relative', zIndex:10, minHeight:0 }}>
        <div style={{ width:'var(--side-col-w, 100px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {leftOpp && <OpponentSide player={leftOpp} idx={players.indexOf(leftOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(leftOpp)} />}
        </div>

        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
          <div style={{ height:'36%', display:'flex', alignItems:'center', justifyContent:'center', minHeight:0 }}>
            {topOpp && <OpponentTop player={topOpp} idx={players.indexOf(topOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(topOpp)} />}
          </div>
          <div style={{ height:'64%', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', minHeight:0 }}>
            <div style={{ position:'absolute', width:'78%', height:'76%', borderRadius:'34px', border:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.025)', boxShadow: isMyTurn ? 'inset 0 0 20px rgba(245,197,24,0.14)' : 'none' }} />
            {lp ? (
              <div style={{ zIndex:5, textAlign:'center', maxWidth:'96%' }}>
                <div style={{ marginBottom:5, fontSize:12, fontWeight:900, color:'#fbbf24', textShadow:'0 2px 4px rgba(0,0,0,0.5)' }}>{lpPlayer?.name} · {patternLabel(lp)}</div>
                <div style={{ display:'flex', gap:3, justifyContent:'center', flexWrap:'wrap' }}>{lpCards.map(c => <MiniCard key={c.id} card={c} />)}</div>
              </div>
            ) : <div style={{ color:'rgba(255,255,255,0.35)', fontSize:14 }}>{isMyTurn ? '请出牌' : '等待中...'}</div>}
          </div>
        </div>

        <div style={{ width:'var(--side-col-w, 100px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {rightOpp && <OpponentSide player={rightOpp} idx={players.indexOf(rightOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(rightOpp)} />}
        </div>
      </div>

      <div style={{ paddingBottom:'var(--hand-bottom-pad, 8px)', zIndex:30, flexShrink:0, background:'linear-gradient(to top, rgba(0,0,0,0.28), transparent)' }}>
        <div style={{ height:18, textAlign:'center', fontSize:12, color:'#fbbf24', fontWeight:900, textShadow:'0 1px 2px rgba(0,0,0,0.8)' }}>
          {myFinished ? '你已出完，等待本局打完' : selected.size > 0 ? `已选${selected.size}张 · ${selectedType}` : sending ? '正在出牌...' : isMyTurn ? '请出牌' : arranged ? '已理牌：得分牌和炸弹在右侧' : ''}
        </div>

        <div style={{ display:'flex', justifyContent:'center', padding:'var(--hand-y-pad-top, 10px) var(--hand-x-pad, 40px) var(--hand-y-pad-bottom, 20px)', overflow:'visible', touchAction:'manipulation' }}>
          <div style={{ display:'flex', justifyContent:'center', minWidth:0, opacity: myFinished ? 0.35 : 1 }}>
            {sortedHand.map((card, i) => (
              <div key={card.id} style={{ marginLeft: i === 0 ? 0 : 'var(--hand-overlap, -24px)' }}>
                <Card card={card} selected={selected.has(card.id)} onClick={() => toggleCard(card.id)} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:7, padding:'0 10px', alignItems:'center' }}>
          <button disabled={sending || myFinished} onClick={arrangeCards} className="btn-lite" style={{ padding:'6px 11px', borderRadius:14, fontSize:12, fontWeight:900 }}>理牌</button>
          <button disabled={sending || myFinished} onClick={hint} className="btn-lite" style={{ padding:'6px 11px', borderRadius:14, fontSize:12, fontWeight:900 }}>提示</button>
          <button disabled={sending || myFinished} onClick={selectAll} className="btn-lite" style={{ padding:'6px 11px', borderRadius:14, fontSize:12, fontWeight:900 }}>全选</button>
          <div style={{ flex:1 }} />
          <button disabled={!isMyTurn || isFirst || sending || myFinished} onClick={pass} className="btn-pass" style={{ padding:'8px 18px', borderRadius:14, fontSize:14, fontWeight:900 }}>过牌</button>
          <button disabled={!isMyTurn || !selected.size || sending || myFinished} onClick={playCards} className="btn-play" style={{ padding:'8px 24px', borderRadius:14, fontSize:16, fontWeight:900 }}>出牌{selected.size > 0 ? `(${selected.size})` : ''}</button>
        </div>
      </div>

      <style>{`
        .btn-lite { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.18); color:#f8fafc; }
        .btn-lite:disabled { opacity:0.35; }
        .btn-pass { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.22); color:#fff; }
        .btn-pass:disabled { opacity:0.3; }
        .btn-play { background:#f5c518; border:none; color:#102016; box-shadow:0 3px 10px rgba(0,0,0,0.28); }
        .btn-play:disabled { background:#45524a; color:#9ca3af; box-shadow:none; }
        @keyframes myTurnPulse { 0%, 100% { border-color:rgba(245,197,24,0.1); } 50% { border-color:rgba(245,197,24,0.6); } }
      `}</style>
    </div>
  );
}

function OpponentSide({ player, idx, isCurrent }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, opacity: player.isOnline ? 1 : 0.5 }}>
      <div style={{ width:42, height:42, borderRadius:'50%', background:AVATAR_COLORS[idx], display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900, color:'#fff', border: `2px solid ${isCurrent ? '#f5c518' : 'rgba(255,255,255,0.2)'}`, boxShadow: isCurrent ? '0 0 14px rgba(245,197,24,0.45)' : 'none' }}>{AVATARS[idx]}</div>
      <div style={{ fontSize:11, fontWeight:900, color:'#fff', textAlign:'center', maxWidth:70, overflow:'hidden', textOverflow:'ellipsis' }}>{player.name}{!player.isOnline ? ' 离线' : ''}</div>
      <div style={{ fontSize:10, color:'#cbd5e1' }}>{player.cardCount === 0 ? '已出完' : `${player.cardCount}张`}</div>
    </div>
  );
}

function OpponentTop({ player, idx, isCurrent }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, opacity: player.isOnline ? 1 : 0.5, padding:'6px 10px', borderRadius:16, background:'rgba(0,0,0,0.14)', border:`1px solid ${isCurrent ? '#f5c51866' : 'rgba(255,255,255,0.06)'}` }}>
      <div style={{ width:34, height:34, borderRadius:'50%', background:AVATAR_COLORS[idx], display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:900, color:'#fff', border: `2px solid ${isCurrent ? '#f5c518' : 'rgba(255,255,255,0.2)'}`, boxShadow: isCurrent ? '0 0 12px rgba(245,197,24,0.45)' : 'none' }}>{AVATARS[idx]}</div>
      <div style={{ display:'flex', flexDirection:'column' }}>
        <div style={{ fontSize:11, fontWeight:900, color:'#fff' }}>{player.name}{!player.isOnline ? ' 离线' : ''}</div>
        <div style={{ fontSize:10, color:'#cbd5e1' }}>{player.cardCount === 0 ? '已出完' : `${player.cardCount}张`}</div>
      </div>
    </div>
  );
}
