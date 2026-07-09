import React from 'react';

const MEDALS = ['🥇','🥈','🥉','4️⃣'];
const RANK_BG = [
  'linear-gradient(135deg,#78350f,#92400e)',
  'linear-gradient(135deg,#1f2937,#374151)',
  'linear-gradient(135deg,#1c1917,#292524)',
  'linear-gradient(135deg,#1e1b4b,#312e81)',
];
const RANK_BORDER = ['#f5c842','#9ca3af','#78716c','#6366f1'];
const AVATARS = ['🐲','🐯','🦊','🐺'];
const AVATAR_COLORS = ['#9333ea','#0891b2','#d97706','#dc2626'];
const RANK_NAMES = ['第一名', '第二名', '第三名', '第四名'];

export default function Settlement({ data, send, myInfo, gameState }) {
  if (!data) return null;
  const isHost = gameState?.players?.[0]?.id === myInfo?.playerId;
  const history = gameState?.roundHistory || [];
  const recentHistory = history.slice(-5).reverse();

  const leader = data[0];
  const leaderOk = leader ? (leader.qualified ?? leader.score >= leader.target) : false;

  return (
    <div style={{
      height:'100%', display:'flex',
      background:'radial-gradient(ellipse at 50% 30%, #1e1060 0%, #0d1117 60%)',
      position:'relative', overflow:'hidden',
      fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif",
    }}>
      <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(45deg,#ffffff03 0,#ffffff03 1px,transparent 0,transparent 50%)', backgroundSize:'12px 12px', pointerEvents:'none' }}/>

      <div style={{
        width:'34%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        borderRight:'1px solid #ffffff0a', padding:'16px',
        background: leaderOk ? 'radial-gradient(ellipse at 50% 50%, #f5c84208 0%, transparent 70%)' : 'radial-gradient(ellipse at 50% 50%, #ef444408 0%, transparent 70%)',
      }}>
        <div style={{ fontSize:56, marginBottom:8, filter:`drop-shadow(0 0 20px ${leaderOk ? '#f5c84266' : '#ef444466'})` }}>
          {leaderOk ? '🏆' : '⚠️'}
        </div>
        <div style={{ fontSize:25, fontWeight:900, color:leaderOk ? '#f5c842' : '#f87171', textShadow:`0 0 20px ${leaderOk ? '#f5c84288' : '#ef444488'}`, marginBottom:4 }}>
          {leader?.name}
        </div>
        <div style={{ fontSize:13, color:'#aaa', marginBottom:14 }}>
          头游 · {leaderOk ? '达标算赢' : '未达标判负'}
        </div>
        <div style={{
          fontSize:48, fontWeight:900,
          background: leaderOk ? 'linear-gradient(135deg,#f5c842,#fbbf24)' : 'linear-gradient(135deg,#f87171,#ef4444)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
        }}>+{leader?.score}</div>
        <div style={{ fontSize:13, color:'#666', marginTop:2 }}>
          目标 ≥{leader?.target} 分
        </div>

        <div style={{ marginTop:18, padding:'8px 18px', borderRadius:20, background: leaderOk ? '#f5c84215' : '#ef444415', border:`1px solid ${leaderOk ? '#f5c84233' : '#ef444433'}`, fontSize:12, color:leaderOk ? '#f5c842' : '#f87171' }}>
          第 {gameState?.roundNum || 1} 局结算
        </div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'12px 18px', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2 }}>
          <div style={{ fontSize:14, color:'#ddd', fontWeight:900 }}>本局计分情况</div>
          <div style={{ fontSize:12, color:'#888' }}>
            达标线：{gameState?.players?.length === 3 ? '30 / 70 / 100' : '20 / 40 / 60 / 80'} 分
          </div>
        </div>

        {data.map((p,i)=>{
          const isMe = p.id === myInfo?.playerId;
          const playerIdx = gameState?.players?.findIndex(pl=>pl.id===p.id) ?? i;
          const ok = p.qualified ?? p.score >= p.target;
          return (
            <div key={p.id} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'9px 12px', borderRadius:12,
              background: RANK_BG[i],
              border:`1px solid ${ok ? RANK_BORDER[i] : '#ef4444'}`,
              boxShadow: i===0 ? `0 0 16px ${(ok ? RANK_BORDER[i] : '#ef4444')}33` : 'none',
              animation:`slide-up ${0.1+i*0.08}s ease`,
              position:'relative',
            }}>
              <div style={{ fontSize:20, flexShrink:0 }}>{MEDALS[i]}</div>
              <div style={{
                width:30, height:30, borderRadius:'50%', flexShrink:0,
                background: AVATAR_COLORS[playerIdx],
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:15,
              }}>{AVATARS[playerIdx]}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:800, display:'flex', alignItems:'center', gap:5 }}>
                  {RANK_NAMES[i] || `第${i+1}名`} · {p.name}
                  {isMe && <span style={{ fontSize:9, color:'#c084fc', background:'#9333ea22', padding:'1px 5px', borderRadius:6 }}>我</span>}
                </div>
                <div style={{ fontSize:10, color:'#999', marginTop:1 }}>
                  本局 <span style={{color:'#ddd'}}>{p.score}</span> 分 · 累计 <span style={{color:'#ddd'}}>{p.totalScore}</span> 分 · 目标 ≥{p.target}分
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:19, fontWeight:900, color: ok ? (i===0?'#f5c842':'#ddd') : '#f87171' }}>+{p.score}</div>
                <div style={{ fontSize:10, fontWeight:800, color: ok?'#4ade80':'#f87171' }}>
                  {ok ? '✓达标·赢' : '✗未达标·输'}
                </div>
              </div>
            </div>
          );
        })}

        <div style={{
          marginTop:4,
          border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:12,
          background:'rgba(0,0,0,0.22)',
          padding:'8px 10px',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
            <div style={{ fontSize:12, fontWeight:900, color:'#ddd' }}>历史记录</div>
            <div style={{ fontSize:10, color:'#666' }}>最近 {recentHistory.length} 局</div>
          </div>
          {recentHistory.length ? recentHistory.map((round) => (
            <div key={round.roundNum} style={{ display:'flex', gap:6, alignItems:'center', fontSize:10, color:'#aaa', padding:'2px 0', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color:'#f5c842', fontWeight:900, width:34 }}>第{round.roundNum}局</span>
              <span style={{ flex:1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                {round.result.map(r => `${r.rank}.${r.name}${r.score}分${r.qualified ? '赢' : '输'}`).join(' ｜ ')}
              </span>
            </div>
          )) : (
            <div style={{ fontSize:10, color:'#666' }}>暂无历史记录</div>
          )}
        </div>

        <div style={{ marginTop:4 }}>
          {isHost ? (
            <button onClick={()=>send({type:'next_round'})} style={{
              width:'100%', padding:'11px 0', borderRadius:12, fontWeight:900, fontSize:15,
              background:'linear-gradient(135deg,#f5c842,#e8a020)',
              border:'none', color:'#0d1117',
              boxShadow:'0 4px 20px #f5c84244',
              animation:'glow-pulse 2s infinite',
            }}>继续下一局 →</button>
          ) : (
            <div style={{ textAlign:'center', color:'#555', fontSize:13, padding:'8px 0' }}>等待房主开始下一局...</div>
          )}
        </div>
      </div>
    </div>
  );
}
