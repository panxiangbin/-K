import React, { useState } from 'react';

const AVATAR_COLORS = ['#9333ea','#0891b2','#d97706','#dc2626'];
const AVATARS = ['🐲','🐯','🦊','🐺'];

export default function Lobby({ send, gameState, myInfo }) {
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [view, setView] = useState('home');

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

  // 横屏两栏布局
  return (
    <div style={{
      height:'100%', display:'flex', alignItems:'stretch',
      background:'radial-gradient(ellipse at 30% 50%, #1e1060 0%, #0d1117 55%, #0a1a0f 100%)',
      position:'relative', overflow:'hidden',
      fontFamily:"'PingFang SC','Microsoft YaHei',sans-serif",
    }}>
      {/* 背景装饰 */}
      <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,#9333ea18 0%,transparent 70%)', top:-100, left:-100, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,#0891b218 0%,transparent 70%)', bottom:-80, right:-80, pointerEvents:'none' }}/>

      {/* 左侧 LOGO 区 */}
      <div style={{ width:'42%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderRight:'1px solid #ffffff08', padding:'20px 24px', flexShrink:0 }}>
        {/* 花色装饰 */}
        <div style={{ display:'flex', gap:10, marginBottom:10 }}>
          {['♠','♥','♦','♣'].map((s,i)=>(
            <span key={i} style={{ fontSize:24, color: i%2?'#ef4444':'#e2e2e2', filter:`drop-shadow(0 0 8px ${i%2?'#ef4444':'#9333ea'})` }}>{s}</span>
          ))}
        </div>

        <div style={{
          fontSize:48, fontWeight:900, letterSpacing:4, lineHeight:1,
          background:'linear-gradient(135deg,#f5c842 0%,#fff 45%,#c084fc 100%)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          marginBottom:6,
        }}>河南<br/>五十K</div>

        <div style={{ fontSize:11, color:'#444', letterSpacing:4, marginBottom:20 }}>HENAN · 50K · 联网对战</div>

        {/* 牌面装饰 */}
        <div style={{ display:'flex', gap:6, opacity:.6 }}>
          {['A♠','K♥','Q♦','J♣'].map((c,i)=>(
            <div key={i} style={{
              width:32, height:44, borderRadius:5, background:'#fff',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, fontWeight:800, color: i%2?'#e53935':'#1a1a1a',
              boxShadow:'0 2px 8px #0006',
              transform: `rotate(${(i-1.5)*5}deg)`,
            }}>{c}</div>
          ))}
        </div>

        <div style={{ marginTop:20, fontSize:11, color:'#333', textAlign:'center', lineHeight:1.8 }}>
          支持 3~4 人联网对战<br/>不同网络均可加入
        </div>
      </div>

      {/* 右侧操作区 */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'16px 24px' }}>

        {/* 首页 */}
        {view === 'home' && (
          <div style={{ width:'100%', maxWidth:320, animation:'slide-up .25s ease' }}>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, color:'#666', marginBottom:5, display:'block' }}>你的昵称</label>
              <input
                value={name} maxLength={8}
                onChange={e=>setName(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&name.trim()&&setView('create')}
                placeholder="输入昵称..."
                style={{
                  width:'100%', padding:'11px 14px', borderRadius:10, fontSize:15,
                  background:'#ffffff0d', border:'1px solid #ffffff22', color:'#f0f0f0',
                  outline:'none',
                }}
              />
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>{if(!name.trim()){alert('请输入昵称');return;}setView('create');}} style={{
                flex:1, padding:'13px 0', borderRadius:12, fontWeight:700, fontSize:15,
                background:'linear-gradient(135deg,#9333ea,#7c3aed)',
                color:'#fff', boxShadow:'0 4px 18px #9333ea55', border:'none',
              }}>🏠 创建房间</button>
              <button onClick={()=>{if(!name.trim()){alert('请输入昵称');return;}setView('join');}} style={{
                flex:1, padding:'13px 0', borderRadius:12, fontWeight:700, fontSize:15,
                background:'linear-gradient(135deg,#0891b2,#06b6d4)',
                color:'#fff', boxShadow:'0 4px 18px #0891b255', border:'none',
              }}>🚪 加入房间</button>
            </div>
          </div>
        )}

        {/* 创建房间 */}
        {view === 'create' && !inRoom && (
          <div style={{ width:'100%', maxWidth:320, animation:'slide-up .25s ease' }}>
            <div style={{ textAlign:'center', fontSize:13, color:'#888', marginBottom:14 }}>选择游戏人数</div>
            <div style={{ display:'flex', gap:12 }}>
              <button onClick={()=>createRoom(3)} style={{
                flex:1, padding:'22px 0', borderRadius:14, fontWeight:700, fontSize:16,
                background:'linear-gradient(135deg,#1a3a2a,#0f2a1a)',
                border:'2px solid #22c55e55', color:'#22c55e',
                boxShadow:'0 0 18px #22c55e22', display:'flex', flexDirection:'column', alignItems:'center', gap:6,
              }}>
                <span style={{fontSize:28}}>👥</span>
                三人局
                <span style={{fontSize:11,color:'#555',fontWeight:400}}>每人36张</span>
              </button>
              <button onClick={()=>createRoom(4)} style={{
                flex:1, padding:'22px 0', borderRadius:14, fontWeight:700, fontSize:16,
                background:'linear-gradient(135deg,#1a1a3a,#0f0f2a)',
                border:'2px solid #9333ea55', color:'#9333ea',
                boxShadow:'0 0 18px #9333ea22', display:'flex', flexDirection:'column', alignItems:'center', gap:6,
              }}>
                <span style={{fontSize:28}}>👨‍👩‍👧‍👦</span>
                四人局
                <span style={{fontSize:11,color:'#555',fontWeight:400}}>每人27张</span>
              </button>
            </div>
            <button onClick={()=>setView('home')} style={{ marginTop:12, background:'none', color:'#555', fontSize:13, border:'none', width:'100%', padding:'6px 0' }}>← 返回</button>
          </div>
        )}

        {/* 加入房间 */}
        {view === 'join' && !inRoom && (
          <div style={{ width:'100%', maxWidth:320, animation:'slide-up .25s ease' }}>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, color:'#666', marginBottom:5, display:'block' }}>6位房间号</label>
              <input
                value={joinId} maxLength={6}
                onChange={e=>setJoinId(e.target.value.replace(/\D/g,'').slice(0,6))}
                onKeyDown={e=>e.key==='Enter'&&joinRoom()}
                placeholder="输入房间号..."
                style={{
                  width:'100%', padding:'13px 16px', borderRadius:10, fontSize:24, letterSpacing:10,
                  background:'#ffffff0d', border:'1px solid #ffffff22', color:'#f5c842',
                  outline:'none', textAlign:'center', fontWeight:700,
                }}
              />
            </div>
            <button onClick={joinRoom} style={{
              width:'100%', padding:'13px 0', borderRadius:12, fontWeight:700, fontSize:15,
              background: joinId.length===6 ? 'linear-gradient(135deg,#0891b2,#9333ea)' : '#1a1a1a',
              color: joinId.length===6 ? '#fff' : '#444', border:'none',
              boxShadow: joinId.length===6 ? '0 4px 18px #0891b255' : 'none', transition:'all .25s',
            }}>进入房间 →</button>
            <button onClick={()=>setView('home')} style={{ marginTop:10, background:'none', color:'#555', fontSize:13, border:'none', width:'100%', padding:'6px 0' }}>← 返回</button>
          </div>
        )}

        {/* 等待房间 */}
        {inRoom && (
          <div style={{ width:'100%', maxWidth:360, animation:'slide-up .25s ease' }}>
            <div style={{
              background:'#ffffff06', border:'1px solid #ffffff10', borderRadius:14, padding:16, marginBottom:12,
              backdropFilter:'blur(12px)',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <span style={{ fontSize:11, color:'#555' }}>房间号</span>
                <span style={{ fontSize:28, fontWeight:900, color:'#f5c842', letterSpacing:8, textShadow:'0 0 12px #f5c84266' }}>{gameState.id}</span>
              </div>
              <div style={{ fontSize:10, color:'#555', marginBottom:8 }}>玩家 {gameState.players.length}/{gameState.maxPlayers}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {gameState.players.map((p,i)=>(
                  <div key={p.id} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8,
                    background: p.id===myInfo.playerId ? '#9333ea12' : '#ffffff05',
                    border:`1px solid ${p.id===myInfo.playerId?'#9333ea33':'#ffffff08'}`,
                  }}>
                    <div style={{ width:30, height:30, borderRadius:'50%', background:AVATAR_COLORS[i], display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>{AVATARS[i]}</div>
                    <div style={{ flex:1, fontSize:13, fontWeight:600 }}>
                      {p.name} {p.id===myInfo.playerId&&<span style={{fontSize:10,color:'#c084fc'}}>(我)</span>}
                      {i===0&&<span style={{fontSize:10,color:'#f5c842',marginLeft:4}}>👑</span>}
                    </div>
                    <span style={{ fontSize:10, color:p.isOnline?'#4ade80':'#f87171' }}>● {p.isOnline?'在线':'离线'}</span>
                  </div>
                ))}
                {[...Array(gameState.maxPlayers - gameState.players.length)].map((_,i)=>(
                  <div key={i} style={{ padding:'8px 10px', borderRadius:8, border:'1px dashed #ffffff0d', color:'#333', fontSize:12, textAlign:'center' }}>等待加入...</div>
                ))}
              </div>
            </div>

            {isHost && gameState.players.length >= 3 ? (
              <button onClick={()=>send({type:'start_game'})} style={{
                width:'100%', padding:'13px 0', borderRadius:12, fontWeight:900, fontSize:16,
                background:'linear-gradient(135deg,#f5c842,#e8a020)',
                color:'#0d1117', border:'none', boxShadow:'0 4px 22px #f5c84255',
                animation:'glow-pulse 2s infinite',
              }}>🚀 开始游戏</button>
            ) : isHost ? (
              <div style={{ textAlign:'center', color:'#555', fontSize:12, padding:'10px 0' }}>至少需要 3 名玩家才能开始</div>
            ) : (
              <div style={{ textAlign:'center', color:'#555', fontSize:12, padding:'10px 0' }}>等待房主开始游戏...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
