import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getLobbyActionState, getLobbyActionStatus, LOBBY_ACTION_TIMEOUT_MS } from '../lobby-action-state';
import { getRoomActionState, getRoomActionStatus, ROOM_ACTION_TIMEOUT_MS } from '../room-action-state';
import { formatPlayerName, getPresenceState, getRoomCopyState } from '../waiting-room-display';

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

function buttonStyle(disabled, background, color = '#fff') {
  return { width:'100%', minHeight:48, padding:'12px 10px', borderRadius:12, fontWeight:900, fontSize:15, background:disabled?'#1f2937':background, color:disabled?'#64748b':color, border:'1px solid rgba(255,255,255,.12)', cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.78:1, touchAction:'manipulation' };
}

function StatusBox({ children, danger = false }) {
  if (!children) return null;
  return <div role="status" aria-live="polite" aria-atomic="true" style={{ width:'100%', marginBottom:12, padding:'9px 12px', borderRadius:10, background:danger?'rgba(127,29,29,.28)':'rgba(30,41,59,.8)', border:`1px solid ${danger?'rgba(248,113,113,.42)':'rgba(148,163,184,.25)'}`, color:danger?'#fecaca':'#cbd5e1', fontSize:12, lineHeight:1.5, textAlign:'center' }}>{children}</div>;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('copy failed');
}

export default function Lobby({ send, gameState, myInfo }) {
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [view, setView] = useState('home');
  const [savedSession, setSavedSession] = useState(false);
  const [connected, setConnected] = useState(() => Boolean(window.__henan50kConnected));
  const [pendingAction, setPendingAction] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [roomPendingAction, setRoomPendingAction] = useState(null);
  const [roomTimedOutAction, setRoomTimedOutAction] = useState(null);
  const [copyState, setCopyState] = useState('idle');
  const pendingTimer = useRef(null);
  const roomTimer = useRef(null);
  const copyTimer = useRef(null);

  const inRoom = Boolean(myInfo && gameState);
  const isHost = inRoom && gameState.players[0]?.id === myInfo.playerId;
  const playerCount = gameState?.players?.length || 0;
  const statusText = getLobbyActionStatus({ connected, pendingAction, timedOut });
  const roomStatusText = getRoomActionStatus({ connected, pendingAction:roomPendingAction, timedOutAction:roomTimedOutAction });
  const roomCopyState = getRoomCopyState({ mode:gameState?.mode, roomId:gameState?.id, copyState });

  useEffect(() => { setSavedSession(Boolean(getLastSavedSession())); }, [view, inRoom]);
  useEffect(() => { if (inRoom) setView('room'); }, [inRoom]);
  useEffect(() => {
    const handler = event => setConnected(Boolean(event.detail?.connected));
    window.addEventListener(CONNECTION_EVENT, handler);
    return () => window.removeEventListener(CONNECTION_EVENT, handler);
  }, []);
  useEffect(() => {
    if (connected && !inRoom) return;
    clearTimeout(pendingTimer.current);
    setPendingAction(null);
    setTimedOut(false);
  }, [connected, inRoom]);
  useEffect(() => {
    if (!inRoom || !connected) {
      clearTimeout(roomTimer.current);
      setRoomPendingAction(null);
    }
  }, [inRoom, connected]);
  useEffect(() => {
    if (gameState?.status !== 'waiting') {
      clearTimeout(roomTimer.current);
      setRoomPendingAction(null);
      setRoomTimedOutAction(null);
    }
  }, [gameState?.status]);
  useEffect(() => {
    clearTimeout(copyTimer.current);
    setCopyState('idle');
  }, [gameState?.id]);
  useEffect(() => () => {
    clearTimeout(pendingTimer.current);
    clearTimeout(roomTimer.current);
    clearTimeout(copyTimer.current);
  }, []);

  const states = useMemo(() => ({
    continue: getLobbyActionState({ connected, pendingAction, action:'continue' }),
    create: getLobbyActionState({ connected, pendingAction, action:'create' }),
    solo: getLobbyActionState({ connected, pendingAction, action:'solo' }),
    join: getLobbyActionState({ connected, pendingAction, action:'join', valid:joinId.length===6 }),
  }), [connected, pendingAction, joinId]);

  const roomStates = useMemo(() => ({
    start: getRoomActionState({ action:'start', connected, pendingAction:roomPendingAction, isHost, playerCount, roomStatus:gameState?.status }),
    exit: getRoomActionState({ action:'exit', connected, pendingAction:roomPendingAction, isHost, playerCount, roomStatus:gameState?.status }),
  }), [connected, roomPendingAction, isHost, playerCount, gameState?.status]);

  function beginRequest(action, message) {
    const state = getLobbyActionState({ connected, pendingAction, action, valid:action!=='join'||joinId.length===6 });
    if (state.disabled || !send(message)) return;
    setTimedOut(false);
    setPendingAction(action);
    clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => { setPendingAction(null); setTimedOut(true); }, LOBBY_ACTION_TIMEOUT_MS);
  }

  function beginRoomRequest(action, message) {
    const state = action === 'start' ? roomStates.start : roomStates.exit;
    if (state.disabled || !send(message)) return;
    setRoomTimedOutAction(null);
    setRoomPendingAction(action);
    clearTimeout(roomTimer.current);
    roomTimer.current = setTimeout(() => {
      setRoomPendingAction(null);
      setRoomTimedOutAction(action);
    }, ROOM_ACTION_TIMEOUT_MS);
  }

  function joinRoom() {
    if (!name.trim() || joinId.length !== 6) return;
    beginRequest('join', { type:'join_room', roomId:joinId.trim(), playerName:name.trim(), ...loadSavedSession(joinId.trim()) });
  }

  async function copyRoomId() {
    if (roomCopyState.disabled || !gameState?.id) return;
    setCopyState('copying');
    clearTimeout(copyTimer.current);
    try {
      await copyText(String(gameState.id));
      setCopyState('success');
    } catch {
      setCopyState('error');
    }
    copyTimer.current = setTimeout(() => setCopyState('idle'), 2600);
  }

  return <div className="lobby-shell" style={{ background:'radial-gradient(ellipse at 30% 50%, #10291c 0%, #0d1117 58%, #060b08 100%)', color:'#f8fafc', fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif" }}>
    <div className="lobby-brand">
      <div className="lobby-brand-title" style={{ fontSize:48, fontWeight:900, color:'#f5c842', lineHeight:1 }}>河南<br/>五十K</div>
      <div style={{ marginTop:12, fontSize:12, color:'#94a3b8' }}>联网对战 · 单机练习</div>
    </div>
    <main className="lobby-main">
      <div className="lobby-panel">
        {!inRoom && <StatusBox danger={timedOut}>{statusText}</StatusBox>}
        {inRoom && <StatusBox danger={Boolean(roomTimedOutAction)}>{roomStatusText}</StatusBox>}

        {view === 'home' && !inRoom && <>
          <label htmlFor="player-name" style={{ display:'block', fontSize:12, color:'#94a3b8', marginBottom:6 }}>你的昵称</label>
          <input id="player-name" value={name} maxLength={8} onChange={e=>setName(e.target.value)} placeholder="输入昵称，单机可不填" style={{ width:'100%', minHeight:46, padding:'0 14px', borderRadius:10, background:'#ffffff0d', border:'1px solid #ffffff22', color:'#fff', marginBottom:12 }}/>
          {savedSession && <button type="button" disabled={states.continue.disabled} onClick={()=>{const s=getLastSavedSession(); if(s) beginRequest('continue',{type:'join_room',...s,playerName:''});}} style={{...buttonStyle(states.continue.disabled,'rgba(255,255,255,.08)','#f5c842'),marginBottom:10}}>{states.continue.label}</button>}
          <button type="button" disabled={Boolean(pendingAction)} onClick={()=>setView('solo')} style={{...buttonStyle(Boolean(pendingAction),'linear-gradient(135deg,#f5c842,#d99920)','#102016'),marginBottom:10}}>🤖 单机练习</button>
          <div style={{ display:'flex', gap:10 }}>
            <button type="button" disabled={!connected||Boolean(pendingAction)} onClick={()=>{if(!name.trim())return alert('请输入昵称');setView('create');}} style={buttonStyle(!connected||Boolean(pendingAction),'#166534')}>创建房间</button>
            <button type="button" disabled={!connected||Boolean(pendingAction)} onClick={()=>{if(!name.trim())return alert('请输入昵称');setView('join');}} style={buttonStyle(!connected||Boolean(pendingAction),'#0891b2')}>加入房间</button>
          </div>
        </>}

        {view === 'solo' && !inRoom && <>
          <div style={{ textAlign:'center', color:'#94a3b8', marginBottom:12 }}>选择单机人数</div>
          <div style={{ display:'flex', gap:10 }}>
            <button type="button" disabled={states.solo.disabled} onClick={()=>beginRequest('solo',{type:'create_room',playerName:name.trim()||'我',maxPlayers:3,solo:true})} style={buttonStyle(states.solo.disabled,'#166534')}>三人单机</button>
            <button type="button" disabled={states.solo.disabled} onClick={()=>beginRequest('solo',{type:'create_room',playerName:name.trim()||'我',maxPlayers:4,solo:true})} style={buttonStyle(states.solo.disabled,'#6d28d9')}>四人单机</button>
          </div>
        </>}

        {view === 'create' && !inRoom && <div style={{ display:'flex', gap:10 }}>
          <button type="button" disabled={states.create.disabled} onClick={()=>beginRequest('create',{type:'create_room',playerName:name.trim(),maxPlayers:3})} style={buttonStyle(states.create.disabled,'#166534')}>三人局</button>
          <button type="button" disabled={states.create.disabled} onClick={()=>beginRequest('create',{type:'create_room',playerName:name.trim(),maxPlayers:4})} style={buttonStyle(states.create.disabled,'#6d28d9')}>四人局</button>
        </div>}

        {view === 'join' && !inRoom && <>
          <label htmlFor="room-id" style={{ display:'block', fontSize:12, color:'#94a3b8', marginBottom:6 }}>6位房间号</label>
          <input id="room-id" inputMode="numeric" value={joinId} maxLength={6} disabled={Boolean(pendingAction)} onChange={e=>setJoinId(e.target.value.replace(/\D/g,'').slice(0,6))} onKeyDown={e=>{if(e.key==='Enter'&&!states.join.disabled)joinRoom();}} style={{ width:'100%', minHeight:52, textAlign:'center', fontSize:24, letterSpacing:8, borderRadius:10, background:'#ffffff0d', border:'1px solid #ffffff22', color:'#f5c842', marginBottom:12 }}/>
          <button type="button" disabled={states.join.disabled} onClick={joinRoom} style={buttonStyle(states.join.disabled,'#0891b2')}>{states.join.label}</button>
        </>}

        {!inRoom && view !== 'home' && <button type="button" disabled={Boolean(pendingAction)} onClick={()=>setView('home')} style={{ width:'100%', minHeight:44, marginTop:12, border:0, background:'transparent', color:'#94a3b8' }}>← 返回</button>}

        {inRoom && <>
          <section aria-label="房间玩家" className="waiting-room-card">
            <div className="waiting-room-header">
              <span style={{ color:'#94a3b8' }}>{gameState.mode==='solo'?'单机练习':'房间号'}</span>
              <div className="waiting-room-code-wrap">
                <strong className="waiting-room-code">{gameState.mode==='solo'?`${gameState.maxPlayers}人`:gameState.id}</strong>
                {roomCopyState.visible && <button type="button" className="waiting-room-copy" disabled={roomCopyState.disabled} onClick={copyRoomId} aria-describedby="copy-room-status">{roomCopyState.label}</button>}
              </div>
            </div>
            <div id="copy-room-status" role="status" aria-live="polite" aria-atomic="true" style={{ minHeight:roomCopyState.status?18:0, fontSize:12, color:copyState==='error'?'#fecaca':'#a7f3d0', textAlign:'right', marginBottom:roomCopyState.status?6:0 }}>{roomCopyState.status}</div>
            <div style={{ fontSize:12, color:'#94a3b8', marginBottom:8 }}>玩家 {playerCount}/{gameState.maxPlayers}</div>
            {gameState.players.map((p,i)=>{
              const displayName = formatPlayerName(p.name, { isSelf:p.id===myInfo.playerId });
              const presence = getPresenceState(p);
              return <div key={p.id} className="waiting-player" style={{ background:p.id===myInfo.playerId?'#f5c84212':'transparent' }} aria-label={`${displayName.full}，${presence.announced}`}>
                <span aria-hidden="true" style={{ width:30,height:30,borderRadius:'50%',background:AVATAR_COLORS[i%AVATAR_COLORS.length],display:'grid',placeItems:'center' }}>{p.isBot?'机':AVATARS[i%AVATARS.length]}</span>
                <span className="waiting-player-name" title={displayName.truncated?displayName.full:undefined}>{displayName.visible}</span>
                <span className={`waiting-player-status ${presence.tone}`}>{presence.label}</span>
              </div>;
            })}
          </section>
          {isHost ? <button type="button" disabled={roomStates.start.disabled} aria-describedby="room-action-help" onClick={()=>beginRoomRequest('start',{type:'start_game'})} style={buttonStyle(roomStates.start.disabled,'linear-gradient(135deg,#f5c842,#e8a020)','#0d1117')}>{roomStates.start.label}</button> : <div style={{ textAlign:'center', color:'#94a3b8', padding:10 }}>等待房主开始游戏…</div>}
          {roomStates.start.reason && isHost && !roomPendingAction && <div style={{ textAlign:'center', color:'#94a3b8', fontSize:12, marginTop:8 }}>{roomStates.start.reason}</div>}
          <button type="button" disabled={roomStates.exit.disabled} aria-describedby="room-action-help" onClick={()=>beginRoomRequest('exit',{type:'leave_room'})} style={{...buttonStyle(roomStates.exit.disabled,'rgba(127,29,29,.35)','#fecaca'),marginTop:12}}>{roomStates.exit.label}</button>
          <span id="room-action-help" style={{ position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0 0 0 0)' }}>{roomStatusText || roomStates.start.reason || roomStates.exit.reason || '房间操作可用。'}</span>
        </>}
      </div>
    </main>
  </div>;
}
