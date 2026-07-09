import React, { useEffect, useState } from 'react';

const AVATAR_COLORS = ['#9333ea','#0891b2','#d97706','#dc2626'];
const AVATARS = ['🐲','🐯','🦊','🐺'];

function loadSavedSession(roomId) {
  return {
    playerId: localStorage.getItem(`henan50k:${roomId}:playerId`) || undefined,
    playerToken: localStorage.getItem(`henan50k:${roomId}:playerToken`) || undefined,
  };
}

function hasSavedSession() {
  const roomId = localStorage.getItem('henan50k:lastRoomId');
  if (!roomId) return false;
  return Boolean(localStorage.getItem(`henan50k:${roomId}:playerId`) && localStorage.getItem(`henan50k:${roomId}:playerToken`));
}

export default function Lobby({ send, gameState, myInfo, onContinueLastRoom }) {
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [view, setView] = useState('home');
  const [savedSession, setSavedSession] = useState(false);

  const inRoom = myInfo && gameState;
  const isHost = inRoom && gameState.players[0]?.id === myInfo.playerId;

  useEffect(() => { setSavedSession(hasSavedSession()); }, [view, inRoom]);
  useEffect(() => { if (inRoom && view !== 'room') setView('room'); }, [inRoom, view]);

  function getPlayerName() { return name.trim() || '我'; }

  function createRoom(maxPlayers) {
    if (!name.trim()) return alert('请输入昵称');
    send({ type: 'create_room', playerName: name.trim(), maxPlayers });
    setView('room');
  }

  function startSolo() {
    send({ type: 'create_room', playerName: getPlayerName(), maxPlayers: 4, solo: true });
    setView('room');
  }

  function joinRoom() {
    if (!name.trim()) return alert('请输入昵称');
    if (joinId.length !== 6) return alert('请输入6位房间号');
    const roomId = joinId.trim();
    const saved = loadSavedSession(roomId);
    send({ type: 'join_room', roomId, playerName: name.trim(), ...saved });
  }

  return (
    <div style={{
      height:'100%', display:'flex', alignItems:'stretch',
      background:'radial-gradient(ellipse at 30% 50%, #10291c 0%, #0d1117 58%, #060b08 100%)',
      position:'relative', overflow:'hidden',
      fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif",
    }}>
      <div style={{ position:'absolute', width:380, height:380, borderRadius:'50%', background:'radial-gradient(circle,#f5c84216 0%,transparent 70%)', top:-120, left:-90, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', width:320, height:320, borderRadius:'50%', background:'radial-gradient(circle,#0891b218 0%,transparent 70%)', bottom:-90, right:-90, pointerEvents:'none' }}/>

      <div style={{ width:'40%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderRight:'1px solid #ffffff08', padding:'20px 24px', flexShrink:0 }}>
        <div style={{ display:'flex', gap:10, marginBottom:10 }}>{['♠','♥','♦','♣'].map((s,i)=><span key={i} style={{ fontSize:24, color: i%2?'#ef4444':'#e2e2e2' }}>{s}</span>)}</div>
        <div style={{ fontSize:48, fontWeight:900, letterSpacing:4, lineHeight:1, color:'#f5c842', marginBottom:8 }}>河南<br/>五十K</div>
        <div style={{ fontSize:11, color:'#64748b', letterSpacing:4, marginBottom:18 }}>联网对战 · 单机练习</div>
        <div style={{ display:'flex', gap:6, opacity:.75 }}>{['5♠','10♥','K♦','K♣'].map((c,i)=><div key={i} style={{ width:32, height:44, borderRadius:5, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, color:i%2?'#e53935':'#111', boxShadow:'0 2px 8px #0006', transform:`rotate(${(i-1.5)*5}deg)` }}>{c}</div>)}</div>
        <div style={{ marginTop:20, fontSize:11, color:'#64748b', textAlign:'center', lineHeight:1.8 }}>支持 3~4 人联网对战<br/>也可以一个人练习规则</div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'16px 24px' }}>
        {view === 'home' && (
          <div style={{ width:'100%', maxWidth:340, animation:'slide-up .25s ease' }}>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, color:'#94a3b8', marginBottom:5, display:'block' }}>你的昵称</label>
              <input value={name} maxLength={8} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&name.trim()&&setView('create')} placeholder="输入昵称，单机可不填" style={{ width:'100%', padding:'11px 14px', borderRadius:10, fontSize:15, background:'#ffffff0d', border:'1px solid #ffffff22', color:'#f0f0f0', outline:'none' }} />
            </div>

            {savedSession && (
              <button onClick={onContinueLastRoom} style={{ width:'100%', marginBottom:10, padding:'11px 0', borderRadius:12, fontWeight:800, fontSize:14, background:'rgba(255,255,255,0.08)', color:'#f5c842', border:'1px solid #f5c84255' }}>继续上次房间</button>
            )}

            <button onClick={startSolo} style={{ width:'100%', marginBottom:10, padding:'14px 0', borderRadius:12, fontWeight:900, fontSize:16, background:'linear-gradient(135deg,#f5c842,#d99920)', color:'#102016', boxShadow:'0 4px 18px #f5c84233', border:'none' }}>🤖 单机练习</button>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>{if(!name.trim()){alert('请输入昵称');return;}setView('create');}} style={{ flex:1, padding:'13px 0', borderRadius:12, fontWeight:800, fontSize:15, background:'linear-gradient(135deg,#166534,#14532d)', color:'#fff', border:'1px solid #22c55e55' }}>创建房间</button>
              <button onClick={()=>{if(!name.trim()){alert('请输入昵称');return;}setView('join');}} style={{ flex:1, padding:'13px 0', borderRadius:12, fontWeight:800, fontSize:15, background:'linear-gradient(135deg,#0891b2,#0e7490)', color:'#fff', border:'1px solid #67e8f955' }}>加入房间</button>
            </div>
          </div>
        )}

        {view === 'create' && !inRoom && (
          <div style={{ width:'100%', maxWidth:320, animation:'slide-up .25s ease' }}>
            <div style={{ textAlign:'center', fontSize:13, color:'#94a3b8', marginBottom:14 }}>选择联网人数</div>
            <div style={{ display:'flex', gap:12 }}>
              <button onClick={()=>createRoom(3)} style={{ flex:1, padding:'22px 0', borderRadius:14, fontWeight:800, fontSize:16, background:'#10291c', border:'2px solid #22c55e55', color:'#22c55e' }}><span style={{fontSize:28}}>👥</span><br/>三人局<br/><span style={{fontSize:11,color:'#64748b',fontWeight:400}}>每人36张</span></button>
              <button onClick={()=>createRoom(4)} style={{ flex:1, padding:'22px 0', borderRadius:14, fontWeight:800, fontSize:16, background:'#15152b', border:'2px solid #9333ea55', color:'#c084fc' }}><span style={{fontSize:28}}>👨‍👩‍👧‍👦</span><br/>四人局<br/><span style={{fontSize:11,color:'#64748b',fontWeight:400}}>每人27张</span></button>
            </div>
            <button onClick={()=>setView('home')} style={{ marginTop:12, background:'none', color:'#64748b', fontSize:13, border:'none', width:'100%', padding:'6px 0' }}>← 返回</button>
          </div>
        )}

        {view === 'join' && !inRoom && (
          <div style={{ width:'100%', maxWidth:320, animation:'slide-up .25s ease' }}>
            <div style={{ marginBottom:12 }}><label style={{ fontSize:11, color:'#94a3b8', marginBottom:5, display:'block' }}>6位房间号</label><input value={joinId} maxLength={6} onChange={e=>setJoinId(e.target.value.replace(/\D/g,'').slice(0,6))} onKeyDown={e=>e.key==='Enter'&&joinRoom()} placeholder="输入房间号..." style={{ width:'100%', padding:'13px 16px', borderRadius:10, fontSize:24, letterSpacing:10, background:'#ffffff0d', border:'1px solid #ffffff22', color:'#f5c842', outline:'none', textAlign:'center', fontWeight:800 }} /></div>
            <button onClick={joinRoom} style={{ width:'100%', padding:'13px 0', borderRadius:12, fontWeight:800, fontSize:15, background: joinId.length===6 ? 'linear-gradient(135deg,#0891b2,#166534)' : '#1a1a1a', color: joinId.length===6 ? '#fff' : '#444', border:'none' }}>进入房间 →</button>
            <button onClick={()=>setView('home')} style={{ marginTop:10, background:'none', color:'#64748b', fontSize:13, border:'none', width:'100%', padding:'6px 0' }}>← 返回</button>
          </div>
        )}

        {inRoom && (
          <div style={{ width:'100%', maxWidth:360, animation:'slide-up .25s ease' }}>
            <div style={{ background:'#ffffff06', border:'1px solid #ffffff10', borderRadius:14, padding:16, marginBottom:12, backdropFilter:'blur(12px)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}><span style={{ fontSize:11, color:'#94a3b8' }}>{gameState.mode === 'solo' ? '单机练习' : '房间号'}</span><span style={{ fontSize:28, fontWeight:900, color:'#f5c842', letterSpacing:4 }}>{gameState.mode === 'solo' ? 'SOLO' : gameState.id}</span></div>
              <div style={{ fontSize:10, color:'#94a3b8', marginBottom:8 }}>玩家 {gameState.players.length}/{gameState.maxPlayers}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {gameState.players.map((p,i)=><div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, background: p.id===myInfo.playerId ? '#f5c84212' : '#ffffff05', border:`1px solid ${p.id===myInfo.playerId?'#f5c84233':'#ffffff08'}` }}><div style={{ width:30, height:30, borderRadius:'50%', background:AVATAR_COLORS[i], display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'#fff', fontWeight:900 }}>{p.isBot?'机':AVATARS[i]}</div><div style={{ flex:1, fontSize:13, fontWeight:700 }}>{p.name} {p.id===myInfo.playerId&&<span style={{fontSize:10,color:'#f5c842'}}>(我)</span>}{i===0&&<span style={{fontSize:10,color:'#f5c842',marginLeft:4}}>👑</span>}</div><span style={{ fontSize:10, color:p.isOnline?'#4ade80':'#f87171' }}>● {p.isBot?'机器人':p.isOnline?'在线':'离线'}</span></div>)}
                {[...Array(Math.max(0, gameState.maxPlayers - gameState.players.length))].map((_,i)=><div key={i} style={{ padding:'8px 10px', borderRadius:8, border:'1px dashed #ffffff0d', color:'#334155', fontSize:12, textAlign:'center' }}>等待加入...</div>)}
              </div>
            </div>
            {isHost && gameState.players.length >= 3 && gameState.status === 'waiting' ? <button onClick={()=>send({type:'start_game'})} style={{ width:'100%', padding:'13px 0', borderRadius:12, fontWeight:900, fontSize:16, background:'linear-gradient(135deg,#f5c842,#e8a020)', color:'#0d1117', border:'none' }}>开始游戏</button> : isHost ? <div style={{ textAlign:'center', color:'#64748b', fontSize:12, padding:'10px 0' }}>{gameState.status === 'playing' ? '游戏进行中...' : '至少需要 3 名玩家才能开始'}</div> : <div style={{ textAlign:'center', color:'#64748b', fontSize:12, padding:'10px 0' }}>等待房主开始游戏...</div>}
          </div>
        )}
      </div>
    </div>
  );
}
