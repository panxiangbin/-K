import React, { useState } from 'react';

export default function Lobby({ send, gameState, myInfo }) {
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [view, setView] = useState('home'); // home | create | join | room

  const inRoom = myInfo && gameState;
  const isHost = inRoom && gameState.players[0]?.id === myInfo.playerId;

  if (inRoom && view !== 'room') setTimeout(() => setView('room'), 0);

  function createRoom(maxPlayers) {
    if (!name.trim()) return alert('请输入昵称');
    send({ type: 'create_room', playerName: name.trim(), maxPlayers });
    setView('room');
  }

  function joinRoom() {
    if (!name.trim()) return alert('请输入昵称');
    if (joinId.length !== 6) return alert('请输入6位房间号');
    send({ type: 'join_room', roomId: joinId.trim(), playerName: name.trim() });
  }

  const avatarColors = ['#a855f7','#06b6d4','#f59e0b','#ef4444'];

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 30% 20%, #1e1060 0%, #0d1117 50%, #0a1a0f 100%)',
      padding: 20, position: 'relative', overflow: 'hidden',
    }}>

      {/* 装饰光球 */}
      <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, #a855f720 0%, transparent 70%)', top:-80, left:-80, pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:250, height:250, borderRadius:'50%', background:'radial-gradient(circle, #06b6d420 0%, transparent 70%)', bottom:-60, right:-60, pointerEvents:'none' }} />

      {/* 星星 */}
      {[...Array(25)].map((_,i)=>(
        <div key={i} style={{
          position:'absolute', borderRadius:'50%',
          width: Math.random()*2+1, height: Math.random()*2+1,
          background:'#fff', opacity: Math.random()*0.5+0.2,
          left:`${Math.random()*100}%`, top:`${Math.random()*100}%`,
          animation:`twinkle ${2+Math.random()*3}s ${Math.random()*3}s ease-in-out infinite`,
          pointerEvents:'none',
        }}/>
      ))}

      {/* LOGO */}
      <div style={{ textAlign:'center', marginBottom: inRoom ? 28 : 36, position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginBottom:6 }}>
          {['♠','♥','♦','♣'].map((s,i)=>(
            <span key={i} style={{ fontSize:22, color: i%2?'#ef4444':'#f0f0f0', filter:`drop-shadow(0 0 6px ${i%2?'#ef4444':'#a855f7'})` }}>{s}</span>
          ))}
        </div>
        <div style={{
          fontSize: 42, fontWeight: 900, letterSpacing: 3,
          background: 'linear-gradient(135deg, #f5c842 0%, #fff 40%, #a855f7 100%)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
        }}>河南五十K</div>
        <div style={{ fontSize:12, color:'#666', letterSpacing:4, marginTop:4 }}>HENAN · FIFTY K · 联网对战</div>
      </div>

      {/* 主体内容 */}
      <div style={{ width:'100%', maxWidth:340, position:'relative', zIndex:1 }}>

        {/* 首页 */}
        {view === 'home' && (
          <div style={{ animation:'slide-up 0.3s ease' }}>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, color:'#888', marginBottom:6, display:'block' }}>你的昵称</label>
              <input
                value={name} maxLength={8}
                onChange={e=>setName(e.target.value)}
                placeholder="输入昵称..."
                style={{
                  width:'100%', padding:'12px 16px', borderRadius:12, fontSize:15,
                  background:'#ffffff0d', border:'1px solid #ffffff22', color:'#f0f0f0',
                  outline:'none',
                }}
              />
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <button onClick={()=>{ if(!name.trim()){alert('请输入昵称');return;} setView('create'); }} style={{
                flex:1, padding:'14px 0', borderRadius:14, fontWeight:700, fontSize:15,
                background:'linear-gradient(135deg, #a855f7, #7c3aed)',
                color:'#fff', boxShadow:'0 4px 20px #a855f766',
                border:'none', transition:'all 0.2s',
              }}>🏠 创建房间</button>
              <button onClick={()=>{ if(!name.trim()){alert('请输入昵称');return;} setView('join'); }} style={{
                flex:1, padding:'14px 0', borderRadius:14, fontWeight:700, fontSize:15,
                background:'linear-gradient(135deg, #0891b2, #06b6d4)',
                color:'#fff', boxShadow:'0 4px 20px #06b6d466',
                border:'none', transition:'all 0.2s',
              }}>🚪 加入房间</button>
            </div>
            <div style={{ textAlign:'center', marginTop:20, fontSize:11, color:'#444' }}>支持3~4人联网对战 · 不同网络均可</div>
          </div>
        )}

        {/* 创建房间 */}
        {view === 'create' && !inRoom && (
          <div style={{ animation:'slide-up 0.3s ease' }}>
            <div style={{ textAlign:'center', marginBottom:20, fontSize:15, color:'#888' }}>选择游戏人数</div>
            <div style={{ display:'flex', gap:14 }}>
              <button onClick={()=>createRoom(3)} style={{
                flex:1, padding:'28px 0', borderRadius:16, fontWeight:700, fontSize:18,
                background:'linear-gradient(135deg, #1a3a2a, #0f2a1a)',
                border:'2px solid #22c55e66', color:'#22c55e',
                boxShadow:'0 0 20px #22c55e22', display:'flex', flexDirection:'column', alignItems:'center', gap:8,
              }}>
                <span style={{ fontSize:32 }}>👥</span>
                <span>三人局</span>
                <span style={{ fontSize:12, color:'#555', fontWeight:400 }}>每人36张</span>
              </button>
              <button onClick={()=>createRoom(4)} style={{
                flex:1, padding:'28px 0', borderRadius:16, fontWeight:700, fontSize:18,
                background:'linear-gradient(135deg, #1a1a3a, #0f0f2a)',
                border:'2px solid #a855f766', color:'#a855f7',
                boxShadow:'0 0 20px #a855f722', display:'flex', flexDirection:'column', alignItems:'center', gap:8,
              }}>
                <span style={{ fontSize:32 }}>👨‍👩‍👧‍👦</span>
                <span>四人局</span>
                <span style={{ fontSize:12, color:'#555', fontWeight:400 }}>每人27张</span>
              </button>
            </div>
            <button onClick={()=>setView('home')} style={{ marginTop:16, background:'none', color:'#555', fontSize:13, border:'none', width:'100%', padding:'8px 0' }}>← 返回</button>
          </div>
        )}

        {/* 加入房间 */}
        {view === 'join' && !inRoom && (
          <div style={{ animation:'slide-up 0.3s ease' }}>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, color:'#888', marginBottom:6, display:'block' }}>6位房间号</label>
              <input
                value={joinId} maxLength={6}
                onChange={e=>setJoinId(e.target.value.replace(/\D/g,'').slice(0,6))}
                placeholder="输入房间号..."
                style={{
                  width:'100%', padding:'14px 16px', borderRadius:12, fontSize:22, letterSpacing:8,
                  background:'#ffffff0d', border:'1px solid #ffffff22', color:'#f5c842',
                  outline:'none', textAlign:'center', fontWeight:700,
                }}
              />
            </div>
            <button onClick={joinRoom} style={{
              width:'100%', padding:'14px 0', borderRadius:14, fontWeight:700, fontSize:16,
              background: joinId.length===6 ? 'linear-gradient(135deg, #0891b2, #a855f7)' : '#1a1a1a',
              color: joinId.length===6 ? '#fff' : '#444',
              border:'none', boxShadow: joinId.length===6 ? '0 4px 20px #0891b266' : 'none',
              transition:'all 0.3s',
            }}>进入房间 →</button>
            <button onClick={()=>setView('home')} style={{ marginTop:12, background:'none', color:'#555', fontSize:13, border:'none', width:'100%', padding:'8px 0' }}>← 返回</button>
          </div>
        )}

        {/* 房间等待 */}
        {inRoom && (
          <div style={{ animation:'slide-up 0.3s ease' }}>
            <div style={{
              background:'#ffffff06', border:'1px solid #ffffff11', borderRadius:16, padding:18, marginBottom:16,
              backdropFilter:'blur(10px)',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <span style={{ fontSize:12, color:'#666' }}>房间号</span>
                <span style={{ fontSize:26, fontWeight:900, color:'#f5c842', letterSpacing:6, textShadow:'0 0 10px #f5c84288' }}>{gameState.id}</span>
              </div>
              <div style={{ fontSize:11, color:'#555', marginBottom:10 }}>玩家 {gameState.players.length}/{gameState.maxPlayers}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {gameState.players.map((p,i)=>(
                  <div key={p.id} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10,
                    background: p.id===myInfo.playerId ? '#a855f711' : '#ffffff06',
                    border:`1px solid ${p.id===myInfo.playerId ? '#a855f744' : '#ffffff0a'}`,
                  }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:avatarColors[i], display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, color:'#fff', flexShrink:0 }}>{p.name[0]}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:600 }}>{p.name} {p.id===myInfo.playerId?<span style={{fontSize:11,color:'#a855f7'}}>(我)</span>:''}</div>
                      <div style={{ fontSize:11, color:'#555' }}>{i===0?'👑 房主':'玩家'}</div>
                    </div>
                    <div style={{ fontSize:11, color:p.isOnline?'#22c55e':'#ef4444' }}>● {p.isOnline?'在线':'离线'}</div>
                  </div>
                ))}
                {[...Array(gameState.maxPlayers - gameState.players.length)].map((_,i)=>(
                  <div key={i} style={{ padding:'10px 12px', borderRadius:10, border:'1px dashed #ffffff11', color:'#444', fontSize:13, textAlign:'center' }}>
                    等待玩家加入...
                  </div>
                ))}
              </div>
            </div>
            {isHost && gameState.players.length >= 3 ? (
              <button onClick={()=>send({type:'start_game'})} style={{
                width:'100%', padding:'15px 0', borderRadius:14, fontWeight:800, fontSize:17,
                background:'linear-gradient(135deg, #f5c842, #e8a020)',
                color:'#0d1117', border:'none', boxShadow:'0 4px 24px #f5c84266',
                animation:'glow-pulse 2s infinite',
              }}>🚀 开始游戏</button>
            ) : isHost ? (
              <div style={{ textAlign:'center', color:'#555', fontSize:13, padding:'12px 0' }}>至少需要 3 名玩家才能开始</div>
            ) : (
              <div style={{ textAlign:'center', color:'#555', fontSize:13, padding:'12px 0' }}>等待房主开始游戏...</div>
            )}
          </div>
        )}
      </div>

      <div style={{ position:'absolute', bottom:16, fontSize:11, color:'#333', letterSpacing:2, zIndex:1 }}>HENAN 50K · v1.0</div>
    </div>
  );
}
