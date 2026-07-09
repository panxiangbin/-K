import React, { useState, useCallback, useEffect, useRef } from 'react';
import Card, { MiniCard } from '../components/Card';

const CARD_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'];
const BOMB_LEVEL = { '50K': 1, color4: 2, same8: 3, joker4: 4 };
const SUIT_ORDER = { '♠': 4, '♥': 3, '♣': 2, '♦': 1 };
const TYPE_LABEL = { single:'单张', pair:'对子', triple:'三张', bomb:'💥炸弹' };
const AVATARS = ['🐲','🐯','🦊','🐺'];
const AVATAR_COLORS = ['#9333ea','#0891b2','#d97706','#dc2626'];

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
  return '💥炸弹';
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
  const floatId = useRef(0);
  const prevScores = useRef({});

  const myIdx = gameState?.players?.findIndex(p => p.id === myInfo?.playerId) ?? -1;
  const isMyTurn = gameState?.currentPlayer === myIdx;
  const isFirst = !gameState?.lastPlay;
  const sortedHand = sortCards(myHand);
  const lastPlayKey = gameState?.lastPlayCards?.map(c => c.id).join('|') || '';

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
      setTimeout(() => setBombAnim(false), 1000);
    }
  }, [lastPlayKey, gameState?.lastPlay?.type]);

  const toggleCard = useCallback((id) => {
    if (sending) return;
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, [sending]);

  function releaseSendingSoon() {
    setTimeout(() => setSending(false), 1500);
  }

  function playCards() {
    if (!isMyTurn || !selected.size || sending) return;
    const cardIds = [...selected];
    send({ type: 'play_cards', cardIds });
    setSending(true);
    setSelected(new Set());
    releaseSendingSoon();
  }

  function pass() {
    if (!isMyTurn || isFirst || sending) return;
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
    <div className="felt-texture" style={{
      height:'100%', display:'flex', flexDirection:'column', background:'#1a4a2a',
      animation: bombAnim ? 'shake 0.5s ease' : 'none', position:'relative', overflow:'hidden',
      fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif",
    }}>
      {bombAnim && <div style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(255,0,0,0.3)', animation:'pulse 0.2s infinite' }} />}

      <div style={{ position:'fixed', top:'40%', left:'50%', transform:'translateX(-50%)', zIndex:110, pointerEvents:'none' }}>
        {floats.map(f => <div key={f.id} style={{ fontSize:32, fontWeight:900, color:'#f5c518', textShadow:'0 0 10px rgba(0,0,0,0.5)', animation:'floatUp 2.5s ease-out forwards' }}>{f.text}</div>)}
      </div>

      <div style={{ height:'var(--scorebar-h, 48px)', display:'flex', padding:'0 8px', alignItems:'center', background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(255,255,255,0.1)', zIndex:20 }}>
        {players.map((p, i) => {
          const isCurrent = gameState?.currentPlayer === i;
          return (
            <div key={p.id} style={{
              flex:1, minWidth:0, display:'flex', alignItems:'center', gap:6, padding:'3px 6px',
              borderRadius:18, margin:'0 3px', background: isCurrent ? 'rgba(245,197,24,0.2)' : 'transparent',
              border: `1px solid ${isCurrent ? '#f5c518' : 'transparent'}`, boxShadow: isCurrent ? '0 0 15px rgba(245,197,24,0.4)' : 'none',
              transition:'all 0.3s', opacity:p.isOnline ? 1 : 0.45,
            }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:AVATAR_COLORS[i], display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>{AVATARS[i]}</div>
              <div style={{ flex:1, overflow:'hidden' }}>
                <div style={{ fontSize:10, color:'#eee', whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden' }}>{p.name}{!p.isOnline ? ' 离线' : ''}</div>
                <div style={{ fontSize:12, fontWeight:900, color:'#f5c518' }}>{p.score} <span style={{fontSize:9}}>pts</span></div>
              </div>
              <div style={{ fontSize:11, color:'#fff', opacity:0.7, flexShrink:0 }}>🎴{p.cardCount}</div>
            </div>
          );
        })}
      </div>

      <div style={{ flex:1, display:'flex', position:'relative', zIndex:10, minHeight:0 }}>
        <div style={{ width:'var(--side-col-w, 100px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {leftOpp && <OpponentSide player={leftOpp} idx={players.indexOf(leftOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(leftOpp)} />}
        </div>

        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
          <div style={{ height:'38%', display:'flex', alignItems:'center', justifyContent:'center', minHeight:0 }}>
            {topOpp && <OpponentTop player={topOpp} idx={players.indexOf(topOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(topOpp)} />}
          </div>
          <div style={{ height:'62%', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', minHeight:0 }}>
            <div style={{ position:'absolute', width:'80%', height:'80%', borderRadius:'50%', border:'2px solid rgba(255,255,255,0.05)', background:'rgba(0,0,0,0.1)', boxShadow: isMyTurn ? 'inset 0 0 30px rgba(245,197,24,0.2)' : 'none', animation: isMyTurn ? 'myTurnPulse 2s infinite' : 'none' }} />
            {lp ? (
              <div style={{ zIndex:5, textAlign:'center', maxWidth:'96%' }}>
                <div style={{ marginBottom:6, fontSize:13, fontWeight:900, color:'#f5c518', textShadow:'0 2px 4px rgba(0,0,0,0.5)' }}>{lpPlayer?.name} : {patternLabel(lp)}</div>
                <div style={{ display:'flex', gap:3, justifyContent:'center', flexWrap:'wrap' }}>{lpCards.map(c => <MiniCard key={c.id} card={c} />)}</div>
              </div>
            ) : <div style={{ color:'rgba(255,255,255,0.2)', fontSize:14 }}>{isMyTurn ? '请出牌' : '等待中...'}</div>}
          </div>
        </div>

        <div style={{ width:'var(--side-col-w, 100px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {rightOpp && <OpponentSide player={rightOpp} idx={players.indexOf(rightOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(rightOpp)} />}
        </div>
      </div>

      <div style={{ paddingBottom:'var(--hand-bottom-pad, 8px)', zIndex:30, flexShrink:0 }}>
        <div style={{ height:22, textAlign:'center', fontSize:13, color:'#f5c518', fontWeight:900, textShadow:'0 1px 2px rgba(0,0,0,0.8)' }}>
          {selected.size > 0 ? `已选${selected.size}张 · ${selectedType}` : sending ? '正在出牌...' : ''}
        </div>

        <div style={{ display:'flex', justifyContent:'center', padding:'var(--hand-y-pad-top, 10px) 0 var(--hand-y-pad-bottom, 20px)', overflowX:'auto', overflowY:'visible', WebkitOverflowScrolling:'touch', paddingLeft:'var(--hand-x-pad, 40px)', paddingRight:'var(--hand-x-pad, 40px)', touchAction:'pan-x' }}>
          <div style={{ display:'flex', minWidth:'max-content' }}>
            {sortedHand.map((card, i) => (
              <div key={card.id} style={{ marginLeft: i === 0 ? 0 : 'var(--hand-overlap, -24px)' }}>
                <Card card={card} selected={selected.has(card.id)} onClick={() => toggleCard(card.id)} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:8, padding:'0 14px', alignItems:'center' }}>
          <button disabled={sending} onClick={hint} className="btn-gold-outline" style={{ padding:'7px 13px', borderRadius:18, fontSize:13, fontWeight:900 }}>💡提示</button>
          <button disabled={sending} onClick={selectAll} className="btn-gold-outline" style={{ padding:'7px 13px', borderRadius:18, fontSize:13, fontWeight:900 }}>全选</button>
          <div style={{ flex:1 }} />
          <button disabled={!isMyTurn || isFirst || sending} onClick={pass} className="btn-pass" style={{ padding:'9px 20px', borderRadius:18, fontSize:15, fontWeight:900 }}>过牌</button>
          <button disabled={!isMyTurn || !selected.size || sending} onClick={playCards} className="btn-play" style={{ padding:'9px 28px', borderRadius:18, fontSize:17, fontWeight:900 }}>出牌{selected.size > 0 ? `(${selected.size})` : ''}</button>
        </div>
      </div>

      <style>{`
        .btn-gold-outline { background:rgba(0,0,0,0.3); border:1px solid #f5c518; color:#f5c518; }
        .btn-gold-outline:disabled { opacity:0.45; }
        .btn-pass { background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.3); color:#fff; }
        .btn-pass:disabled { opacity:0.3; }
        .btn-play { background:linear-gradient(to bottom, #f5c518, #e8a800); border:none; color:#1a4a2a; box-shadow:0 4px 10px rgba(0,0,0,0.3); }
        .btn-play:disabled { background:#555; color:#888; box-shadow:none; }
        @keyframes myTurnPulse { 0%, 100% { border-color:rgba(245,197,24,0.1); } 50% { border-color:rgba(245,197,24,0.6); } }
      `}</style>
    </div>
  );
}

function OpponentSide({ player, idx, isCurrent }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, opacity: player.isOnline ? 1 : 0.5 }}>
      <div style={{ width:46, height:46, borderRadius:'50%', background:AVATAR_COLORS[idx], display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, border: `3px solid ${isCurrent ? '#f5c518' : 'rgba(255,255,255,0.2)'}`, boxShadow: isCurrent ? '0 0 20px #f5c518' : 'none' }}>{AVATARS[idx]}</div>
      <div style={{ fontSize:11, fontWeight:900, color:'#fff', textAlign:'center', maxWidth:70, overflow:'hidden', textOverflow:'ellipsis' }}>{player.name}{!player.isOnline ? ' 离线' : ''}</div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
        {[...Array(Math.min(player.cardCount, 5))].map((_, i) => <div key={i} style={{ marginTop: i === 0 ? 0 : -24 }}><Card faceDown tiny /></div>)}
        {player.cardCount > 5 && <div style={{ fontSize:10, color:'#f5c518', marginTop:4 }}>+{player.cardCount-5}</div>}
      </div>
    </div>
  );
}

function OpponentTop({ player, idx, isCurrent }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, opacity: player.isOnline ? 1 : 0.5 }}>
      <div style={{ width:38, height:38, borderRadius:'50%', background:AVATAR_COLORS[idx], display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, border: `2px solid ${isCurrent ? '#f5c518' : 'rgba(255,255,255,0.2)'}`, boxShadow: isCurrent ? '0 0 15px #f5c518' : 'none' }}>{AVATARS[idx]}</div>
      <div style={{ display:'flex', flexDirection:'column' }}>
        <div style={{ fontSize:11, fontWeight:900, color:'#fff' }}>{player.name}{!player.isOnline ? ' 离线' : ''}</div>
        <div style={{ display:'flex' }}>
          {[...Array(Math.min(player.cardCount, 8))].map((_, i) => <div key={i} style={{ marginLeft: i === 0 ? 0 : -16 }}><Card faceDown tiny /></div>)}
          {player.cardCount > 8 && <div style={{ fontSize:10, color:'#f5c518', marginLeft:5, alignSelf:'center' }}>+{player.cardCount-8}</div>}
        </div>
      </div>
    </div>
  );
}
