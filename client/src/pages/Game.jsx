import React, { useState, useCallback, useEffect, useRef } from 'react';
import Card, { MiniCard } from '../components/Card';

const CARD_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'];
const SCORE_MAP = { '5': 5, '10': 10, 'K': 10 };
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
function calcScore(cards = []) { return cards.reduce((sum, c) => sum + (SCORE_MAP[c.rank] || 0), 0); }

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
      current.push(arr[i]); pick(i + 1, current); current.pop();
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
  for (const c of hand) { if (!rankGroups[c.rank]) rankGroups[c.rank] = []; rankGroups[c.rank].push(c); }
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

function getBombIds(hand) { const ids = new Set(); getAllBombs(hand).forEach(combo => combo.forEach(card => ids.add(card.id))); return ids; }

function arrangeHand(hand) {
  const sorted = sortCards(hand);
  const bombIds = getBombIds(sorted);
  const normal = [], scoreCards = [], bombs = [];
  sorted.forEach(card => { if (bombIds.has(card.id)) bombs.push(card); else if (SCORE_RANKS.has(card.rank)) scoreCards.push(card); else normal.push(card); });
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
      setBombAnim(true); setTimeout(() => setBombAnim(false), 700);
    }
  }, [lastPlayKey, gameState?.lastPlay?.type]);

  const toggleCard = useCallback((id) => {
    if (sending || myFinished) return;
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, [sending, myFinished]);

  function releaseSendingSoon() { setTimeout(() => setSending(false), 1500); }
  function playCards() { if (!isMyTurn || !selected.size || sending || myFinished) return; send({ type: 'play_cards', cardIds: [...selected] }); setSending(true); setSelected(new Set()); releaseSendingSoon(); }
  function pass() { if (!isMyTurn || isFirst || sending || myFinished) return; send({ type: 'pass' }); setSending(true); setSelected(new Set()); releaseSendingSoon(); }
  function hint() { const ids = getHint(sortedHand, gameState?.lastPlay); if (ids.length) setSelected(new Set(ids)); else toast('没有合适的牌可以出', 'dim'); }
  function arrangeCards() { setArranged(true); setSelected(new Set()); toast?.('已理牌：得分牌和炸弹在右侧', 'success'); }
  function selectAll() { setSelected(new Set(sortedHand.map(c => c.id))); }

  const selectedCards = sortedHand.filter(c => selected.has(c.id));
  const selectedType = detectSelectedType(selectedCards);
  const lp = gameState?.lastPlay;
  const lpCards = gameState?.lastPlayCards || [];
  const lpPlayer = players.find(p => p.id === gameState?.lastPlayerId);
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

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#0f3a24', animation: bombAnim ? 'shake 0.35s ease' : 'none', position:'relative', overflow:'hidden', fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif" }}>
      {bombAnim && <div style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(245,158,11,0.12)', pointerEvents:'none' }} />}

      <div style={{ position:'fixed', top:'40%', left:'50%', transform:'translateX(-50%)', zIndex:110, pointerEvents:'none' }}>
        {floats.map(f => <div key={f.id} style={{ fontSize:30, fontWeight:900, color:'#fbbf24', textShadow:'0 2px 8px rgba(0,0,0,0.45)', animation:'floatUp 2.5s ease-out forwards' }}>{f.text}</div>)}
      </div>

      <div style={{ height:34, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 12px', background:'#0b2417', borderBottom:'1px solid rgba(255,255,255,0.08)', zIndex:20 }}>
        <div style={{ fontSize:12, color:'#f8fafc', fontWeight:900 }}>河南五十K <span style={{ color:'#94a3b8', fontWeight:600 }}>· {gameState?.mode === 'solo' ? '单机练习' : `房间${gameState?.id || ''}`}</span></div>
        <div style={{ fontSize:12, color:isMyTurn ? '#fbbf24' : '#cbd5e1', fontWeight:900 }}>{isMyTurn ? '轮到你：请出牌' : `轮到：${currentPlayer?.name || '等待'}`}</div>
        <div style={{ fontSize:11, color:'#94a3b8' }}>第{gameState?.roundNum || 1}局</div>
      </div>

      <div style={{ flex:1, display:'flex', position:'relative', zIndex:10, minHeight:0 }}>
        <div style={{ width:'var(--side-col-w, 100px)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {leftOpp && <OpponentSide player={leftOpp} idx={players.indexOf(leftOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(leftOpp)} side="left" />}
        </div>

        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
          <div style={{ height:'24%', display:'flex', alignItems:'center', justifyContent:'center', minHeight:0 }}>
            {topOpp && <OpponentTop player={topOpp} idx={players.indexOf(topOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(topOpp)} />}
          </div>

          <div style={{ height:'76%', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', minHeight:0 }}>
            <div style={{ position:'absolute', width:'82%', height:'82%', borderRadius:'32px', border:'1px solid rgba(255,255,255,0.07)', background:'radial-gradient(circle at center, rgba(255,255,255,0.045), rgba(255,255,255,0.015))', boxShadow: isMyTurn ? 'inset 0 0 22px rgba(245,197,24,0.16)' : 'none' }} />
            <div style={{ zIndex:5, textAlign:'center', maxWidth:'96%' }}>
              <div style={{ fontSize:isMyTurn ? 34 : 16, color:isMyTurn ? '#fbbf24' : '#cbd5e1', fontWeight:900, marginBottom:8, textShadow:isMyTurn ? '0 0 16px rgba(251,191,36,0.45)' : 'none' }}>{isMyTurn ? '请出牌' : '牌桌'}</div>
              {lp ? (
                <>
                  <div style={{ marginBottom:5, fontSize:12, fontWeight:900, color:'#fbbf24' }}>上一手：{lpPlayer?.name} · {patternLabel(lp)}</div>
                  <div style={{ display:'flex', gap:3, justifyContent:'center', flexWrap:'wrap' }}>{lpCards.map(c => <MiniCard key={c.id} card={c} />)}</div>
                  <div style={{ margin:'7px auto 0', width:'fit-content', padding:'3px 16px', borderRadius:14, background:'rgba(0,0,0,0.3)', fontSize:12, color:'#e5e7eb' }}>本墩分数 <span style={{ color:'#fbbf24', fontWeight:900 }}>{pileScore}分</span></div>
                </>
              ) : <div style={{ color:'rgba(255,255,255,0.35)', fontSize:13 }}>{isMyTurn ? '先手出牌' : '等待出牌...'}</div>}
            </div>
          </div>
        </div>

        <div style={{ width:'var(--side-col-w, 100px)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {rightOpp && <OpponentSide player={rightOpp} idx={players.indexOf(rightOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(rightOpp)} side="right" />}
        </div>
      </div>

      <div style={{ paddingBottom:'var(--hand-bottom-pad, 8px)', zIndex:30, flexShrink:0, background:'linear-gradient(to top, rgba(0,0,0,0.30), transparent)' }}>
        {me && <div style={{ display:'flex', justifyContent:'center', marginBottom:1 }}><SelfPanel player={me} isCurrent={isMyTurn} /></div>}
        <div style={{ height:18, textAlign:'center', fontSize:12, color:'#fbbf24', fontWeight:900, textShadow:'0 1px 2px rgba(0,0,0,0.8)' }}>
          {myFinished ? '你已出完，等待本局打完' : selected.size > 0 ? `已选${selected.size}张 · ${selectedType}` : sending ? '正在出牌...' : isMyTurn ? '请出牌' : arranged ? '已理牌：得分牌和炸弹在右侧' : ''}
        </div>

        <div style={{ display:'flex', justifyContent:'center', padding:'var(--hand-y-pad-top, 10px) var(--hand-x-pad, 40px) var(--hand-y-pad-bottom, 20px)', overflow:'visible', touchAction:'manipulation' }}>
          <div style={{ display:'flex', justifyContent:'center', minWidth:0, opacity: myFinished ? 0.35 : 1 }}>
            {sortedHand.map((card, i) => (
              <div key={card.id} style={{ marginLeft: i === 0 ? 0 : 'var(--hand-overlap, -24px)', filter:selected.has(card.id) ? 'drop-shadow(0 0 8px rgba(251,191,36,0.8))' : 'none' }}>
                <Card card={card} selected={selected.has(card.id)} onClick={() => toggleCard(card.id)} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 10px 2px' }}>
          <div style={{ display:'flex', gap:18, fontSize:11, color:'#cbd5e1', flex:1, paddingLeft:8 }}><span>普通</span><span>分牌</span><span>炸弹</span></div>
          <button disabled={sending || myFinished} onClick={arrangeCards} className="btn-lite">理牌</button>
          <button disabled={sending || myFinished} onClick={hint} className="btn-lite">提示</button>
          <button disabled={!isMyTurn || isFirst || sending || myFinished} onClick={pass} className="btn-pass">过牌</button>
          <button disabled={!isMyTurn || !selected.size || sending || myFinished} onClick={playCards} className="btn-play">出牌{selected.size > 0 ? `(${selected.size})` : ''}</button>
        </div>
      </div>

      <style>{`
        .btn-lite { padding:7px 13px; border-radius:14px; font-size:12px; font-weight:900; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.18); color:#f8fafc; }
        .btn-lite:disabled { opacity:0.35; }
        .btn-pass { padding:8px 18px; border-radius:14px; font-size:14px; font-weight:900; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.22); color:#fff; }
        .btn-pass:disabled { opacity:0.3; }
        .btn-play { padding:8px 24px; border-radius:14px; font-size:16px; font-weight:900; background:#f5c518; border:none; color:#102016; box-shadow:0 3px 10px rgba(0,0,0,0.28); }
        .btn-play:disabled { background:#45524a; color:#9ca3af; box-shadow:none; }
      `}</style>
    </div>
  );
}

function PlayerAvatar({ player, idx, size = 40 }) {
  return <div style={{ width:size, height:size, borderRadius:'50%', background:AVATAR_COLORS[idx] || '#475569', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size > 36 ? 16 : 13, fontWeight:900, color:'#fff', flexShrink:0 }}>{player?.isBot ? '机' : (AVATARS[idx] || '玩')}</div>;
}

function OpponentSide({ player, idx, isCurrent, side }) {
  return (
    <div style={{ width:74, padding:'10px 6px', borderRadius:18, background:isCurrent?'rgba(245,197,24,0.13)':'rgba(0,0,0,0.16)', border:`1px solid ${isCurrent ? '#f5c518' : 'rgba(255,255,255,0.08)'}`, boxShadow:isCurrent?'0 0 14px rgba(245,197,24,0.32)':'none', display:'flex', flexDirection:'column', alignItems:'center', gap:5, opacity: player.isOnline ? 1 : 0.45 }}>
      <PlayerAvatar player={player} idx={idx} size={38} />
      <div style={{ fontSize:11, fontWeight:900, color:'#fff', maxWidth:66, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{player.name}</div>
      <div style={{ fontSize:10, color:'#fbbf24', fontWeight:800 }}>{player.score}分</div>
      <div style={{ fontSize:10, color:'#cbd5e1' }}>{player.cardCount === 0 ? '已出完' : `${player.cardCount}张`}</div>
    </div>
  );
}

function OpponentTop({ player, idx, isCurrent }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px', borderRadius:18, background:isCurrent?'rgba(245,197,24,0.14)':'rgba(0,0,0,0.16)', border:`1px solid ${isCurrent ? '#f5c518' : 'rgba(255,255,255,0.08)'}`, boxShadow:isCurrent?'0 0 14px rgba(245,197,24,0.32)':'none', opacity: player.isOnline ? 1 : 0.45 }}>
      <PlayerAvatar player={player} idx={idx} size={36} />
      <div><div style={{ fontSize:12, color:'#fff', fontWeight:900 }}>{player.name}</div><div style={{ fontSize:10, color:'#cbd5e1' }}>{player.score}分 · {player.cardCount === 0 ? '已出完' : `${player.cardCount}张`}</div></div>
    </div>
  );
}

function SelfPanel({ player, isCurrent }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 12px', borderRadius:16, background:isCurrent?'rgba(245,197,24,0.14)':'rgba(0,0,0,0.22)', border:`1px solid ${isCurrent ? '#f5c518' : 'rgba(255,255,255,0.08)'}` }}>
      <div style={{ fontSize:11, color:'#fbbf24', fontWeight:900 }}>我</div>
      <div style={{ fontSize:12, color:'#fff', fontWeight:900 }}>{player.name}</div>
      <div style={{ fontSize:11, color:'#cbd5e1' }}>{player.score}分 · {player.cardCount}张</div>
    </div>
  );
}
