import React from 'react';
import './Settlement.css';

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

function TopButton({ children, danger = false, left, onClick }) {
  return (
    <button onClick={onClick} style={{
      position:'absolute', top:10, left, zIndex:60,
      minHeight:34, padding:'0 13px', borderRadius:999,
      border:`1px solid ${danger ? 'rgba(248,113,113,.45)' : 'rgba(255,255,255,.20)'}`,
      background: danger ? 'rgba(127,29,29,.34)' : 'rgba(255,255,255,.08)',
      color: danger ? '#fecaca' : '#f8fafc',
      fontSize:13, fontWeight:900,
      boxShadow:'0 4px 12px rgba(0,0,0,.24)', backdropFilter:'blur(10px)',
    }}>{children}</button>
  );
}

export default function Settlement({ data, send, myInfo, gameState, onReturnLobby, onExitRoom }) {
  if (!data) return null;
  const isHost = gameState?.players?.[0]?.id === myInfo?.playerId;
  const history = gameState?.roundHistory || [];
  const recentHistory = history.slice(-5).reverse();

  const leader = data[0];
  const leaderOk = leader ? (leader.qualified ?? leader.score >= leader.target) : false;

  return (
    <div className="settlement-page" style={{
      height:'100%', display:'flex',
      background:'radial-gradient(ellipse at 50% 30%, #1e1060 0%, #0d1117 60%)',
      position:'relative', overflow:'hidden',
      fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif",
    }}>
      <TopButton left={10} onClick={onReturnLobby}>← 返回大厅</TopButton>
      <TopButton left={104} danger onClick={onExitRoom}>退出房间</TopButton>
      <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(45deg,#ffffff03 0,#ffffff03 1px,transparent 0,transparent 50%)', backgroundSize:'12px 12px', pointerEvents:'none' }}/>

      <div className="settlement-hero" style={{
        width:'34%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        borderRight:'1px solid #ffffff0a', padding:'16px',
        background: leaderOk ? 'radial-gradient(ellipse at 50% 50%, #f5c84208 0%, transparent 70%)' : 'radial-gradient(ellipse at 50% 50%, #ef444408 0%, transparent 70%)',
      }}>
        <div className="settlement-hero-icon" style={{ fontSize:56, marginBottom:8, filter:`drop-shadow(0 0 20px ${leaderOk ? '#f5c84266' : '#ef444466'})` }}>
          {leaderOk ? '🏆' : '⚠️'}
        </div>
        <div className="settlement-leader-name" style={{ fontSize:25, fontWeight:900, color:leaderOk ? '#f5c842' : '#f87171', textShadow:`0 0 20px ${leaderOk ? '#f5c84288' : '#ef444488'}`, marginBottom:4 }}>
          {leader?.name}
        </div>
        <div className="settlement-leader-meta" style={{ fontSize:13, color:'#aaa', marginBottom:14 }}>
          头游 · {leaderOk ? '达标算赢' : '未达标判负'}
        </div>
        <div className="settlement-leader-score" style={{
          fontSize:48, fontWeight:900,
          background: leaderOk ? 'linear-gradient(135deg,#f5c842,#fbbf24)' : 'linear-gradient(135deg,#f87171,#ef4444)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
        }}>+{leader?.score}</div>
        <div style={{ fontSize:13, color:'#8b93a7', marginTop:2 }}>
          目标 ≥{leader?.target} 分
        </div>

        <div className="settlement-round-badge" style={{ marginTop:18, padding:'8px 18px', borderRadius:20, background: leaderOk ? '#f5c84215' : '#ef444415', border:`1px solid ${leaderOk ? '#f5c84233' : '#ef444433'}`, fontSize:12, color:leaderOk ? '#f5c842' : '#f87171' }}>
          第 {gameState?.roundNum || 1} 局结算
        </div>
      </div>

      <div className="settlement-content" style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'12px 18px', gap:8 }}>
        <div className="settlement-section-heading" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2 }}>
          <div style={{ fontSize:14, color:'#f8fafc', fontWeight:900 }}>本局计分情况</div>
          <div style={{ fontSize:12, color:'#a1a8b5' }}>
            达标线：{gameState?.players?.length === 3 ? '30 / 70 / 100' : '20 / 40 / 60 / 80'} 分
          </div>
        </div>

        {data.map((p,i)=>{
          const isMe = p.id === myInfo?.playerId;
          const playerIdx = gameState?.players?.findIndex(pl=>pl.id===p.id) ?? i;
          const ok = p.qualified ?? p.score >= p.target;
          return (
            <div className="settlement-score-card" key={p.id} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'9px 12px', borderRadius:12,
              background: RANK_BG[i],
              border:`1px solid ${ok ? RANK_BORDER[i] : '#ef4444'}`,
              boxShadow: i===0 ? `0 0 16px ${(ok ? RANK_BORDER[i] : '#ef4444')}33` : '0 5px 14px rgba(0,0,0,.16)',
              animation:`slide-up ${0.1+i*0.08}s ease`,
              position:'relative',
            }}>
              <div style={{ fontSize:20, flexShrink:0 }}>{MEDALS[i]}</div>
              <div style={{
                width:30, height:30, borderRadius:'50%', flexShrink:0,
                background: AVATAR_COLORS[playerIdx],
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:15,
                boxShadow:'inset 0 1px 0 rgba(255,255,255,.22), 0 3px 8px rgba(0,0,0,.25)',
              }}>{AVATARS[playerIdx]}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:800, display:'flex', alignItems:'center', gap:5, color:'#f8fafc' }}>
                  {RANK_NAMES[i] || `第${i+1}名`} · {p.name}
                  {isMe && <span style={{ fontSize:9, color:'#e9d5ff', background:'#9333ea55', border:'1px solid #c084fc55', padding:'1px 5px', borderRadius:6 }}>我</span>}
                </div>
                <div className="settlement-score-detail" style={{ fontSize:10, color:'#b2b8c5', marginTop:1 }}>
                  本局 <span style={{color:'#fff'}}>{p.score}</span> 分 · 累计 <span style={{color:'#fff'}}>{p.totalScore}</span> 分 · 目标 ≥{p.target}分
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:19, fontWeight:900, color: ok ? (i===0?'#f5c842':'#f8fafc') : '#f87171' }}>+{p.score}</div>
                <div style={{ fontSize:10, fontWeight:800, color: ok?'#4ade80':'#f87171' }}>
                  {ok ? '✓ 达标·赢' : '✗ 未达标·输'}
                </div>
              </div>
            </div>
          );
        })}

        <div className="settlement-history" style={{
          marginTop:4,
          border:'1px solid rgba(255,255,255,0.10)',
          borderRadius:12,
          background:'rgba(0,0,0,0.28)',
          padding:'8px 10px',
          boxShadow:'inset 0 1px 0 rgba(255,255,255,.03)',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
            <div style={{ fontSize:12, fontWeight:900, color:'#f1f5f9' }}>历史记录</div>
            <div style={{ fontSize:10, color:'#8b93a7' }}>最近 {recentHistory.length} 局</div>
          </div>
          {recentHistory.length ? recentHistory.map((round) => (
            <div key={round.roundNum} style={{ display:'flex', gap:6, alignItems:'center', fontSize:10, color:'#c0c5cf', padding:'3px 0', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color:'#f5c842', fontWeight:900, width:34 }}>第{round.roundNum}局</span>
              <span style={{ flex:1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                {round.result.map(r => `${r.rank}.${r.name}${r.score}分${r.qualified ? '赢' : '输'}`).join(' ｜ ')}
              </span>
            </div>
          )) : (
            <div style={{ fontSize:10, color:'#8b93a7' }}>暂无历史记录</div>
          )}
        </div>

        <div style={{ marginTop:4 }}>
          {isHost ? (
            <button className="settlement-next-button" onClick={()=>send({type:'next_round'})} style={{
              width:'100%', padding:'11px 0', borderRadius:12, fontWeight:900, fontSize:15,
              background:'linear-gradient(135deg,#f5c842,#e8a020)',
              border:'1px solid rgba(255,255,255,.20)', color:'#0d1117',
              boxShadow:'0 5px 22px #f5c84255, inset 0 1px 0 rgba(255,255,255,.42)',
              animation:'glow-pulse 2s infinite',
            }}>继续下一局 →</button>
          ) : (
            <div style={{ textAlign:'center', color:'#a1a8b5', fontSize:13, padding:'10px 0', borderRadius:12, border:'1px dashed rgba(255,255,255,.12)', background:'rgba(255,255,255,.03)' }}>等待房主开始下一局...</div>
          )}
        </div>
      </div>
    </div>
  );
}
