import React, { useEffect, useMemo, useRef, useState } from 'react';
import './Settlement.css';
import {
  SETTLEMENT_ACTION_TIMEOUT_MS,
  getSettlementActionState,
  getSettlementTimeoutMessage,
} from '../settlement-action-state';

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

function TopButton({ children, danger = false, left, onClick, disabled = false }) {
  return (
    <button disabled={disabled} onClick={onClick} style={{
      position:'absolute', top:10, left, zIndex:60,
      minHeight:40, padding:'0 13px', borderRadius:999,
      border:`1px solid ${danger ? 'rgba(248,113,113,.45)' : 'rgba(255,255,255,.20)'}`,
      background: danger ? 'rgba(127,29,29,.34)' : 'rgba(255,255,255,.08)',
      color: danger ? '#fecaca' : '#f8fafc',
      fontSize:13, fontWeight:900, opacity:disabled ? .55 : 1,
      boxShadow:'0 4px 12px rgba(0,0,0,.24)', backdropFilter:'blur(10px)',
    }}>{children}</button>
  );
}

async function copyRoomId(roomId) {
  if (!roomId) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(roomId);
      return true;
    }
    const input = document.createElement('textarea');
    input.value = roomId;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(input);
    return ok;
  } catch {
    return false;
  }
}

export default function Settlement({ data, send, myInfo, gameState, connected, onReturnLobby, onExitRoom }) {
  const [pendingAction, setPendingAction] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const timeoutRef = useRef(null);

  const isHost = gameState?.players?.[0]?.id === myInfo?.playerId;
  const history = gameState?.roundHistory || [];
  const recentHistory = history.slice(-5).reverse();
  const roomId = myInfo?.roomId || gameState?.roomId || '';
  const isSolo = gameState?.isSolo === true || /^SOLO/i.test(roomId);
  const actionState = useMemo(() => getSettlementActionState({ connected, isHost, pendingAction, roomId, isSolo }), [connected, isHost, pendingAction, roomId, isSolo]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);
  useEffect(() => {
    if (!connected && pendingAction === 'next_round') {
      clearTimeout(timeoutRef.current);
      setPendingAction(null);
      setActionMessage('网络已断开，下一局尚未开始。连接恢复后可以重试。');
    }
  }, [connected, pendingAction]);

  if (!data) return null;

  const startTimeout = (action) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setPendingAction(null);
      setActionMessage(getSettlementTimeoutMessage(action));
    }, SETTLEMENT_ACTION_TIMEOUT_MS);
  };

  const handleNextRound = () => {
    if (!actionState.canStartNextRound) return;
    const ok = send({ type:'next_round' });
    if (!ok) {
      setActionMessage('下一局请求没有发送成功，请检查网络后重试。');
      return;
    }
    setPendingAction('next_round');
    setActionMessage('请求已经发送，正在等待服务器开始下一局…');
    startTimeout('next_round');
  };

  const handleCopyRoom = async () => {
    if (!actionState.canCopy) return;
    setPendingAction('copy_room');
    setActionMessage('正在复制房间号…');
    const ok = await copyRoomId(roomId);
    setPendingAction(null);
    setActionMessage(ok ? `房间号 ${roomId} 已复制。` : getSettlementTimeoutMessage('copy_room'));
  };

  const leader = data[0];
  const leaderOk = leader ? (leader.qualified ?? leader.score >= leader.target) : false;

  return (
    <div className="settlement-page" style={{
      height:'100%', display:'flex',
      background:'radial-gradient(ellipse at 50% 30%, #1e1060 0%, #0d1117 60%)',
      position:'relative', overflow:'hidden',
      fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif",
    }}>
      <TopButton left={10} disabled={Boolean(pendingAction)} onClick={onReturnLobby}>← 返回大厅</TopButton>
      <TopButton left={112} danger disabled={Boolean(pendingAction) || !connected} onClick={onExitRoom}>退出房间</TopButton>
      <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(45deg,#ffffff03 0,#ffffff03 1px,transparent 0,transparent 50%)', backgroundSize:'12px 12px', pointerEvents:'none' }}/>

      <div className="settlement-hero" style={{
        width:'34%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        borderRight:'1px solid #ffffff0a', padding:'16px', minWidth:0,
        background: leaderOk ? 'radial-gradient(ellipse at 50% 50%, #f5c84208 0%, transparent 70%)' : 'radial-gradient(ellipse at 50% 50%, #ef444408 0%, transparent 70%)',
      }}>
        <div className="settlement-hero-icon" style={{ fontSize:56, marginBottom:8, filter:`drop-shadow(0 0 20px ${leaderOk ? '#f5c84266' : '#ef444466'})` }}>{leaderOk ? '🏆' : '⚠️'}</div>
        <div className="settlement-leader-name" title={leader?.name || ''} style={{ maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:25, fontWeight:900, color:leaderOk ? '#f5c842' : '#f87171', textShadow:`0 0 20px ${leaderOk ? '#f5c84288' : '#ef444488'}`, marginBottom:4 }}>
          {leader?.name || '未命名玩家'}
        </div>
        <div className="settlement-leader-meta" style={{ fontSize:13, color:'#aaa', marginBottom:14 }}>头游 · {leaderOk ? '达标算赢' : '未达标判负'}</div>
        <div className="settlement-leader-score" style={{ fontSize:48, fontWeight:900, background: leaderOk ? 'linear-gradient(135deg,#f5c842,#fbbf24)' : 'linear-gradient(135deg,#f87171,#ef4444)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>+{leader?.score}</div>
        <div style={{ fontSize:13, color:'#8b93a7', marginTop:2 }}>目标 ≥{leader?.target} 分</div>
        <div className="settlement-round-badge" style={{ marginTop:18, padding:'8px 18px', borderRadius:20, background: leaderOk ? '#f5c84215' : '#ef444415', border:`1px solid ${leaderOk ? '#f5c84233' : '#ef444433'}`, fontSize:12, color:leaderOk ? '#f5c842' : '#f87171' }}>第 {gameState?.roundNum || 1} 局结算</div>
        {!isSolo && roomId && (
          <div style={{ marginTop:12, width:'100%', textAlign:'center' }}>
            <div style={{ fontSize:11, color:'#94a3b8', marginBottom:5 }}>房间号：<strong style={{ color:'#f8fafc', letterSpacing:1 }}>{roomId}</strong></div>
            <button onClick={handleCopyRoom} disabled={!actionState.canCopy} aria-label={`复制房间号 ${roomId}`} style={{ minHeight:40, minWidth:120, borderRadius:12, border:'1px solid rgba(251,191,36,.42)', background:'rgba(120,53,15,.38)', color:'#fbbf24', fontWeight:900, opacity:actionState.canCopy ? 1 : .55 }}>{actionState.copyLabel}</button>
          </div>
        )}
      </div>

      <div className="settlement-content" style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'12px 18px', gap:8, minWidth:0 }}>
        <div className="settlement-section-heading" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2, gap:10 }}>
          <div style={{ fontSize:14, color:'#f8fafc', fontWeight:900 }}>本局计分情况</div>
          <div style={{ fontSize:12, color:'#a1a8b5', textAlign:'right' }}>达标线：{gameState?.players?.length === 3 ? '30 / 70 / 100' : '20 / 40 / 60 / 80'} 分</div>
        </div>

        {data.map((p,i)=>{
          const isMe = p.id === myInfo?.playerId;
          const playerIdx = gameState?.players?.findIndex(pl=>pl.id===p.id) ?? i;
          const safeIdx = playerIdx >= 0 ? playerIdx % AVATARS.length : i % AVATARS.length;
          const ok = p.qualified ?? p.score >= p.target;
          const name = p.name || '未命名玩家';
          return (
            <div className="settlement-score-card" key={p.id || `${name}-${i}`} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:12, background: RANK_BG[i] || RANK_BG[RANK_BG.length - 1], border:`1px solid ${ok ? (RANK_BORDER[i] || '#6366f1') : '#ef4444'}`, boxShadow: i===0 ? `0 0 16px ${(ok ? (RANK_BORDER[i] || '#6366f1') : '#ef4444')}33` : '0 5px 14px rgba(0,0,0,.16)', animation:`slide-up ${0.1+i*0.08}s ease`, position:'relative' }}>
              <div style={{ fontSize:20, flexShrink:0 }}>{MEDALS[i] || `${i+1}`}</div>
              <div style={{ width:30, height:30, borderRadius:'50%', flexShrink:0, background: AVATAR_COLORS[safeIdx], display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, boxShadow:'inset 0 1px 0 rgba(255,255,255,.22), 0 3px 8px rgba(0,0,0,.25)' }}>{AVATARS[safeIdx]}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div title={name} style={{ fontSize:13, fontWeight:800, display:'flex', alignItems:'center', gap:5, color:'#f8fafc', minWidth:0 }}>
                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{RANK_NAMES[i] || `第${i+1}名`} · {name}</span>
                  {isMe && <span style={{ flexShrink:0, fontSize:9, color:'#e9d5ff', background:'#9333ea55', border:'1px solid #c084fc55', padding:'1px 5px', borderRadius:6 }}>我</span>}
                </div>
                <div className="settlement-score-detail" style={{ fontSize:10, color:'#b2b8c5', marginTop:1 }}>本局 <span style={{color:'#fff'}}>{p.score}</span> 分 · 累计 <span style={{color:'#fff'}}>{p.totalScore}</span> 分 · 目标 ≥{p.target}分</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:19, fontWeight:900, color: ok ? (i===0?'#f5c842':'#f8fafc') : '#f87171' }}>+{p.score}</div>
                <div style={{ fontSize:10, fontWeight:800, color: ok?'#4ade80':'#f87171' }}>{ok ? '✓ 达标·赢' : '✗ 未达标·输'}</div>
              </div>
            </div>
          );
        })}

        <div className="settlement-history" style={{ marginTop:4, border:'1px solid rgba(255,255,255,0.10)', borderRadius:12, background:'rgba(0,0,0,0.28)', padding:'8px 10px', boxShadow:'inset 0 1px 0 rgba(255,255,255,.03)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}><div style={{ fontSize:12, fontWeight:900, color:'#f1f5f9' }}>历史记录</div><div style={{ fontSize:10, color:'#8b93a7' }}>最近 {recentHistory.length} 局</div></div>
          {recentHistory.length ? recentHistory.map((round) => (
            <div key={round.roundNum} style={{ display:'flex', gap:6, alignItems:'center', fontSize:10, color:'#c0c5cf', padding:'3px 0', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color:'#f5c842', fontWeight:900, width:34, flexShrink:0 }}>第{round.roundNum}局</span>
              <span style={{ flex:1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{round.result.map(r => `${r.rank}.${r.name || '未命名玩家'}${r.score}分${r.qualified ? '赢' : '输'}`).join(' ｜ ')}</span>
            </div>
          )) : <div style={{ fontSize:10, color:'#8b93a7' }}>暂无历史记录</div>}
        </div>

        <div style={{ marginTop:4 }}>
          {isHost ? (
            <button className="settlement-next-button" disabled={!actionState.canStartNextRound} onClick={handleNextRound} aria-describedby="settlement-action-status" style={{ width:'100%', minHeight:48, padding:'11px 0', borderRadius:12, fontWeight:900, fontSize:15, background:'linear-gradient(135deg,#f5c842,#e8a020)', border:'1px solid rgba(255,255,255,.20)', color:'#0d1117', boxShadow:'0 5px 22px #f5c84255, inset 0 1px 0 rgba(255,255,255,.42)', animation:actionState.canStartNextRound ? 'glow-pulse 2s infinite' : 'none', opacity:actionState.canStartNextRound ? 1 : .55 }}>{actionState.nextRoundLabel}</button>
          ) : (
            <div style={{ textAlign:'center', color:'#a1a8b5', fontSize:13, padding:'10px 0', borderRadius:12, border:'1px dashed rgba(255,255,255,.12)', background:'rgba(255,255,255,.03)' }}>{actionState.nextRoundLabel}</div>
          )}
          <div id="settlement-action-status" role="status" aria-live="polite" aria-atomic="true" style={{ minHeight:20, marginTop:6, textAlign:'center', color: actionMessage ? '#fbbf24' : '#94a3b8', fontSize:12, lineHeight:1.5 }}>{actionMessage || actionState.nextRoundHint}</div>
        </div>
      </div>
    </div>
  );
}
