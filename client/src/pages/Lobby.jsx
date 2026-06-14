import React, { useState } from 'react';

const btn = (extra = {}) => ({
  padding: '12px 28px', borderRadius: 12, fontWeight: 700, fontSize: 15,
  border: '1px solid', cursor: 'pointer', transition: 'all 0.2s', ...extra,
});

export default function Lobby({ send, gameState, myInfo }) {
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [mode, setMode] = useState(null); // null | 'create' | 'join'

  const inRoom = myInfo && gameState;
  const isHost = inRoom && gameState.players[0]?.id === myInfo.playerId;

  function createRoom(maxPlayers) {
    if (!name.trim()) { alert('请输入昵称'); return; }
    send({ type: 'create_room', playerName: name.trim(), maxPlayers });
  }

  function joinRoom() {
    if (!name.trim()) { alert('请输入昵称'); return; }
    if (!joinId.trim()) { alert('请输入房间号'); return; }
    send({ type: 'join_room', roomId: joinId.trim(), playerName: name.trim() });
  }

  const inputStyle = {
    background: '#ffffff11', border: '1px solid #00d4ff44', borderRadius: 10,
    color: '#e8f0ff', padding: '10px 14px', fontSize: 15, width: '100%',
    outline: 'none',
  };

  return (
    <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>

      {/* 标题 */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 14, letterSpacing: 6, color: '#00d4ffaa', marginBottom: 8 }}>HENAN</div>
        <div style={{
          fontSize: 48, fontWeight: 900, letterSpacing: 4,
          background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ffd700)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          textShadow: 'none', filter: 'drop-shadow(0 0 20px #00d4ff88)',
        }}>河南五十K</div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#6888aa', letterSpacing: 2 }}>多人联网卡牌对战</div>
      </div>

      {!inRoom ? (
        <div style={{ width: '100%', maxWidth: 360 }}>
          {/* 昵称输入 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#6888aa', marginBottom: 6 }}>你的昵称</div>
            <input
              style={inputStyle} value={name} placeholder="输入昵称..."
              onChange={e => setName(e.target.value)}
              maxLength={8}
            />
          </div>

          {!mode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={() => setMode('create')} style={btn({
                background: 'linear-gradient(135deg, #00d4ff22, #00d4ff11)',
                borderColor: '#00d4ff', color: '#00d4ff',
                boxShadow: '0 0 12px #00d4ff44',
              })}>
                🏠 创建房间
              </button>
              <button onClick={() => setMode('join')} style={btn({
                background: 'linear-gradient(135deg, #7c3aed22, #7c3aed11)',
                borderColor: '#7c3aed', color: '#a78bfa',
                boxShadow: '0 0 12px #7c3aed44',
              })}>
                🚪 加入房间
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div style={{ animation: 'fade-in 0.3s ease' }}>
              <div style={{ fontSize: 13, color: '#6888aa', marginBottom: 12 }}>选择人数</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => createRoom(3)} style={{ ...btn({ flex: 1, borderColor: '#00d4ff', color: '#00d4ff', background: '#00d4ff11', boxShadow: '0 0 10px #00d4ff33' }) }}>
                  三人局
                </button>
                <button onClick={() => createRoom(4)} style={{ ...btn({ flex: 1, borderColor: '#7c3aed', color: '#a78bfa', background: '#7c3aed11', boxShadow: '0 0 10px #7c3aed33' }) }}>
                  四人局
                </button>
              </div>
              <button onClick={() => setMode(null)} style={{ marginTop: 12, background: 'none', color: '#6888aa', fontSize: 13, border: 'none', width: '100%' }}>返回</button>
            </div>
          )}

          {mode === 'join' && (
            <div style={{ animation: 'fade-in 0.3s ease' }}>
              <div style={{ fontSize: 12, color: '#6888aa', marginBottom: 6 }}>房间号</div>
              <input
                style={{ ...inputStyle, marginBottom: 12 }}
                value={joinId} placeholder="输入6位房间号..."
                onChange={e => setJoinId(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <button onClick={joinRoom} style={btn({
                width: '100%', background: 'linear-gradient(135deg, #7c3aed, #00d4ff)',
                borderColor: 'transparent', color: '#fff', boxShadow: '0 0 16px #7c3aed88',
              })}>
                加入游戏
              </button>
              <button onClick={() => setMode(null)} style={{ marginTop: 12, background: 'none', color: '#6888aa', fontSize: 13, border: 'none', width: '100%' }}>返回</button>
            </div>
          )}
        </div>
      ) : (
        /* 房间等待界面 */
        <div style={{ width: '100%', maxWidth: 360, animation: 'fade-in 0.3s ease' }}>
          <div style={{
            background: '#ffffff08', border: '1px solid #00d4ff33', borderRadius: 16,
            padding: 20, marginBottom: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#6888aa' }}>房间号</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#ffd700', letterSpacing: 4, textShadow: '0 0 10px #ffd70088' }}>
                {gameState.id}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#6888aa', marginBottom: 8 }}>玩家 ({gameState.players.length}/{gameState.maxPlayers})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gameState.players.map((p, i) => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 10,
                  background: p.id === myInfo.playerId ? '#00d4ff11' : '#ffffff06',
                  border: `1px solid ${p.id === myInfo.playerId ? '#00d4ff44' : '#ffffff11'}`,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: `hsl(${i * 90}, 70%, 50%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700,
                  }}>{p.name[0]}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#6888aa' }}>{i === 0 ? '房主' : '玩家'}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 11, color: p.isOnline ? '#00ff88' : '#ff4466' }}>
                    {p.isOnline ? '● 在线' : '● 离线'}
                  </div>
                </div>
              ))}
              {/* 空槽位 */}
              {[...Array(gameState.maxPlayers - gameState.players.length)].map((_, i) => (
                <div key={i} style={{
                  padding: '8px 12px', borderRadius: 10,
                  background: '#ffffff03', border: '1px dashed #ffffff11',
                  color: '#6888aa', fontSize: 13, textAlign: 'center',
                }}>等待玩家加入...</div>
              ))}
            </div>
          </div>

          {isHost && gameState.players.length >= 3 && (
            <button onClick={() => send({ type: 'start_game' })} style={btn({
              width: '100%', fontSize: 17,
              background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
              borderColor: 'transparent', color: '#fff',
              boxShadow: '0 0 24px #00d4ff88', animation: 'pulse-glow 2s infinite',
            })}>
              🚀 开始游戏
            </button>
          )}
          {isHost && gameState.players.length < 3 && (
            <div style={{ textAlign: 'center', color: '#6888aa', fontSize: 13 }}>
              等待玩家加入（至少3人）...
            </div>
          )}
          {!isHost && (
            <div style={{ textAlign: 'center', color: '#6888aa', fontSize: 13 }}>
              等待房主开始游戏...
            </div>
          )}
        </div>
      )}

      {/* 底部装饰 */}
      <div style={{ position: 'absolute', bottom: 20, color: '#ffffff22', fontSize: 11 }}>
        ♠ ♥ ♦ ♣ · 河南五十K v1.0
      </div>
    </div>
  );
}
