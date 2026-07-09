import React from 'react';

const RED = '#ff4444';
const BLACK = '#222222';
const GOLD = '#f5c518';
const SUIT_COLOR = { '♠': BLACK, '♣': BLACK, '♥': RED, '♦': RED };

export default function Card({ card, selected, onClick, faceDown, tiny }) {
  const cardW = tiny ? 'var(--tiny-card-w, 28px)' : 'var(--card-w, 80px)';
  const cardH = tiny ? 'var(--tiny-card-h, 40px)' : 'var(--card-h, 112px)';
  const rankFont = tiny ? 'var(--tiny-rank-font, 12px)' : 'var(--card-rank-font, 18px)';
  const suitFont = tiny ? 'var(--tiny-suit-font, 12px)' : 'var(--card-suit-font, 14px)';
  const centerSuitFont = tiny ? 'var(--tiny-center-font, 20px)' : 'var(--card-center-font, 36px)';

  if (faceDown) {
    return (
      <div style={{
        width: cardW, height: cardH, borderRadius: tiny ? 5 : 6, flexShrink: 0,
        background: '#1a3a6c',
        backgroundImage: 'linear-gradient(45deg, #254a85 25%, transparent 25%), linear-gradient(-45deg, #254a85 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #254a85 75%), linear-gradient(-45deg, transparent 75%, #254a85 75%)',
        backgroundSize: '10px 10px',
        backgroundPosition: '0 0, 0 5px, 5px 5px, 5px 0',
        border: '1px solid #ffffff33',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      }} />
    );
  }

  const isBigJoker = card.rank === '大王';
  const isSmallJoker = card.rank === '小王';
  const isJoker = isBigJoker || isSmallJoker;
  const color = isJoker ? '#ffffff' : SUIT_COLOR[card.suit];

  const cardStyle = {
    width: cardW,
    height: cardH,
    borderRadius: tiny ? 5 : 8,
    flexShrink: 0,
    background: isBigJoker ? 'linear-gradient(135deg, #ff4444, #cc0000)' :
                isSmallJoker ? 'linear-gradient(135deg, #4444ff, #7700cc)' : '#ffffff',
    border: selected ? `3px solid ${GOLD}` : '1px solid #ddd',
    boxShadow: selected ? `0 0 15px ${GOLD}aa, 0 4px 10px rgba(0,0,0,0.3)` : '0 2px 5px rgba(0,0,0,0.2)',
    transform: selected ? 'translateY(var(--card-selected-offset, -16px))' : 'translateY(0)',
    transition: 'all 0.15s ease-out',
    cursor: 'pointer',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    userSelect: 'none',
  };

  if (tiny) {
    return (
      <div onClick={onClick} style={{ ...cardStyle, justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontSize: rankFont, fontWeight: 900, color, lineHeight: 1 }}>{isJoker ? '王' : card.rank}</div>
        {!isJoker && <div style={{ fontSize: suitFont, color, lineHeight: 1 }}>{card.suit}</div>}
      </div>
    );
  }

  return (
    <div onClick={onClick} style={cardStyle}>
      {isJoker ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <div style={{ fontSize: rankFont, fontWeight: 900, letterSpacing: 2 }}>{isBigJoker ? '大' : '小'}</div>
          <div style={{ fontSize: rankFont, fontWeight: 900, letterSpacing: 2 }}>王</div>
        </div>
      ) : (
        <>
          <div style={{ position: 'absolute', top: 4, left: 4, textAlign: 'center', lineHeight: 1 }}>
            <div style={{ fontSize: rankFont, fontWeight: 900, color }}>{card.rank}</div>
            <div style={{ fontSize: suitFont, color }}>{card.suit}</div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: centerSuitFont, color, opacity: 0.9 }}>
            {card.suit}
          </div>
          <div style={{ position: 'absolute', bottom: 4, right: 4, textAlign: 'center', lineHeight: 1, transform: 'rotate(180deg)' }}>
            <div style={{ fontSize: rankFont, fontWeight: 900, color }}>{card.rank}</div>
            <div style={{ fontSize: suitFont, color }}>{card.suit}</div>
          </div>
        </>
      )}
    </div>
  );
}

export function MiniCard({ card }) {
  const isBigJoker = card.rank === '大王';
  const isSmallJoker = card.rank === '小王';
  const isJoker = isBigJoker || isSmallJoker;
  const color = isJoker ? '#ffffff' : SUIT_COLOR[card.suit];

  return (
    <div style={{
      width: 'var(--mini-card-w, 38px)', height: 'var(--mini-card-h, 56px)', borderRadius: 4, flexShrink: 0,
      background: isBigJoker ? 'linear-gradient(135deg, #ff4444, #cc0000)' :
                  isSmallJoker ? 'linear-gradient(135deg, #4444ff, #7700cc)' : '#ffffff',
      border: '1px solid #ddd',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
    }}>
      {isJoker ? (
        <div style={{ fontSize: 'var(--mini-joker-font, 11px)', fontWeight: 900, color: '#fff', textAlign: 'center', lineHeight: 1.1 }}>
          <div>{isBigJoker ? '大' : '小'}</div>
          <div>王</div>
        </div>
      ) : (
        <>
          <div style={{ position: 'absolute', top: 2, left: 2, lineHeight: 1 }}>
            <div style={{ fontSize: 'var(--mini-rank-font, 12px)', fontWeight: 900, color }}>{card.rank}</div>
            <div style={{ fontSize: 'var(--mini-suit-font, 9px)', color }}>{card.suit}</div>
          </div>
          <div style={{ fontSize: 'var(--mini-center-font, 20px)', color, opacity: 0.8 }}>{card.suit}</div>
        </>
      )}
    </div>
  );
}
