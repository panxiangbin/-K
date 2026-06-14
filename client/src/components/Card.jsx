import React from 'react';

const SUIT_COLOR = { '♠': '#1a1a2e', '♣': '#1a1a2e', '♥': '#cc2244', '♦': '#cc2244', joker: '#7c3aed' };

export default function Card({ card, selected, onClick, faceDown, small }) {
  if (faceDown) {
    return (
      <div style={{
        width: small ? 28 : 52, height: small ? 40 : 76,
        borderRadius: small ? 4 : 8,
        background: 'linear-gradient(135deg, #1a2a5e, #0d1a3a)',
        border: '1px solid #00d4ff33',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: small ? 10 : 16,
      }}>🂠</div>
    );
  }

  const isJoker = card.rank === '大王' || card.rank === '小王';
  const color = isJoker ? (card.rank === '大王' ? '#ff4466' : '#00d4ff') : SUIT_COLOR[card.suit];
  const textColor = isJoker ? (card.rank === '大王' ? '#ff4466' : '#00d4ff') : (card.suit === '♥' || card.suit === '♦' ? '#ff4466' : '#e8f0ff');

  return (
    <div
      onClick={onClick}
      style={{
        width: small ? 28 : 54, height: small ? 42 : 78,
        borderRadius: small ? 4 : 8,
        background: selected
          ? 'linear-gradient(135deg, #00d4ff22, #7c3aed22)'
          : 'linear-gradient(160deg, #f8f8ff, #e8e8f8)',
        border: selected ? '2px solid #00d4ff' : '1px solid #ccccdd',
        boxShadow: selected
          ? '0 0 16px #00d4ff, 0 4px 12px #0008'
          : '0 2px 8px #0006',
        transform: selected ? 'translateY(-12px)' : 'translateY(0)',
        transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {isJoker ? (
        <div style={{ textAlign: 'center', color: textColor }}>
          <div style={{ fontSize: small ? 8 : 14, fontWeight: 900 }}>{card.rank === '大王' ? '大' : '小'}</div>
          <div style={{ fontSize: small ? 12 : 20 }}>🃏</div>
          <div style={{ fontSize: small ? 8 : 14, fontWeight: 900 }}>{card.rank === '大王' ? '王' : '王'}</div>
        </div>
      ) : (
        <>
          <div style={{ position: 'absolute', top: small ? 2 : 4, left: small ? 3 : 5, lineHeight: 1 }}>
            <div style={{ fontSize: small ? 9 : 13, fontWeight: 700, color: textColor }}>{card.rank}</div>
            <div style={{ fontSize: small ? 8 : 11, color: textColor }}>{card.suit}</div>
          </div>
          <div style={{ fontSize: small ? 14 : 22, color: textColor }}>{card.suit}</div>
          <div style={{ position: 'absolute', bottom: small ? 2 : 4, right: small ? 3 : 5, transform: 'rotate(180deg)', lineHeight: 1 }}>
            <div style={{ fontSize: small ? 9 : 13, fontWeight: 700, color: textColor }}>{card.rank}</div>
            <div style={{ fontSize: small ? 8 : 11, color: textColor }}>{card.suit}</div>
          </div>
        </>
      )}
    </div>
  );
}
