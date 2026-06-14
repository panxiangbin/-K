import React from 'react';

const MEDALS = ['🥇','🥈','🥉','4️⃣'];
const BG = ['linear-gradient(135deg,#78350f,#92400e)','linear-gradient(135deg,#374151,#4b5563)','linear-gradient(135deg,#1c1917,#292524)','linear-gradient(135deg,#1e1b4b,#1e1b4b)'];
const BORDER = ['#f5c842','#9ca3af','#78716c','#6366f1'];

export default function Settlement({ data, send, myInfo, gameState }) {
  if (!data) return null;
  const isHost = gameState?.players?.[0]?.id === myInfo?.playerId;

  return (
    <div style={{
      height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      background:'radial-gradient(ellipse at 50% 30%, #1e1060 0%, #0d1117 60%)',
      padding:'20px 16px', position:'relative', overflow:'hidden',
    }}>
      <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(45deg,#ffffff03 0,#ffffff03 1px,transparent 0,transparent 50%)', backgroundSize:'12px 12px', pointerEvents:'none' }} />

      <div style={{ fontSize:32, marginBottom:4 }}>🏆</div>
      <div style={{ fontSize:24, fontWeight:900, color:'#f5c842', marginBottom:2, textShadow:'0 0 20px #f5c84288' }}>本局结算</div>
      <div style={{ fontSize:12, color:'#555', marginBottom:24 }}>第 {gameState?.roundNum} 局</div>

      <div style={{ width:'100%', maxWidth:360, display:'flex', flexDirection:'column', gap:10, marginBottom:28 }}>
        {data.map((p,i) => {
          const isMe = p.id === myInfo?.playerId;
          const ok = p.score >= p.target;
          return (
            <div key={p.id} style={{
              display:'flex', alignItems:'center', gap:14,
              padding:'14px 16px', borderRadius:14,
              background: BG[i],
              border:`1px solid ${BORDER[i]}`,
              boxShadow: i===0 ? `0 0 20px ${BORDER[i]}44` : 'none',
              animation:`slide-up ${0.15+i*0.1}s ease`,
              position:'relative', overflow:'hidden',
            }}>
              {i===0 && <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,#f5c84208 0%,transparent 60%)', pointerEvents:'none' }} />}
              <div style={{ fontSize:28, flexShrink:0 }}>{MEDALS[i]}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                  {p.name}
                  {isMe && <span style={{ fontSize:10, color:'#a855f7', background:'#a855f722', padding:'1px 6px', borderRadius:8 }}>我</span>}
                </div>
                <div style={{ fontSize:11, color:'#666', marginTop:2 }}>
                  累计 <span style={{ color:'#ddd' }}>{p.totalScore}</span> 分 · 目标 ≥{p.target}分
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:22, fontWeight:900, color: i===0?'#f5c842':'#ddd' }}>+{p.score}</div>
                <div style={{ fontSize:11, color: ok?'#22c55e':'#ef4444', fontWeight:600 }}>
                  {ok ? '✓ 达标' : '✗ 未达标'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isHost ? (
        <button onClick={()=>send({type:'next_round'})} style={{
          padding:'14px 48px', borderRadius:14, fontWeight:800, fontSize:16,
          background:'linear-gradient(135deg,#f5c842,#e8a020)',
          border:'none', color:'#0d1117',
          boxShadow:'0 4px 24px #f5c84266',
          cursor:'pointer', animation:'glow-pulse 2s infinite',
        }}>继续下一局 →</button>
      ) : (
        <div style={{ color:'#555', fontSize:14 }}>等待房主开始下一局...</div>
      )}
    </div>
  );
}
