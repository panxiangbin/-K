import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getLobbyActionState, getLobbyActionStatus, LOBBY_ACTION_TIMEOUT_MS } from '../lobby-action-state';

const AVATAR_COLORS = ['#9333ea','#0891b2','#d97706','#dc2626'];
const AVATARS = ['🐲','🐯','🦊','🐺'];
const CONNECTION_EVENT = 'henan50k-connection-change';

function loadSavedSession(roomId) {
  return {
    playerId: localStorage.getItem(`henan50k:${roomId}:playerId`) || undefined,
    playerToken: localStorage.getItem(`henan50k:${roomId}:playerToken`) || undefined,
  };
}

function getLastSavedSession() {
  const roomId = localStorage.getItem('henan50k:lastRoomId');
  if (!roomId) return null;
  const saved = loadSavedSession(roomId);
  return saved.playerId && saved.playerToken ? { roomId, ...saved } : null;
}

function hasSavedSession() {
  return Boolean(getLastSavedSession());
}

function TopBackButton({ children = '返回', danger = false, onClick }) {
  return <button type="button" onClick={onClick} style={{ position:'absolute', top:10, left:10, zIndex:50, minHeight:40, padding:'0 13px', borderRadius:999, border:`1px solid ${danger ? 'rgba(248,113,113,.45)' : 'rgba(255,255,255,.20)'}`, background:danger?'rgba(127,29,29,.34)':'rgba(255,255,255,.08)', color:danger?'#fecaca':'#f8fafc', fontSize:13, fontWeight:900, boxShadow:'0 4px 12px rgba(0,0,0,.22)', backdropFilter:'blur(10px)' }}>{children}</button>;
}

function buttonStyle(disabled, background, color = '#fff') {
  return { width:'100%', minHeight:48, padding:'12px 10px', borderRadius:12, fontWeight:900, fontSize:15, background:disabled?'#1f2937':background, color:disabled?'#64748b':color, border:'1px solid rgba(255,255,255,.12)', cursor:disabled?'not-allowed':'pointer', opacity:disabled?.78:1, touchAction:'manipulation' };
}

export default function Lobby({ send, gameState, myInfo, onExitRoom }) {
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [view, setView] = useState('home');
  const [savedSession, setSavedSession] = useState(false);
  const [connected, setConnected] = useState(() => Boolean(window.__henan50kConnected));
  const [pendingAction, setPendingAction] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const pendingTimer = useRef(null);

  const inRoom = Boolean(myInfo && gameState);
  const isHost = inRoom && gameState.players[0]?.id === myInfo.playerId;
  const statusText = getLobbyActionStatus({ connected, pendingAction, timedOut });

  useEffect(() => { setSavedSession(hasSavedSession()); }, [view, inRoom]);
  useEffect(() => { if (inRoom && view !== 'room') setView('room'); }, [inRoom, view]);
  useEffect(() => {
    const handleConnection = (event) => setConnected(Boolean(event.detail?.connected));
    window.addEventListener(CONNECTION_EVENT, handleConnection);
    return () => window.removeEventListener(CONNECTION_EVENT, handleConnection);
  }, []);
  useEffect(() => {
    if (connected && !inRoom) return;
    clearTimeout(pendingTimer.current);
    pendingTimer.current = null;
    setPendingAction(null);
    setTimedOut(false);
  }, [connected, inRoom]);
  useEffect(() => () => clearTimeout(pendingTimer.current), []);

  const states = useMemo(() => ({
    continue: getLobbyActionState({ connected, pendingAction, action:'continue' }),
    create: getLobbyActionState({ connected, pendingAction, action:'create' }),
    solo: getLobbyActionState({ connected, pendingAction, action:'solo' }),
    join: getLobbyActionState({ connected, pendingAction, action:'join', valid:joinId.length===6 }),
  }), [connected, pendingAction, joinId]);

  function beginRequest(action, message) {
    const state = getLobbyActionState({ connected, pendingAction, action, valid:action!=='join'||joinId.length===6 });
    if (state.disabled) return;
    setTimedOut(false);
    const sent = send(message);
    if (!sent) return;
    setPendingAction(action);
    clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => {
      pendingTimer.current = null;
      setPendingAction(null);
      setTimedOut(true);
    }, LOBBY_ACTION_TIMEOUT_MS);
  }

  function createRoom(maxPlayers) {
    if (!name.trim()) return alert('请输入昵称');
    beginRequest('create', { type:'create_room', playerName:name.trim(), maxPlayers });
  }

  function startSolo(maxPlayers) {
    beginRequest('solo', { type:'create_room', playerName:name.trim()||'我', maxPlayers, solo:true });
  }

  function joinRoom() {
    if (!name.trim()) return alert('请输入昵称');
    if (joinId.length !== 6) return;
    const roomId = joinId.trim();
    beginRequest('join', { type:'join_room', roomId, playerName:name.trim(), ...loadSavedSession(roomId) });
  }

  function continueLastRoom() {
    const saved = getLastSavedSession();
    if (!saved) { setSavedSession(false); return; }
    beginRequest('continue', { type:'join_room', ...saved, playerName:'' });
  }

  function backHome() {
    if (pendingAction) return;
    setView('home');
    setTimedOut(false);
  }

  return (
    <div style={{ height:'100%', display:'flex', alignItems:'stretch', background:'radial-gradient(ellipse at 30% 50%, #10291c 0%, #0d1117 58%, #060b08 100%)', position:'relative', overflow:'hidden', fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif" }}>
      {view !== 'home' && !inRoom && <TopBackButton onClick={backHome}>← 返回</TopBackButton>}
      {inRoom && <TopBackButton danger onClick={onExitRoom}>退出房间</TopBackButton>}
      <div style={{ position:'absolute', width:380, height:380, borderRadius:'50%', background:'radial-gradient(circle,#f5c84216 0%,transparent 70%)', top:-120, left:-90, pointerEvents:'none' }}/>
      <div style={{ width:'40%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderRight:'1px solid #ffffff08', padding:'20px 24px', flexShrink:0 }}>
        <div style={{ display:'flex', gap:10, marginBottom:10 }}>{['♠','♥','♦','♣'].map((s,i)=><span key={s} style={{ fontSize:24, color:i%2?'#ef4444':'#e2e2e2' }}>{s}</span>)}</div>
        <div style={{ fontSize:48, fontWeight:900, letterSpacing:4, lineHeight:1, color:'#f5c842', marginBottom:8 }}>河南<br/>五十K</div>
        <div style={{ fontSize:11, color:'#64748b', letterSpacing:4, marginBottom:18 }}>联网对战 · 单机练习</div>
        <div style={{ display:'flex', gap:6, opacity:.75 }}>{['5♠','10♥','K♦','K♣'].map((c,i)=><div key={c} style={{ width:32, height:44, borderRadius:5, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, color:i%2?'#e53935':'#111', boxShadow:'0 2px 8px #0006', transform:`rotate(${(i-1.5)*5}deg)` }}>{c}</div>)}</div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'16px 24px' }}>
        {!inRoom && statusText && <div role="status" aria-live="polite" aria-atomic="true" style={{ width:'100%', maxWidth:340, marginBottom:12, padding:'9px 12px', borderRadius:10, background:timedOut?'rgba(127,29,29,.28)':'rgba(30,41,59,.8)', border:`1px solid ${timedOut?'rgba(248,113,113,.42)':'rgba(148,163,184,.25)'}`, color:timedOut?'#fecaca':'#cbd5e1', fontSize:12, lineHeight:1.5, textAlign:'center' }}>{statusText}</div>}

        {view === 'home' && <div style={{ width:'100%', maxWidth:340, animation:'slide-up .25s ease' }}>
          <label htmlFor="player-name" style={{ fontSize:11, color:'#94a3b8', marginBottom:5, display:'block' }}>你的昵称</label>
          <input id="player-name" value={name} maxLength={8} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&name.trim()&&connected&&!pendingAction)setView('create');}} placeholder="输入昵称，单机可不填" style={{ width:'100%', padding:'11px 14px', borderRadius:10, fontSize:15, background:'#ffffff0d', border:'1px solid #ffffff22', color:'#f0f0f0', outline:'none', marginBottom:12 }}/>
          {savedSession && <button type="button" disabled={states.continue.disabled} aria-describedby="lobby-action-help" onClick={continueLastRoom} style={{...buttonStyle(states.continue.disabled,'rgba(255,255,255,.08)','#f5c842'),marginBottom:10}}>{states.continue.label}</button>}
          <button type="button" onClick={()=>setView('solo')} disabled={Boolean(pendingAction)} style={{...buttonStyle(Boolean(pendingAction),'linear-gradient(135deg,#f5c842,#d99920)','#102016'),marginBottom:10}}>🤖 单机练习</button>
          <div style={{ display:'flex', gap:10 }}>
            <button type="button" disabled={states.create.disabled} onClick={()=>{if(!name.trim())return alert('请输入昵称');setView('create');}} style={buttonStyle(states.create.disabled,'linear-gradient(135deg,#166534,#14532d)')}>创建房间</button>
            <button type="button" disabled={states.join.disabled && !(!pendingAction&&connected)} onClick={()=>{if(!name.trim())return alert('请输入昵称');setView('join');}} style={buttonStyle(Boolean(pendingAction)||!connected,'linear-gradient(135deg,#0891b2,#0e7490)')}>加入房间</button>
          </div>
        </div>}

        {view === 'solo' && !inRoom && <div style={{ width:'100%', maxWidth:320, animation:'slide-up .25s ease' }}>
          <div style={{ textAlign:'center', fontSize:13, color:'#94a3b8', marginBottom:14 }}>选择单机人数</div>
          <div style={{ display:'flex', gap:12 }}>
            <button type="button" disabled={states.solo.disabled} onClick={()=>startSolo(3)} style={buttonStyle(states.solo.disabled,'#10291c','#22c55e')}>🤖<br/>三人单机<br/><small>我+2机器人</small></button>
            <button type="button" disabled={states.solo.disabled} onClick={()=>startSolo(4)} style={buttonStyle(states.solo.disabled,'#15152b','#c084fc')}>🤖<br/>四人单机<br/><small>我+3机器人</small></button>
          </div>
          <button type="button" disabled={Boolean(pendingAction)} onClick={backHome} style={{ marginTop:12, background:'none', color:'#94a3b8', fontSize:13, border:'none', width:'100%', minHeight:40 }}>← 返回</button>
        </div>}

        {view === 'create' && !inRoom && <div style={{ width:'100%', maxWidth:320, animation:'slide-up .25s ease' }}>
          <div style={{ textAlign:'center', fontSize:13, color:'#94a3b8', marginBottom:14 }}>选择联网人数</div>
          <div style={{ display:'flex', gap:12 }}>
            <button type="button" disabled={states.create.disabled} onClick={()=>createRoom(3)} style={buttonStyle(states.create.disabled,'#10291c','#22c55e')}>👥<br/>{pendingAction==='create'?'创建中…':'三人局'}<br/><small>每人36张</small></button>
            <button type="button" disabled={states.create.disabled} onClick={()=>createRoom(4)} style={buttonStyle(states.create.disabled,'#15152b','#c084fc')}>👨‍👩‍👧‍👦<br/>{pendingAction==='create'?'创建中…':'四人局'}<br/><small>每人27张</small></button>
          </div>
        </div>}

        {view === 'join' && !inRoom && <div style={{ width:'100%', maxWidth:320, animation:'slide-up .25s ease' }}>
          <label htmlFor="room-id" style={{ fontSize:11, color:'#94a3b8', marginBottom:5, display:'block' }}>6位房间号</label>
          <input id="room-id" inputMode="numeric" value={joinId} maxLength={6} disabled={Boolean(pendingAction)} onChange={e=>setJoinId(e.target.value.replace(/\D/g,'').slice(0,6))} onKeyDown={e=>{if(e.key==='Enter'&&!states.join.disabled)joinRoom();}} placeholder="输入房间号..." style={{ width:'100%', padding:'13px 16px', borderRadius:10, fontSize:24, letterSpacing:10, background:'#ffffff0d', border:'1px solid #ffffff22', color:'#f5c842', outline:'none', textAlign:'center', fontWeight:800, marginBottom:12 }}/>
          <button type="button" disabled={states.join.disabled} aria-describedby="lobby-action-help" onClick={joinRoom} style={buttonStyle(states.join.disabled,'linear-gradient(135deg,#0891b2,#166534)')}>{states.join.label} →</button>
        </div>}

        <span id="lobby-action-help" style={{ position:'absolute', width:1, height:1, padding:0, margin:-1, overflow:'hidden', clip:'rect(0,0,0,0)', whiteSpace:'nowrap', border:0 }}>{pendingAction?'请求处理中，请勿重复提交。':connected?'服务器已连接。':'服务器尚未连接。'}</span>

        {inRoom && <div style={{ width:'100%', maxWidth:360, animation:'slide-up .25s ease' }}>
          <div style={{ background:'#ffffff06', border:'1px solid #ffffff10', borderRadius:14, padding:16, marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}><span style={{ fontSize:11, color:'#94a3b8' }}>{gameState.mode==='solo'?'单机练习':'房间号'}</span><span style={{ fontSize:28, fontWeight:900, color:'#f5c842', letterSpacing:4 }}>{gameState.mode==='solo'?`${gameState.maxPlayers}人`:gameState.id}</span></div>
            <div style={{ fontSize:10, color:'#94a3b8', marginBottom:8 }}>玩家 {gameState.players.length}/{gameState.maxPlayers}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>{gameState.players.map((p,i)=><div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, background:p.id===myInfo.playerId?'#f5c84212':'#ffffff05' }}><div style={{ width:30, height:30, borderRadius:'50%', background:AVATAR_COLORS[i], display:'grid', placeItems:'center' }}>{p.isBot?'机':AVATARS[i]}</div><div style={{ flex:1, fontSize:13, fontWeight:700 }}>{p.name}{p.id===myInfo.playerId?' (我)':''}</div><span style={{ fontSize:10, color:p.isOnline?'#4ade80':'#f87171' }}>● {p.isBot?'机器人':p.isOnline?'在线':'离线'}</span></div>)}</div>
          </div>
          {isHost&&gameState.players.length>=3&&gameState.status==='waiting'?<button type="button" onClick={()=>send({type:'start_game'})} style={buttonStyle(false,'linear-gradient(135deg,#f5c842,#e8a020)','#0d1117')}>开始游戏</button>:<div style={{ textAlign:'center', color:'#64748b', fontSize:12, padding:'10px 0' }}>{isHost?'至少需要 3 名玩家才能开始':'等待房主开始游戏...'}</div>}
          <button type="button" onClick={onExitRoom} style={{...buttonStyle(false,'rgba(127,29,29,.22)','#fecaca'),marginTop:10}}>退出房间</button>
        </div>}
      </div>
    </div>
  );
}
