import React, { useState, useCallback, useEffect, useRef } from 'react';
import Card from '../components/Card';

const CARD_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'];

function sortCards(cards) {
  return [...cards].sort((a, b) => CARD_ORDER.indexOf(a.rank) - CARD_ORDER.indexOf(b.rank));
}

export default function Game({ send, gameState, myHand, setMyHand, myInfo, addNotif }) {
  const [selected, setSelected] = useState(new Set());
  const [floatScores, setFloatScores] = useState([]);
  const [isBomb, setIsBomb] = useState(false);
  const floatId = useRef(0);

  const me = gameState?.players?.find(p => p.id === myInfo?.playerId);
  const myIdx = gameState?.players?.findIndex(p => p.id === myInfo?.playerId) ?? -1;
  const isMyTurn = gameState?.currentPlayer === myIdx;
  const isFirstPlay = !gameState?.lastPlay;

  useEffect(() => {
    if (isMyTurn) {
      // 轻微震动提示
      if (navigator.vibrate) navigator.vibrate(100);
    }
  }, [isMyTurn, gameState?.currentPlayer]);

  // 监听赢墩，添加飘分
  const prevPileScores = useRef({});
  useEffect(() => {
    if (!gameState) return;
    gameState.players.forEach(p => {
      const prev = prevPileScores.current[p.id] ?? 0;
      if (p.score > prev) {
        const diff = p.score - prev;
        const id = floatId.current++;
        setFloatScores(fs => [...fs, { id, text: `+${diff}`, color: '#ffd700' }]);
        setTimeout(() => setFloatScores(fs => fs.filter(f => f.id !== id)), 2000);
      }
      prevPileScores.current[p.id] = p.score;
    });
  }, [gameState?.players?.map(p => p.score).join(',')]);

  const toggleCard = useCallback((cardId) => {
    setSelected(s => {
      const n = new Set(s);
      if (n.has(cardId)) n.delete(cardId); else n.add(cardId);
      return n;
    });
  }, []);

  function playCards() {
    if (selected.size === 0) return;
    const cardIds = [...selected];
    send({ type: 'play_cards', cardIds });
    // 乐观更新手牌
    setMyHand(h => h.filter(c => !cardIds.includes(c.id)));
    setSelected(new Set());
    // 检查炸弹
    if (selected.size >= 4 || selected.size === 2) {
      const cards = myHand.filter(c => cardIds.includes(c.id));
      const ranks = new Set(cards.map(c => c.rank));
      if (ranks.size === 1 && cards.length >= 4) { setIsBomb(true); setTimeout(() => setIsBomb(false), 600); }
      if (cards.some(c => c.rank === '大王') && cards.some(c => c.rank === '小王')) {
        setIsBomb(true); setTimeout(() => setIsBomb(false), 600);
      }
    }
  }

  function pass() {
    send({ type: 'pass' });
    setSelected(new Set());
  }

  function hint() {
    // 简单提示：选第一张牌
    if (myHand.length > 0) setSelected(new Set([myHand[0].id]));
  }

  // 对手座位布局（适配3/4人）
  const opponents = gameState?.players?.filter(p => p.id !== myInfo?.playerId) ?? [];
  const lastPlayCards = gameState?.lastPlay;

  return (
    <div style={{
      position: 'relative', zIndex: 1, height: '100%',
      display: 'flex', flexDirection: 'column',
      animation: isBomb ? 'shake 0.3s ease' : undefined,
    }}>
      {/* 炸弹特效 */}
      {isBomb && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'radial-gradient(circle, #ff446688 0%, transparent 70%)',
          animation: 'bomb-explode 0.6s ease-out forwards',
          pointerEvents: 'none',
        }}>
          <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 60, animation: 'bomb-explode 0.6s ease-out forwards' }}>💥</div>
        </div>
      )}

      {/* 飘分 */}
      <div style={{ position: 'fixed', top: '35%', left: '50%', transform: 'translateX(-50%)', zIndex: 40, pointerEvents: 'none' }}>
        {floatScores.map(f => (
          <div key={f.id} style={{ color: f.color, fontWeight: 900, fontSize: 28, textShadow: `0 0 10px ${f.color}`, animation: 'float-up 2s ease-out forwards', textAlign: 'center' }}>{f.text}</div>
        ))}
      </div>

      {/* 顶部：得分面板 + 对手 */}
      <div style={{ padding: '8px 12px 0', flexShrink: 0 }}>
        {/* 得分面板 */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap',
        }}>
          {gameState?.players?.map((p, i) => (
            <div key={p.id} style={{
              flex: 1, minWidth: 70, padding: '5px 8px', borderRadius: 8,
              background: gameState.currentPlayer === i ? '#00d4ff22' : '#ffffff08',
              border: `1px solid ${gameState.currentPlayer === i ? '#00d4ff' : '#ffffff11'}`,
              boxShadow: gameState.currentPlayer === i ? '0 0 10px #00d4ff44' : 'none',
              transition: 'all 0.3s',
            }}>
              <div style={{ fontSize: 11, color: '#6888aa', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {p.name} {p.id === myInfo?.playerId ? '(我)' : ''}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#ffd700' }}>{p.score}分</div>
              <div style={{ fontSize: 10, color: '#6888aa' }}>剩{p.cardCount}张</div>
            </div>
          ))}
        </div>

        {/* 对手手牌（背面）*/}
        <div style={{ display: 'flex', justifyContent: 'space-around', gap: 8, marginBottom: 6 }}>
          {opponents.map((opp, oi) => (
            <div key={opp.id} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 11, color: opp.isOnline ? '#6888aa' : '#ff4466', marginBottom: 4 }}>
                {opp.name} · {opp.cardCount}张
                {gameState.currentPlayer === gameState.players.findIndex(p => p.id === opp.id) && (
                  <span style={{ color: '#00d4ff', marginLeft: 4, animation: 'pulse-glow 1s infinite' }}>▶</span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 2 }}>
                {[...Array(Math.min(opp.cardCount, 10))].map((_, i) => (
                  <div key={i} style={{
                    width: 18, height: 26, borderRadius: 3,
                    background: 'linear-gradient(135deg, #1a2a5e, #0d1a3a)',
                    border: '1px solid #00d4ff22',
                  }} />
                ))}
                {opp.cardCount > 10 && <span style={{ color: '#6888aa', fontSize: 10, alignSelf: 'center' }}>+{opp.cardCount - 10}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 中间出牌区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {/* 轮到我时的发光提示 */}
        {isMyTurn && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, border: '2px solid #00d4ff', borderRadius: 0, boxShadow: 'inset 0 0 30px #00d4ff22', pointerEvents: 'none', animation: 'pulse-glow 1.5s infinite' }} />
        )}

        {gameState?.lastPlay ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#6888aa', marginBottom: 8 }}>
              {gameState.players.find(p => p.id === gameState.lastPlayerId)?.name} 出牌
            </div>
            <LastPlayDisplay gameState={gameState} myInfo={myInfo} />
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, opacity: 0.15 }}>🃏</div>
            <div style={{ fontSize: 13, color: '#6888aa' }}>
              {isMyTurn ? '✨ 你先手，出任意牌型' : '等待出牌...'}
            </div>
          </div>
        )}

        {isMyTurn && (
          <div style={{
            marginTop: 12, padding: '6px 20px', borderRadius: 20,
            background: '#00d4ff22', border: '1px solid #00d4ff',
            color: '#00d4ff', fontSize: 13, fontWeight: 600,
            animation: 'pulse-glow 1s infinite',
          }}>你的回合</div>
        )}
      </div>

      {/* 底部：我的手牌 + 操作按钮 */}
      <div style={{ flexShrink: 0, background: 'linear-gradient(to top, #050810ee, transparent)', paddingBottom: 8 }}>
        {/* 手牌 */}
        <div style={{ overflowX: 'auto', padding: '0 8px 8px', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', gap: selected.size > 0 ? 4 : 3, paddingTop: 16, paddingBottom: 4, minWidth: 'max-content' }}>
            {myHand.map((card) => (
              <Card
                key={card.id}
                card={card}
                selected={selected.has(card.id)}
                onClick={() => toggleCard(card.id)}
              />
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 10, padding: '0 16px' }}>
          <button onClick={hint} style={{
            flex: 1, padding: '10px 0', borderRadius: 10,
            background: '#ffffff11', border: '1px solid #ffffff22', color: '#6888aa', fontSize: 14,
          }}>提示</button>
          <button onClick={pass} disabled={!isMyTurn || isFirstPlay} style={{
            flex: 1.5, padding: '10px 0', borderRadius: 10,
            background: isMyTurn && !isFirstPlay ? '#ffffff11' : '#ffffff06',
            border: '1px solid #ffffff22',
            color: isMyTurn && !isFirstPlay ? '#e8f0ff' : '#444',
            fontSize: 14, cursor: isMyTurn && !isFirstPlay ? 'pointer' : 'default',
          }}>过牌</button>
          <button onClick={playCards} disabled={!isMyTurn || selected.size === 0} style={{
            flex: 2, padding: '10px 0', borderRadius: 10, fontWeight: 700, fontSize: 15,
            background: isMyTurn && selected.size > 0
              ? 'linear-gradient(135deg, #00d4ff, #7c3aed)'
              : '#ffffff08',
            border: 'none',
            color: isMyTurn && selected.size > 0 ? '#fff' : '#444',
            boxShadow: isMyTurn && selected.size > 0 ? '0 0 16px #00d4ff88' : 'none',
            cursor: isMyTurn && selected.size > 0 ? 'pointer' : 'default',
            transition: 'all 0.2s',
          }}>
            出牌 {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

function LastPlayDisplay({ gameState }) {
  const lp = gameState?.lastPlay;
  const cards = gameState?.lastPlayCards || [];
  if (!lp) return null;

  const typeLabel = { single: '单张', pair: '对子', triple: '三张', straight: '顺子', pairs: '连对', bomb: '炸弹' };
  const isBomb = lp.type === 'bomb';

  return (
    <div style={{
      background: isBomb ? '#ff446611' : '#ffffff08',
      borderRadius: 14,
      border: isBomb ? '1px solid #ff446677' : '1px solid #ffffff15',
      boxShadow: isBomb ? '0 0 24px #ff446666' : 'none',
      padding: '10px 14px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    }}>
      {/* 实际牌面 */}
      {cards.length > 0 ? (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 280 }}>
          {cards.map((card, i) => (
            <MiniCard key={card.id || i} card={card} isBomb={isBomb} />
          ))}
        </div>
      ) : (
        <div style={{ color: isBomb ? '#ff4466' : '#e8f0ff', fontWeight: 700, fontSize: 16 }}>
          {lp.isBiggest ? '👑 双王炸弹' : `${lp.rank} ${typeLabel[lp.type]}`}
        </div>
      )}
      {/* 牌型标签 */}
      <div style={{ fontSize: 11, color: isBomb ? '#ff4466' : '#6888aa', letterSpacing: 1 }}>
        {isBomb ? (lp.isBiggest ? '👑 最大炸弹' : `💥 ${lp.len}张炸弹`) : `${typeLabel[lp.type]}${lp.len ? ` ×${lp.len}` : ''}`}
      </div>
    </div>
  );
}

function MiniCard({ card, isBomb }) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  const isJoker = card.rank === '大王' || card.rank === '小王';
  const color = isJoker ? (card.rank === '大王' ? '#ff4466' : '#00d4ff') : (isRed ? '#cc2244' : '#1a1a2e');
  const textColor = isJoker ? (card.rank === '大王' ? '#ff4466' : '#00d4ff') : (isRed ? '#ee3355' : '#1a1a2e');

  return (
    <div style={{
      width: 36, height: 52, borderRadius: 5,
      background: isBomb ? 'linear-gradient(160deg, #fff5f5, #ffe0e0)' : 'linear-gradient(160deg, #f8f8ff, #e8e8f8)',
      border: isBomb ? '1.5px solid #ff446688' : '1px solid #ccc',
      boxShadow: isBomb ? '0 0 8px #ff446644' : '0 2px 4px #0004',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      position: 'relative', flexShrink: 0,
    }}>
      {isJoker ? (
        <div style={{ textAlign: 'center', color: textColor, fontSize: 9, fontWeight: 900, lineHeight: 1.2 }}>
          {card.rank === '大王' ? '大\n🃏\n王' : '小\n🃏\n王'}
        </div>
      ) : (
        <>
          <div style={{ position: 'absolute', top: 2, left: 3, fontSize: 9, fontWeight: 700, color: textColor, lineHeight: 1 }}>
            <div>{card.rank}</div>
            <div>{card.suit}</div>
          </div>
          <div style={{ fontSize: 14, color: textColor }}>{card.suit}</div>
        </>
      )}
    </div>
  );
}
