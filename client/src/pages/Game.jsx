import React, { useState, useCallback, useEffect, useRef } from 'react';
import Card, { MiniCard } from '../components/Card';

const CARD_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'];
const TYPE_LABEL = { single:'单张', pair:'对子', triple:'三张', straight:'顺子', pairs:'连对', bomb:'💥炸弹' };
const AVATARS = ['🐲','🐯','🦊','🐺'];
const AVATAR_COLORS = ['#9333ea','#0891b2','#d97706','#dc2626'];

function sortCards(cards) {
  return [...cards].sort((a,b) => CARD_ORDER.indexOf(a.rank) - CARD_ORDER.indexOf(b.rank));
}

function getHint(hand, lastPlay) {
  if (!lastPlay) return hand.length > 0 ? [hand[0].id] : [];
  if (lastPlay.type === 'single') {
    const bigger = hand.filter(c => CARD_ORDER.indexOf(c.rank) > CARD_ORDER.indexOf(lastPlay.rank));
    if (bigger.length) return [bigger[0].id];
  }
  const rankGroups = {};
  hand.forEach(c => { rankGroups[c.rank] = rankGroups[c.rank] || []; rankGroups[c.rank].push(c.id); });
  for (const [rank, ids] of Object.entries(rankGroups)) {
    if (ids.length >= 4 && lastPlay.type !== 'bomb') return ids.slice(0,4);
  }
  return [];
}

function detectSelectedType(cards) {
  if (!cards.length) return '';
  const ranks = cards.map(c => c.rank);
  const uniqueRanks = [...new Set(ranks)];
  if (cards.length === 1) return '单张';
  if (cards.length === 2 && uniqueRanks.length === 1) return '对子';
  if (cards.length === 3 && uniqueRanks.length === 1) return '三张';
  if (cards.length === 2 && ranks.includes('大王') && ranks.includes('小王')) return '💥王炸';
  if (uniqueRanks.length === 1 && cards.length >= 4) return `💥炸弹×${cards.length}`;
  const sorted = [...cards].sort((a,b)=>CARD_ORDER.indexOf(a.rank)-CARD_ORDER.indexOf(b.rank));
  const vals = sorted.map(c=>CARD_ORDER.indexOf(c.rank));
  const isSeq = vals.every((v,i)=>i===0||v===vals[i-1]+1);
  if (isSeq && cards.length >= 5) return `顺子×${cards.length}`;
  if (cards.length % 2 === 0 && uniqueRanks.length === cards.length/2) {
    const grps = uniqueRanks.map(r=>ranks.filter(x=>x===r).length);
    if (grps.every(g=>g===2)) return `连对×${cards.length/2}`;
  }
  return '?';
}

export default function Game({ send, gameState, myHand, setMyHand, myInfo, toast }) {
  const [selected, setSelected] = useState(new Set());
  const [floats, setFloats] = useState([]);
  const [bombAnim, setBombAnim] = useState(false);
  const floatId = useRef(0);
  const prevScores = useRef({});

  const myIdx = gameState?.players?.findIndex(p => p.id === myInfo?.playerId) ?? -1;
  const isMyTurn = gameState?.currentPlayer === myIdx;
  const isFirst = !gameState?.lastPlay;
  const sortedHand = sortCards(myHand);

  useEffect(() => {
    if (isMyTurn && navigator.vibrate) navigator.vibrate([100, 50, 100]);
  }, [isMyTurn]);

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

  const toggleCard = useCallback((id) => {
    setSelected(s => { const n = new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  }, []);

  function playCards() {
    if (!isMyTurn || !selected.size) return;
    const cardIds = [...selected];
    const cards = myHand.filter(c => cardIds.includes(c.id));
    send({ type: 'play_cards', cardIds });
    setMyHand(h => h.filter(c => !cardIds.includes(c.id)));
    setSelected(new Set());
    const ranks = new Set(cards.map(c => c.rank));
    if ((ranks.size===1 && cards.length>=4) || (cards.some(c=>c.rank==='大王') && cards.some(c=>c.rank==='小王'))) {
      setBombAnim(true); setTimeout(()=>setBombAnim(false), 1000);
    }
  }

  function pass() {
    if (!isMyTurn || isFirst) return;
    send({ type: 'pass' });
    setSelected(new Set());
  }

  function hint() {
    const ids = getHint(sortedHand, gameState?.lastPlay);
    if (ids.length) setSelected(new Set(ids));
    else toast('没有合适的牌可以出', 'dim');
  }

  function selectAll() {
    setSelected(new Set(myHand.map(c=>c.id)));
  }

  const players = gameState?.players || [];
  const selectedCards = myHand.filter(c => selected.has(c.id));
  const selectedType = detectSelectedType(selectedCards);

  // 座位计算
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
      height:'100%', display:'flex', flexDirection:'column',
      background:'#1a4a2a',
      animation: bombAnim ? 'shake 0.5s ease' : 'none',
      position:'relative', overflow:'hidden',
      fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif",
    }}>

      {/* 炸弹全屏闪红光 */}
      {bombAnim && (
        <div style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(255,0,0,0.3)', animation:'pulse 0.2s infinite' }} />
      )}

      {/* 飘分文字 */}
      <div style={{ position:'fixed', top:'40%', left:'50%', transform:'translateX(-50%)', zIndex:110, pointerEvents:'none' }}>
        {floats.map(f => (
          <div key={f.id} style={{
            fontSize:32, fontWeight:900, color:'#f5c518',
            textShadow:'0 0 10px rgba(0,0,0,0.5)',
            animation:'floatUp 2.5s ease-out forwards'
          }}>{f.text}</div>
        ))}
      </div>

      {/* ========== 顶部得分条 (48px) ========== */}
      <div style={{ height:48, display:'flex', padding:'0 10px', alignItems:'center', background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(255,255,255,0.1)', zIndex:20 }}>
        {players.map((p, i) => {
          const isCurrent = gameState?.currentPlayer === i;
          return (
            <div key={p.id} style={{
              flex:1, display:'flex', alignItems:'center', gap:8, padding:'4px 10px',
              borderRadius:20, margin:'0 4px',
              background: isCurrent ? 'rgba(245,197,24,0.2)' : 'transparent',
              border: `1px solid ${isCurrent ? '#f5c518' : 'transparent'}`,
              boxShadow: isCurrent ? '0 0 15px rgba(245,197,24,0.4)' : 'none',
              transition: 'all 0.3s'
            }}>
              <div style={{ width:24, height:24, borderRadius:'50%', background:AVATAR_COLORS[i], display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>{AVATARS[i]}</div>
              <div style={{ flex:1, overflow:'hidden' }}>
                <div style={{ fontSize:10, color:'#eee', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize:12, fontWeight:900, color:'#f5c518' }}>{p.score} <span style={{fontSize:9}}>pts</span></div>
              </div>
              <div style={{ fontSize:11, color:'#fff', opacity:0.7 }}>🎴{p.cardCount}</div>
            </div>
          );
        })}
      </div>

      {/* ========== 中间三栏布局 ========== */}
      <div style={{ flex:1, display:'flex', position:'relative', zIndex:10 }}>
        
        {/* 左栏 */}
        <div style={{ width:100, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          {leftOpp && <OpponentSide player={leftOpp} idx={players.indexOf(leftOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(leftOpp)} />}
        </div>

        {/* 中间栏 */}
        <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
          
          {/* 上部：上方对手 */}
          <div style={{ height:'40%', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {topOpp && <OpponentTop player={topOpp} idx={players.indexOf(topOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(topOpp)} />}
          </div>

          {/* 下部：出牌中心 */}
          <div style={{ height:'60%', position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {/* 椭圆桌面装饰 */}
            <div style={{
              position:'absolute', width:'80%', height:'80%', borderRadius:'50%',
              border:'2px solid rgba(255,255,255,0.05)', background:'rgba(0,0,0,0.1)',
              boxShadow: isMyTurn ? 'inset 0 0 30px rgba(245,197,24,0.2)' : 'none',
              animation: isMyTurn ? 'myTurnPulse 2s infinite' : 'none'
            }} />

            {lp ? (
              <div style={{ zIndex:5, textAlign:'center' }}>
                <div style={{ marginBottom:8, fontSize:14, fontWeight:900, color:'#f5c518', textShadow:'0 2px 4px rgba(0,0,0,0.5)' }}>
                  {lpPlayer?.name} : {TYPE_LABEL[lp.type] || '出牌'}
                </div>
                <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                  {lpCards.map(c => <MiniCard key={c.id} card={c} />)}
                </div>
              </div>
            ) : (
              <div style={{ color:'rgba(255,255,255,0.2)', fontSize:14 }}>{isMyTurn ? '请出牌' : '等待中...'}</div>
            )}
          </div>
        </div>

        {/* 右栏 */}
        <div style={{ width:100, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          {rightOpp && <OpponentSide player={rightOpp} idx={players.indexOf(rightOpp)} isCurrent={gameState?.currentPlayer === players.indexOf(rightOpp)} />}
        </div>
      </div>

      {/* ========== 底部手牌区 ========== */}
      <div style={{ paddingBottom:10, zIndex:30 }}>
        
        {/* 提示文字 */}
        <div style={{ height:24, textAlign:'center', fontSize:14, color:'#f5c518', fontWeight:900, textShadow:'0 1px 2px rgba(0,0,0,0.8)' }}>
          {selected.size > 0 ? `已选${selected.size}张 · ${selectedType}` : ''}
        </div>

        {/* 手牌展示 */}
        <div style={{ 
          display:'flex', justifyContent:'center', padding:'10px 0 20px', 
          overflowX:'auto', WebkitOverflowScrolling:'touch',
          paddingLeft: 40, paddingRight: 40
        }}>
          <div style={{ display:'flex' }}>
            {sortedHand.map((card, i) => (
              <div key={card.id} style={{ marginLeft: i === 0 ? 0 : -24 }}>
                <Card 
                  card={card} 
                  selected={selected.has(card.id)} 
                  onClick={() => toggleCard(card.id)} 
                />
              </div>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={{ display:'flex', gap:10, padding:'0 20px', alignItems:'center' }}>
          <button onClick={hint} className="btn-gold-outline" style={{ padding:'8px 16px', borderRadius:20, fontSize:14, fontWeight:900 }}>💡提示</button>
          <button onClick={selectAll} className="btn-gold-outline" style={{ padding:'8px 16px', borderRadius:20, fontSize:14, fontWeight:900 }}>全选</button>
          
          <div style={{ flex:1 }} />

          <button 
            disabled={!isMyTurn || isFirst} 
            onClick={pass} 
            className="btn-pass"
            style={{ padding:'10px 24px', borderRadius:20, fontSize:16, fontWeight:900 }}
          >过牌</button>
          
          <button 
            disabled={!isMyTurn || !selected.size} 
            onClick={playCards} 
            className="btn-play"
            style={{ padding:'10px 32px', borderRadius:20, fontSize:18, fontWeight:900 }}
          >出牌{selected.size > 0 ? `(${selected.size})` : ''}</button>
        </div>
      </div>

      <style>{`
        .btn-gold-outline { background:rgba(0,0,0,0.3); border:1px solid #f5c518; color:#f5c518; }
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
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
      <div style={{ 
        width:50, height:50, borderRadius:'50%', background:AVATAR_COLORS[idx],
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:28,
        border: `3px solid ${isCurrent ? '#f5c518' : 'rgba(255,255,255,0.2)'}`,
        boxShadow: isCurrent ? '0 0 20px #f5c518' : 'none'
      }}>{AVATARS[idx]}</div>
      <div style={{ fontSize:12, fontWeight:900, color:'#fff', textAlign:'center', maxWidth:80, overflow:'hidden', textOverflow:'ellipsis' }}>{player.name}</div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
        {[...Array(Math.min(player.cardCount, 5))].map((_, i) => (
          <div key={i} style={{ marginTop: i === 0 ? 0 : -32 }}>
            <Card faceDown tiny />
          </div>
        ))}
        {player.cardCount > 5 && <div style={{ fontSize:10, color:'#f5c518', marginTop:4 }}>+{player.cardCount-5}</div>}
      </div>
    </div>
  );
}

function OpponentTop({ player, idx, isCurrent }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ 
        width:40, height:40, borderRadius:'50%', background:AVATAR_COLORS[idx],
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:24,
        border: `2px solid ${isCurrent ? '#f5c518' : 'rgba(255,255,255,0.2)'}`,
        boxShadow: isCurrent ? '0 0 15px #f5c518' : 'none'
      }}>{AVATARS[idx]}</div>
      <div style={{ display:'flex', flexDirection:'column' }}>
        <div style={{ fontSize:12, fontWeight:900, color:'#fff' }}>{player.name}</div>
        <div style={{ display:'flex' }}>
          {[...Array(Math.min(player.cardCount, 8))].map((_, i) => (
            <div key={i} style={{ marginLeft: i === 0 ? 0 : -22 }}>
              <Card faceDown tiny />
            </div>
          ))}
          {player.cardCount > 8 && <div style={{ fontSize:11, color:'#f5c518', marginLeft:6, alignSelf:'center' }}>+{player.cardCount-8}</div>}
        </div>
      </div>
    </div>
  );
}
