import React from 'react';

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣'];

export default function Settlement({ data, send, myInfo, gameState }) {
  if (!data) return null;
  const isHost = gameState?.players?.[0]?.id === myInfo?.playerId;

  return (
    <div style={{
      position: 'relative', zIndex: 1, height: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px', animation: 'fade-in 0.4s ease',
    }}>
      <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6, color: '#ffd700', textShadow: '0 0 20px #ffd70088' }}>
        本局结算
      </div>
      <div style={{ fontSize: 13, color: '#6888aa', marginBottom: 24 }}>第 {gameState?.roundNum} 局</div>

      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {data.map((p, i) => {
          const isMe = p.id === myInfo?.playerId;
          const reached = p.score >= p.target;
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px', borderRadius: 14,
              background: isMe ? '#00d4ff11' : '#ffffff08',
              border: `1px solid ${isMe ? '#00d4ff44' : '#ffffff11'}`,
              boxShadow: i === 0 ? '0 0 20px #ffd70033' : 'none',
              animation: `fade-in ${0.2 + i * 0.1}s ease`,
            }}>
              <div style={{ fontSize: 28 }}>{MEDALS[i]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {p.name} {isMe ? <span style={{ color: '#00d4ff', fontSize: 12 }}>(我)</span> : ''}
                </div>
                <div style={{ fontSize: 12, color: '#6888aa', marginTop: 2 }}>
                  累计 {p.totalScore} 分 · 目标 ≥{p.target} 分
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#ffd700' }}>+{p.score}</div>
                <div style={{ fontSize: 11, color: reached ? '#00ff88' : '#ff4466' }}>
                  {reached ? '✓ 达标' : '✗ 未达标'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isHost ? (
        <button onClick={() => send({ type: 'next_round' })} style={{
          padding: '14px 48px', borderRadius: 14, fontWeight: 700, fontSize: 16,
          background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
          border: 'none', color: '#fff', boxShadow: '0 0 24px #00d4ff88',
          cursor: 'pointer',
        }}>
          继续下一局 →
        </button>
      ) : (
        <div style={{ color: '#6888aa', fontSize: 14 }}>等待房主开始下一局...</div>
      )}
    </div>
  );
}
