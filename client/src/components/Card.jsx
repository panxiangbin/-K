import React from 'react';

const RED = '#dc2626';
const BLACK = '#1e293b';
const SUIT_COLOR = { '♠': BLACK, '♣': BLACK, '♥': RED, '♦': RED };

export default function Card({ card, selected, onClick, faceDown, tiny }) {
  if (faceDown) {
    return (
      <div style={{
        width: tiny?22:50, height: tiny?32:72, borderRadius: tiny?3:7, flexShrink:0,
        background:'linear-gradient(135deg, #1e3a5f 0%, #0f2040 50%, #1a1a3a 100%)',
        border:'1px solid #2a4a7f',
        boxShadow:'0 2px 8px #0006',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        {!tiny && <div style={{ fontSize:16, opacity:0.3 }}>🂠</div>}
      </div>
    );
  }

  const isJoker = card.rank === '大王' || card.rank === '小王';
  const isBig = card.rank === '大王';
  const color = isJoker ? (isBig ? RED : '#7c3aed') : SUIT_COLOR[card.suit];
  const bgColor = selected ? '#fff9f0' : '#ffffff';
  const borderColor = selected ? '#f5c842' : '#ddd';

  return (
    <div onClick={onClick} style={{
      width: tiny?22:52, height: tiny?32:76, borderRadius: tiny?3:8, flexShrink:0,
      background: isJoker
        ? (isBig ? 'linear-gradient(160deg,#fff5f5,#ffe0e0)' : 'linear-gradient(160deg,#f5f0ff,#e8d8ff)')
        : bgColor,
      border: selected ? `2px solid #f5c842` : `1px solid ${borderColor}`,
      boxShadow: selected
        ? '0 0 0 3px #f5c84244, 0 -8px 20px #f5c84233, 0 4px 12px #0006'
        : '0 2px 8px #0005, 0 1px 2px #0003',
      transform: selected ? 'translateY(-14px) scale(1.05)' : 'translateY(0) scale(1)',
      transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
      cursor: 'pointer',
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {isJoker ? (
        <div style={{ textAlign:'center', lineHeight:1.2 }}>
          <div style={{ fontSize: tiny?8:11, fontWeight:900, color }}>
            {isBig ? '大' : '小'}
          </div>
          <div style={{ fontSize: tiny?10:18 }}>🃏</div>
          <div style={{ fontSize: tiny?8:11, fontWeight:900, color }}>王</div>
        </div>
      ) : tiny ? (
        <div style={{ fontSize:10, fontWeight:700, color, textAlign:'center', lineHeight:1 }}>
          <div>{card.rank}</div>
          <div>{card.suit}</div>
        </div>
      ) : (
        <>
          <div style={{ position:'absolute', top:3, left:4, lineHeight:1.1 }}>
            <div style={{ fontSize:13, fontWeight:800, color }}>{card.rank}</div>
            <div style={{ fontSize:11, color }}>{card.suit}</div>
          </div>
          <div style={{ fontSize:24, color, opacity:0.15, position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)' }}>{card.suit}</div>
          <div style={{ position:'absolute', bottom:3, right:4, transform:'rotate(180deg)', lineHeight:1.1 }}>
            <div style={{ fontSize:13, fontWeight:800, color }}>{card.rank}</div>
            <div style={{ fontSize:11, color }}>{card.suit}</div>
          </div>
        </>
      )}
    </div>
  );
}

export function MiniCard({ card }) {
  const isJoker = card.rank === '大王' || card.rank === '小王';
  const isBig = card.rank === '大王';
  const color = isJoker ? (isBig ? RED : '#7c3aed') : SUIT_COLOR[card.suit];
  return (
    <div style={{
      width:38, height:56, borderRadius:6, flexShrink:0,
      background: isJoker ? (isBig?'linear-gradient(160deg,#fff0f0,#ffd0d0)':'linear-gradient(160deg,#f0eeff,#ddd0ff)') : '#fff',
      border:'1px solid #ddd', boxShadow:'0 2px 8px #0004',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      position:'relative', overflow:'hidden',
    }}>
      {isJoker ? (
        <div style={{ textAlign:'center', lineHeight:1.3 }}>
          <div style={{ fontSize:10, fontWeight:900, color }}>{isBig?'大':'小'}</div>
          <div style={{ fontSize:16 }}>🃏</div>
          <div style={{ fontSize:10, fontWeight:900, color }}>王</div>
        </div>
      ) : (
        <>
          <div style={{ position:'absolute', top:2, left:3, lineHeight:1.1 }}>
            <div style={{ fontSize:11, fontWeight:800, color }}>{card.rank}</div>
            <div style={{ fontSize:10, color }}>{card.suit}</div>
          </div>
          <div style={{ fontSize:20, color, opacity:0.12 }}>{card.suit}</div>
        </>
      )}
    </div>
  );
}
