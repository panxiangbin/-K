import React, { useState, useCallback, useEffect, useRef } from 'react';
import Card, { MiniCard } from '../components/Card';

const CARD_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'];
const TYPE_LABEL = { single:'单张', pair:'对子', triple:'三张', straight:'顺子', pairs:'连对', bomb:'💥炸弹' };
const AVATARS = ['🐲','🐯','🦊','🐺'];
const AVATAR_COLORS = ['#9333ea','#0891b2','#d97706','#dc2626'];
const SCORE_RANKS = ['5','10','K'];

function sortCards(cards) {
  return [...cards].sort((a,b) => CARD_ORDER.indexOf(a.rank) - CARD_ORDER.indexOf(b.rank));
}

// 简单提示：选择第一张能打出的牌
function getHint(hand, lastPlay) {
  if (!lastPlay) return hand.length > 0 ? [hand[0].id] : [];
  // 找单张里比lastPlay大的
  if (lastPlay.type === 'single') {
    const bigger = hand.filter(c => CARD_ORDER.indexOf(c.rank) > CARD_ORDER.indexOf(lastPlay.rank));
    if (bigger.length) return [bigger[0].id];
  }
  // 找炸弹
  const rankGroups = {};
  hand.forEach(c => { rankGroups[c.rank] = rankGroups[c.rank] || []; rankGroups[c.rank].push(c.id); });
  for (const [rank, ids] of Object.entries(rankGroups)) {
    if (ids.length >= 4 && lastPlay.type !== 'bomb') return ids.slice(0,4);
  }
  return [];
}

// 检测当前选中牌的牌型名称（供显示）
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
    if (isMyTurn && navigator.vibrate) navigator.vibrate([80, 40, 80]);
  }, [isMyTurn, gameState?.currentPlayer]);

  useEffect(() => {
    if (!gameState) return;
    gameState.players.forEach(p => {
      const prev = prevScores.current[p.id] ?? 0;
      if (p.score > prev) {
        const diff = p.score - prev;
        const id = floatId.current++;
        setFloats(f => [...f, { id, text: '+' + diff + '分' }]);
        setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 2200);
      }
      prevScores.current[p.id] = p.score;
    });
  }, [gameState?.players?.map(p=>p.score).join(',')]);

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
      setBombAnim(true); setTimeout(()=>setBombAnim(false), 800);
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
  const me = players[myIdx];
  const opponents = players.filter((_, i) => i !== myIdx);

  const lp = gameState?.lastPlay;
  const lpCards = gameState?.lastPlayCards || [];
  const lpPlayer = players.find(p => p.id === gameState?.lastPlayerId);

  const selectedCards = myHand.filter(c => selected.has(c.id));
  const selectedType = detectSelectedType(selectedCards);

  // 横屏布局：左对手 | 中间区 | 右对手
  const leftOpp = opponents[0] || null;
  const topOpp = opponents[1] || null;
  const rightOpp = opponents[2] || null;

  return (
    <div style={{
      height:'100%', display:'flex', flexDirection:'column',
      background:'radial-gradient(ellipse at 50% 30%, #1b4332 0%, #0f2d1e 40%, #0a1a12 100%)',
      animation: bombAnim ? 'shake 0.5s ease' : 'none',
      position:'relative', overflow:'hidden',
      fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif",
    }}>

      {/* 桌布纹理 */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none', opacity:.4,
        backgroundImage:'radial-gradient(circle at 50% 50%, #2d6a4f22 0%, transparent 60%), repeating-linear-gradient(0deg,transparent,transparent 39px,#00000010 39px,#00000010 40px), repeating-linear-gradient(90deg,transparent,transparent 39px,#00000010 39px,#00000010 40px)',
      }}/>

      {/* 炸弹特效 */}
      {bombAnim && (
        <div style={{ position:'fixed',inset:0,zIndex:100,pointerEvents:'none',display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div style={{ fontSize:100, animation:'bomb-flash 0.8s ease-out forwards', filter:'drop-shadow(0 0 40px #ff6b00)' }}>💥</div>
          <div style={{ position:'absolute',inset:0, background:'radial-gradient(circle, #ff6b0044 0%, transparent 70%)', animation:'bomb-flash 0.8s ease-out forwards' }}/>
        </div>
      )}

      {/* 飘分 */}
      <div style={{ position:'fixed',top:'35%',left:'50%',transform:'translateX(-50%)',zIndex:90,pointerEvents:'none',textAlign:'center' }}>
        {floats.map(f=>(
          <div key={f.id} style={{ fontSize:28,fontWeight:900,color:'#f5c842',textShadow:'0 0 20px #f5c84299',animation:'float-up 2.2s ease-out forwards',whiteSpace:'nowrap' }}>{f.text}</div>
        ))}
      </div>

      {/* ========== 顶部得分条 ========== */}
      <div style={{ display:'flex', gap:4, padding:'5px 8px', flexShrink:0, zIndex:10, borderBottom:'1px solid #ffffff0a' }}>
        {players.map((p,i)=>{
          const isMe = p.id === myInfo?.playerId;
          const isCurrent = gameState?.currentPlayer === i;
          return (
            <div key={p.id} style={{
              flex:1, display:'flex', alignItems:'center', gap:5, padding:'4px 8px',
              borderRadius:8, transition:'all .25s',
              background: isCurrent ? '#f5c84218' : isMe ? '#9333ea15' : '#00000030',
              border:`1px solid ${isCurrent ? '#f5c842' : isMe ? '#9333ea44' : '#ffffff0a'}`,
              boxShadow: isCurrent ? '0 0 10px #f5c84233' : 'none',
            }}>
              <div style={{
                width:24, height:24, borderRadius:'50%', flexShrink:0,
                background:AVATAR_COLORS[i], display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:13, border: isCurrent?'2px solid #f5c842':'2px solid transparent',
              }}>{AVATARS[i]}</div>
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontSize:10, fontWeight:isMe?700:400, color:isMe?'#c084fc':'#aaa', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                  {isMe?'我':p.name} {isCurrent&&<span style={{color:'#f5c842'}}>◀</span>}
                </div>
                <div style={{ fontSize:13, fontWeight:800, color:'#f5c842', lineHeight:1 }}>{p.score}<span style={{fontSize:9,color:'#666',fontWeight:400}}>分</span></div>
              </div>
              <div style={{ fontSize:10, color:'#555', flexShrink:0 }}>{p.cardCount}张</div>
            </div>
          );
        })}
      </div>

      {/* ========== 中间主区域：横屏三栏 ========== */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative', zIndex:2 }}>

        {/* 左侧对手 */}
        <div style={{ width:90, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'6px 4px', borderRight:'1px solid #ffffff08', flexShrink:0 }}>
          {leftOpp ? <OpponentPanel player={leftOpp} idx={players.indexOf(leftOpp)} gameState={gameState} myInfo={myInfo} vertical /> : <div style={{color:'#333',fontSize:11,textAlign:'center'}}>空位</div>}
        </div>

        {/* 中间：上方对手 + 牌桌 */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* 上方对手 */}
          <div style={{ display:'flex', justifyContent:'center', padding:'6px 8px', borderBottom:'1px solid #ffffff08', flexShrink:0 }}>
            {topOpp
              ? <OpponentPanel player={topOpp} idx={players.indexOf(topOpp)} gameState={gameState} myInfo={myInfo} />
              : <div style={{color:'#333',fontSize:11}}>空位</div>
            }
          </div>

          {/* 牌桌中心：出牌区 */}
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
            {/* 桌面圆形装饰 */}
            <div style={{ position:'absolute', width:160, height:100, borderRadius:'50%', background:'#00000018', border:'1px solid #ffffff08', pointerEvents:'none' }}/>

            {lp ? (
              <div style={{ textAlign:'center', zIndex:2 }}>
                <div style={{ fontSize:11, color:'#888', marginBottom:5 }}>
                  <span style={{ color:AVATAR_COLORS[players.indexOf(lpPlayer)] }}>{lpPlayer?.name}</span>
                  &nbsp;出了&nbsp;
                  <span style={{ color: lp.type==='bomb'?'#f87171':'#c084fc', fontWeight:700 }}>
                    {lp.isBiggest ? '👑双王炸' : (TYPE_LABEL[lp.type]||'')}
                  </span>
                </div>
                <div style={{
                  display:'flex', gap:3, justifyContent:'center', flexWrap:'wrap', maxWidth:260,
                  padding:'8px 12px', borderRadius:12,
                  background: lp.type==='bomb' ? '#ff000012' : '#ffffff08',
                  border: lp.type==='bomb' ? '1px solid #f8717144' : '1px solid #ffffff10',
                  boxShadow: lp.type==='bomb' ? '0 0 24px #f8717122' : 'none',
                }}>
                  {lpCards.map((c,i)=><MiniCard key={c.id||i} card={c}/>)}
                </div>
              </div>
            ) : (
              <div style={{ textAlign:'center', zIndex:2 }}>
                <div style={{ fontSize:36, opacity:.1, marginBottom:4 }}>🃏</div>
                <div style={{ fontSize:12, color: isMyTurn?'#f5c842':'#444' }}>
                  {isMyTurn ? '✨ 先手，随意出牌' : '等待出牌...'}
                </div>
              </div>
            )}

            {isMyTurn && (
              <div style={{
                position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)',
                padding:'3px 14px', borderRadius:20, fontSize:11, fontWeight:700,
                background:'#f5c84222', border:'1px solid #f5c84266', color:'#f5c842',
                animation:'glow-pulse 1.5s infinite', whiteSpace:'nowrap',
              }}>轮到你了</div>
            )}
          </div>
        </div>

        {/* 右侧对手 */}
        <div style={{ width:90, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'6px 4px', borderLeft:'1px solid #ffffff08', flexShrink:0 }}>
          {rightOpp ? <OpponentPanel player={rightOpp} idx={players.indexOf(rightOpp)} gameState={gameState} myInfo={myInfo} vertical /> : <div style={{color:'#333',fontSize:11,textAlign:'center'}}>空位</div>}
        </div>
      </div>

      {/* ========== 底部：我的手牌 + 操作 ========== */}
      <div style={{ flexShrink:0, background:'#00000040', borderTop:'1px solid #ffffff0d', zIndex:10 }}>

        {/* 牌型提示 */}
        {selected.size > 0 && (
          <div style={{ textAlign:'center', padding:'2px 0', fontSize:11, color:'#c084fc', fontWeight:600 }}>
            已选 {selected.size} 张 · {selectedType}
          </div>
        )}

        {/* 手牌（叠放显示，更紧凑） */}
        <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', padding:'0 8px' }}>
          <div style={{ display:'flex', paddingTop:14, paddingBottom:4, alignItems:'flex-end', width:'max-content' }}>
            {sortedHand.map((card, i) => (
              <div key={card.id} style={{ marginLeft: i===0 ? 0 : -22 }}>
                <Card
                  card={card}
                  selected={selected.has(card.id)}
                  onClick={() => toggleCard(card.id)}
                />
              </div>
            ))}
            {sortedHand.length === 0 && (
              <div style={{ padding:'16px 40px', color:'#555', fontSize:13 }}>手牌已出完 🎉</div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={{ display:'flex', gap:6, padding:'4px 10px 10px', alignItems:'center' }}>
          <button onClick={hint} style={{
            padding:'9px 12px', borderRadius:10, fontSize:12, fontWeight:600,
            background:'#ffffff0a', border:'1px solid #ffffff15', color:'#aaa',
            flexShrink:0,
          }}>💡提示</button>

          <button onClick={selectAll} style={{
            padding:'9px 10px', borderRadius:10, fontSize:12, fontWeight:600,
            background:'#ffffff0a', border:'1px solid #ffffff15', color:'#aaa',
            flexShrink:0,
          }}>全选</button>

          <div style={{ flex:1 }}/>

          <button onClick={pass} disabled={!isMyTurn || isFirst} style={{
            padding:'10px 20px', borderRadius:10, fontSize:14, fontWeight:700,
            background: isMyTurn && !isFirst ? '#ffffff15' : '#ffffff06',
            border:`1px solid ${isMyTurn&&!isFirst?'#ffffff25':'#ffffff0a'}`,
            color: isMyTurn && !isFirst ? '#ddd' : '#444',
            flexShrink:0, transition:'all .2s',
          }}>过牌</button>

          <button onClick={playCards} disabled={!isMyTurn || !selected.size} style={{
            padding:'10px 24px', borderRadius:10, fontSize:15, fontWeight:900,
            background: isMyTurn && selected.size ? 'linear-gradient(135deg,#f5c842,#e8a020)' : '#ffffff08',
            border:'none',
            color: isMyTurn && selected.size ? '#0d1117' : '#333',
            boxShadow: isMyTurn && selected.size ? '0 4px 18px #f5c84255' : 'none',
            flexShrink:0, transition:'all .2s',
            transform: isMyTurn && selected.size ? 'scale(1.04)' : 'scale(1)',
          }}>
            出牌{selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// 对手展示组件（支持横/竖两种方向）
function OpponentPanel({ player, idx, gameState, myInfo, vertical }) {
  const isCurrent = gameState?.currentPlayer === idx;
  const cardCount = player.cardCount || 0;
  const showCount = vertical ? Math.min(cardCount, 6) : Math.min(cardCount, 10);

  return (
    <div style={{ display:'flex', flexDirection: vertical ? 'column' : 'row', alignItems:'center', gap:6 }}>
      {/* 头像 + 名字 */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flexShrink:0 }}>
        <div style={{
          width: vertical?36:30, height: vertical?36:30, borderRadius:'50%',
          background: AVATAR_COLORS[idx],
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize: vertical?18:15,
          border:`2px solid ${isCurrent?'#f5c842':'transparent'}`,
          boxShadow: isCurrent?'0 0 12px #f5c84266':'none',
          transition:'all .3s',
        }}>{AVATARS[idx]}</div>
        <div style={{ fontSize:10, color: isCurrent?'#f5c842':'#888', fontWeight:isCurrent?700:400, textAlign:'center', maxWidth:70, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
          {player.name}
        </div>
        <div style={{ fontSize:10, color:'#555' }}>{cardCount}张</div>
      </div>

      {/* 背面牌 */}
      <div style={{ display:'flex', flexDirection: vertical?'column':'row', alignItems:'center' }}>
        {[...Array(showCount)].map((_,i)=>(
          <div key={i} style={{ marginTop: vertical&&i>0?-18:0, marginLeft: !vertical&&i>0?-16:0 }}>
            <Card faceDown tiny card={null}/>
          </div>
        ))}
        {cardCount > showCount && (
          <span style={{ fontSize:9, color:'#555', marginLeft:4 }}>+{cardCount-showCount}</span>
        )}
      </div>

      {isCurrent && (
        <div style={{ fontSize:9, color:'#f5c842', animation:'pulse 1s infinite', textAlign:'center' }}>thinking...</div>
      )}
    </div>
  );
}
