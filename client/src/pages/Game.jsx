import React, { useState, useCallback, useEffect, useRef } from 'react';
import Card, { MiniCard } from '../components/Card';

const CARD_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'];
const TYPE_LABEL = { single:'单张', pair:'对子', triple:'三张', straight:'顺子', pairs:'连对', bomb:'炸弹' };
const AVATARS = ['🐲','🐯','🦊','🐺'];
const AVATAR_BG = ['#7c3aed','#0891b2','#d97706','#dc2626'];

function sortCards(cards) {
  return [...cards].sort((a,b) => CARD_ORDER.indexOf(a.rank) - CARD_ORDER.indexOf(b.rank));
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

  useEffect(() => {
    if (isMyTurn && navigator.vibrate) navigator.vibrate(120);
  }, [isMyTurn, gameState?.currentPlayer]);

  useEffect(() => {
    if (!gameState) return;
    gameState.players.forEach(p => {
      const prev = prevScores.current[p.id] ?? 0;
      if (p.score > prev) {
        const diff = p.score - prev;
        const id = floatId.current++;
        setFloats(f => [...f, { id, text: '+' + diff + '分', color: '#f5c842' }]);
        setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 2000);
      }
      prevScores.current[p.id] = p.score;
    });
  }, [gameState?.players?.map(p=>p.score).join(',')]);

  const toggleCard = useCallback((id) => {
    setSelected(s => { const n = new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  }, []);

  function playCards() {
    if (!selected.size) return;
    const cardIds = [...selected];
    const cards = myHand.filter(c => cardIds.includes(c.id));
    send({ type: 'play_cards', cardIds });
    setMyHand(h => h.filter(c => !cardIds.includes(c.id)));
    setSelected(new Set());
    // 炸弹检测
    const ranks = new Set(cards.map(c => c.rank));
    if ((ranks.size===1 && cards.length>=4) || (cards.some(c=>c.rank==='大王') && cards.some(c=>c.rank==='小王'))) {
      setBombAnim(true); setTimeout(()=>setBombAnim(false), 700);
    }
  }

  function pass() {
    if (!isMyTurn || isFirst) return;
    send({ type: 'pass' });
    setSelected(new Set());
  }

  function hint() {
    if (myHand.length > 0) setSelected(new Set([myHand[0].id]));
  }

  const players = gameState?.players || [];
  const opponents = players.filter(p => p.id !== myInfo?.playerId);

  // 计算对手显示位置（2或3个）
  const oppLayout = opponents.length === 1
    ? [{ player: opponents[0], pos: 'top' }]
    : opponents.length === 2
    ? [{ player: opponents[0], pos: 'left' }, { player: opponents[1], pos: 'top' }]
    : [{ player: opponents[0], pos: 'left' }, { player: opponents[1], pos: 'top' }, { player: opponents[2], pos: 'right' }];

  const lp = gameState?.lastPlay;
  const lpCards = gameState?.lastPlayCards || [];
  const lpPlayer = players.find(p => p.id === gameState?.lastPlayerId);

  return (
    <div style={{
      height:'100%', display:'flex', flexDirection:'column',
      background:'radial-gradient(ellipse at 50% 40%, #1a3a2a 0%, #0f2018 50%, #0a0f0d 100%)',
      animation: bombAnim ? 'shake 0.4s ease' : 'none',
      position:'relative', overflow:'hidden',
    }}>

      {/* 桌面纹理 */}
      <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(45deg,#ffffff04 0,#ffffff04 1px,transparent 0,transparent 50%)', backgroundSize:'10px 10px', pointerEvents:'none' }} />

      {/* 炸弹特效 */}
      {bombAnim && (
        <div style={{ position:'fixed', inset:0, zIndex:50, pointerEvents:'none', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:80, animation:'bomb-flash 0.7s ease-out forwards' }}>💥</div>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle, #ff6b3588 0%, transparent 60%)', animation:'bomb-flash 0.7s ease-out forwards' }} />
        </div>
      )}

      {/* 飘分 */}
      <div style={{ position:'fixed', top:'30%', left:'50%', transform:'translateX(-50%)', zIndex:40, pointerEvents:'none', textAlign:'center' }}>
        {floats.map(f => (
          <div key={f.id} style={{ fontSize:26, fontWeight:900, color:f.color, textShadow:`0 0 12px ${f.color}`, animation:'float-up 2s ease-out forwards' }}>{f.text}</div>
        ))}
      </div>

      {/* 得分条 */}
      <div style={{ display:'flex', gap:5, padding:'8px 10px 0', position:'relative', zIndex:2, flexShrink:0 }}>
        {players.map((p,i) => {
          const isMe = p.id === myInfo?.playerId;
          const isCurrent = gameState?.currentPlayer === i;
          return (
            <div key={p.id} style={{
              flex:1, padding:'6px 8px', borderRadius:10,
              background: isCurrent ? '#f5c84222' : '#00000033',
              border:`1px solid ${isCurrent ? '#f5c842' : '#ffffff11'}`,
              boxShadow: isCurrent ? '0 0 12px #f5c84244' : 'none',
              transition:'all 0.3s', backdropFilter:'blur(6px)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                <span style={{ fontSize:12 }}>{AVATARS[i]}</span>
                <span style={{ fontSize:10, color: isMe?'#a855f7':'#888', fontWeight:isMe?700:400, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', maxWidth:48 }}>
                  {isMe ? '我' : p.name}
                </span>
                {isCurrent && <span style={{ fontSize:9, color:'#f5c842', marginLeft:'auto', animation:'pulse 1s infinite' }}>▶</span>}
              </div>
              <div style={{ fontSize:15, fontWeight:800, color:'#f5c842' }}>{p.score}<span style={{ fontSize:9, color:'#666', fontWeight:400 }}> 分</span></div>
              <div style={{ fontSize:9, color:'#555' }}>{p.cardCount}张</div>
            </div>
          );
        })}
      </div>

      {/* 对手区域 */}
      <div style={{ display:'flex', justifyContent:'space-around', padding:'8px 10px', flexShrink:0, position:'relative', zIndex:2 }}>
        {oppLayout.map(({ player: opp }, oi) => {
          const oppIdx = players.findIndex(p => p.id === opp.id);
          const isCurrent = gameState?.currentPlayer === oppIdx;
          return (
            <div key={opp.id} style={{ textAlign:'center', flex:1, maxWidth:140 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, marginBottom:4 }}>
                <div style={{
                  width:28, height:28, borderRadius:'50%',
                  background: AVATAR_BG[players.findIndex(p=>p.id===opp.id)],
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
                  border: isCurrent?'2px solid #f5c842':'2px solid transparent',
                  boxShadow: isCurrent?'0 0 10px #f5c84266':'none',
                  transition:'all 0.3s',
                }}>{AVATARS[players.findIndex(p=>p.id===opp.id)]}</div>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color: isCurrent?'#f5c842':'#888' }}>{opp.name}</div>
                  <div style={{ fontSize:10, color:'#555' }}>{opp.cardCount}张</div>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'center', flexWrap:'wrap', gap:2 }}>
                {[...Array(Math.min(opp.cardCount, 8))].map((_,i)=>(
                  <Card key={i} card={null} faceDown tiny />
                ))}
                {opp.cardCount > 8 && <span style={{ fontSize:9, color:'#555', alignSelf:'center' }}>+{opp.cardCount-8}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* 中间桌面 */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', zIndex:2 }}>

        {/* 当前轮到我时的边框光 */}
        {isMyTurn && <div style={{ position:'absolute', inset:0, border:'2px solid #f5c84266', boxShadow:'inset 0 0 40px #f5c84211', pointerEvents:'none', animation:'glow-pulse 2s infinite' }} />}

        {lp ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:11, color:'#666', marginBottom:6 }}>
              {lpPlayer?.name} 出了
              <span style={{ color: lp.type==='bomb'?'#ef4444':'#a855f7', fontWeight:700, marginLeft:4 }}>
                {lp.isBiggest ? '👑双王炸弹' : (TYPE_LABEL[lp.type] || '') + (lp.len ? ` ×${lp.len}` : '')}
              </span>
            </div>
            <div style={{
              display:'flex', gap:4, justifyContent:'center', flexWrap:'wrap',
              padding:'10px 14px', borderRadius:14,
              background: lp.type==='bomb' ? '#ff000015' : '#ffffff08',
              border: lp.type==='bomb' ? '1px solid #ef444444' : '1px solid #ffffff11',
              boxShadow: lp.type==='bomb' ? '0 0 30px #ef444433' : 'none',
              maxWidth:280,
            }}>
              {lpCards.length > 0
                ? lpCards.map((card,i)=><MiniCard key={card.id||i} card={card} />)
                : <div style={{ color:'#888', fontSize:13 }}>
                    {lp.isBiggest ? '👑 双王' : lp.rank + ' · ' + TYPE_LABEL[lp.type]}
                  </div>
              }
            </div>
          </div>
        ) : (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:40, opacity:0.08, marginBottom:8 }}>🃏</div>
            <div style={{ fontSize:13, color: isMyTurn ? '#f5c842' : '#555' }}>
              {isMyTurn ? '✨ 你先手，出任意牌型' : '等待出牌...'}
            </div>
          </div>
        )}

        {isMyTurn && (
          <div style={{
            marginTop:12, padding:'5px 18px', borderRadius:20,
            background:'#f5c84222', border:'1px solid #f5c842',
            color:'#f5c842', fontSize:12, fontWeight:700,
            animation:'glow-pulse 1.5s infinite',
          }}>轮到你了</div>
        )}
      </div>

      {/* 手牌区 */}
      <div style={{ flexShrink:0, position:'relative', zIndex:2 }}>
        <div style={{ overflowX:'auto', padding:'0 8px 4px', WebkitOverflowScrolling:'touch' }}>
          <div style={{ display:'flex', gap:3, paddingTop:18, paddingBottom:4, minWidth:'max-content', alignItems:'flex-end' }}>
            {myHand.map(card => (
              <Card
                key={card.id}
                card={card}
                selected={selected.has(card.id)}
                onClick={() => toggleCard(card.id)}
              />
            ))}
            {myHand.length === 0 && (
              <div style={{ padding:'20px 40px', color:'#555', fontSize:14 }}>手牌已出完</div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={{ display:'flex', gap:8, padding:'6px 12px 12px' }}>
          <button onClick={hint} style={{
            flex:1, padding:'11px 0', borderRadius:12,
            background:'#ffffff0a', border:'1px solid #ffffff15', color:'#666', fontSize:14,
          }}>💡 提示</button>

          <button onClick={pass} disabled={!isMyTurn || isFirst} style={{
            flex:1.4, padding:'11px 0', borderRadius:12, fontSize:14, fontWeight:600,
            background: isMyTurn && !isFirst ? '#ffffff11' : '#ffffff06',
            border: `1px solid ${isMyTurn && !isFirst ? '#ffffff22' : '#ffffff0a'}`,
            color: isMyTurn && !isFirst ? '#ddd' : '#444',
            cursor: isMyTurn && !isFirst ? 'pointer' : 'default',
            transition:'all 0.2s',
          }}>⏭️ 过牌</button>

          <button onClick={playCards} disabled={!isMyTurn || !selected.size} style={{
            flex:2, padding:'11px 0', borderRadius:12, fontWeight:800, fontSize:16,
            background: isMyTurn && selected.size
              ? 'linear-gradient(135deg, #f5c842, #e8a020)'
              : '#ffffff08',
            border:'none',
            color: isMyTurn && selected.size ? '#0d1117' : '#333',
            boxShadow: isMyTurn && selected.size ? '0 4px 20px #f5c84266' : 'none',
            cursor: isMyTurn && selected.size ? 'pointer' : 'default',
            transition:'all 0.2s',
          }}>
            出牌{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
