import React from 'react';

const RED = '#ff4444';
const BLACK = '#222222';
const GOLD = '#f5c518';
const SUIT_COLOR = { '♠': BLACK, '♣': BLACK, '♥': RED, '♦': RED };

function JokerCorner({ label, color, mirror = false, tiny = false }) {
  const fontSize = tiny ? 'var(--mini-rank-font, 12px)' : 'var(--card-rank-font, 18px)';
  const suitSize = tiny ? 'var(--mini-suit-font, 9px)' : 'var(--card-suit-font, 14px)';
  return (
    <div style={{
      position: 'absolute',
      top: tiny ? 2 : 4,
      left: tiny ? 2 : 4,
      textAlign: 'center',
      lineHeight: 0.95,
      transform: mirror ? 'rotate(180deg)' : 'none',
      color,
      zIndex: 3,
    }}>
      <div style={{ fontSize, fontWeight: 900 }}>{label}</div>
      <div style={{ fontSize: suitSize, fontWeight: 900 }}>王</div>
    </div>
  );
}

function JokerArtwork({ isBig, tiny = false }) {
  const main = isBig ? '#d92626' : '#4f46e5';
  const accent = isBig ? '#f5c518' : '#8b5cf6';
  const dark = isBig ? '#8f1515' : '#312e81';
  const word = isBig ? 'BIG' : 'JOKER';
  const crownSize = tiny ? 'var(--mini-center-font, 20px)' : 'var(--card-center-font, 36px)';
  const jokerFont = tiny ? '7px' : '9px';

  return (
    <div style={{
      position: 'absolute',
      inset: tiny ? '5px 3px' : '10px 6px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: main,
      opacity: 0.98,
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'relative',
        width: tiny ? '20px' : '34px',
        height: tiny ? '20px' : '34px',
        borderRadius: '50%',
        background: `radial-gradient(circle at 50% 38%, #ffffff 0%, #ffffff 37%, ${accent} 38%, ${accent} 48%, ${main} 49%, ${main} 100%)`,
        boxShadow: `0 1px 4px ${main}55`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: tiny ? 6 : 8,
      }}>
        <div style={{
          position: 'absolute',
          top: tiny ? -8 : -12,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: crownSize,
          lineHeight: 1,
          color: accent,
          textShadow: `0 1px 0 ${dark}`,
        }}>♛</div>
        <div style={{
          position: 'absolute',
          top: tiny ? 6 : 10,
          left: tiny ? 5 : 9,
          width: tiny ? 3 : 4,
          height: tiny ? 3 : 4,
          borderRadius: '50%',
          background: dark,
          boxShadow: `${tiny ? 7 : 12}px 0 0 ${dark}`,
        }} />
        <div style={{
          position: 'absolute',
          bottom: tiny ? 5 : 8,
          width: tiny ? 10 : 16,
          height: tiny ? 4 : 6,
          borderBottom: `2px solid ${dark}`,
          borderRadius: '0 0 50% 50%',
        }} />
      </div>

      <div style={{
        marginTop: tiny ? 2 : 4,
        padding: tiny ? '0 2px' : '1px 4px',
        borderRadius: 999,
        background: `${main}12`,
        border: `1px solid ${main}33`,
        fontSize: jokerFont,
        fontWeight: 900,
        letterSpacing: tiny ? 0 : 0.5,
        color: main,
        transform: tiny ? 'scale(0.9)' : 'none',
      }}>{word}</div>
    </div>
  );
}

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
  const color = isJoker ? (isBigJoker ? '#d92626' : '#4f46e5') : SUIT_COLOR[card.suit];

  const cardStyle = {
    width: cardW,
    height: cardH,
    borderRadius: tiny ? 5 : 8,
    flexShrink: 0,
    background: '#ffffff',
    border: selected ? `3px solid ${GOLD}` : isJoker ? `1px solid ${isBigJoker ? '#f0b4a8' : '#c7d2fe'}` : '1px solid #ddd',
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
        {isJoker ? (
          <>
            <JokerCorner label={isBigJoker ? '大' : '小'} color={color} tiny />
            <JokerArtwork isBig={isBigJoker} tiny />
          </>
        ) : (
          <>
            <div style={{ fontSize: rankFont, fontWeight: 900, color, lineHeight: 1 }}>{card.rank}</div>
            <div style={{ fontSize: suitFont, color, lineHeight: 1 }}>{card.suit}</div>
          </>
        )}
      </div>
    );
  }

  return (
    <div onClick={onClick} style={cardStyle}>
      {isJoker ? (
        <>
          <JokerCorner label={isBigJoker ? '大' : '小'} color={color} />
          <JokerArtwork isBig={isBigJoker} />
          <div style={{ position: 'absolute', bottom: 4, right: 4, width: 20, height: 30, transform: 'rotate(180deg)', zIndex: 3 }}>
            <JokerCorner label={isBigJoker ? '大' : '小'} color={color} />
          </div>
        </>
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
  const color = isJoker ? (isBigJoker ? '#d92626' : '#4f46e5') : SUIT_COLOR[card.suit];

  return (
    <div style={{
      width: 'var(--mini-card-w, 38px)', height: 'var(--mini-card-h, 56px)', borderRadius: 4, flexShrink: 0,
      background: '#ffffff',
      border: isJoker ? `1px solid ${isBigJoker ? '#f0b4a8' : '#c7d2fe'}` : '1px solid #ddd',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
    }}>
      {isJoker ? (
        <>
          <JokerCorner label={isBigJoker ? '大' : '小'} color={color} tiny />
          <JokerArtwork isBig={isBigJoker} tiny />
        </>
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
