import React, { useState, useCallback, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Settlement from './pages/Settlement';

export default function App() {
  const [page, setPage] = useState('lobby');
  const [gameState, setGameState] = useState(null);
  const [myHand, setMyHand] = useState([]);
  const [myInfo, setMyInfo] = useState(null);
  const [settlementData, setSettlementData] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const toast = useCallback((text, type = 'info') => {
    const id = toastId.current++;
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800);
  }, []);

  const onMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'room_joined':
        setMyInfo({ playerId: msg.playerId, roomId: msg.roomId, playerIndex: msg.playerIndex });
        break;
      case 'room_update':
        setGameState(msg.state);
        if (msg.state.status === 'waiting') setPage('lobby');
        break;
      case 'game_start':
        setGameState(msg.state);
        setPage('game');
        toast('游戏开始！', 'success');
        break;
      case 'your_hand':
        setMyHand(msg.hand);
        break;
      case 'turn_change':
        setGameState(s => s ? { ...s, currentPlayer: msg.currentPlayer } : s);
        break;
      case 'cards_played':
        setGameState(msg.state);
        if (msg.pattern?.type === 'bomb') toast('💥 ' + msg.playerName + ' 打出炸弹！', 'bomb');
        break;
      case 'player_passed':
        toast(msg.playerName + ' 过牌', 'dim');
        break;
      case 'pile_won':
        setGameState(msg.state);
        if (msg.score > 0) toast(msg.winnerName + ' 赢得 ' + msg.score + ' 分！', 'gold');
        break;
      case 'round_end':
        setSettlementData(msg.result);
        setGameState(msg.state);
        setPage('settlement');
        break;
      case 'error':
        toast(msg.msg, 'error');
        break;
    }
  }, [toast]);

  const { send, connected } = useWebSocket(onMessage);

  const toastColors = { info: '#00e5ff', success: '#22c55e', error: '#ef4444', gold: '#f5c842', bomb: '#ff6b35', dim: '#888' };

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* 连接指示灯 */}
      <div style={{
        position: 'fixed', top: 10, right: 12, zIndex: 1000,
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 11, color: connected ? '#22c55e' : '#ef4444',
        background: '#00000066', backdropFilter: 'blur(8px)',
        padding: '3px 10px', borderRadius: 20,
        border: `1px solid ${connected ? '#22c55e44' : '#ef444444'}`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#22c55e' : '#ef4444', display: 'inline-block', animation: connected ? 'none' : 'pulse 1s infinite' }} />
        {connected ? '已连接' : '连接中'}
      </div>

      {/* Toast 通知 */}
      <div style={{ position: 'fixed', top: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '8px 20px', borderRadius: 24, fontWeight: 600, fontSize: 14,
            color: toastColors[t.type] || '#fff',
            background: '#111827ee', backdropFilter: 'blur(8px)',
            border: `1px solid ${toastColors[t.type] || '#fff'}44`,
            boxShadow: `0 4px 20px ${toastColors[t.type] || '#fff'}33`,
            animation: 'float-up 2.8s ease-out forwards',
            whiteSpace: 'nowrap',
          }}>{t.text}</div>
        ))}
      </div>

      {page === 'lobby' && <Lobby send={send} gameState={gameState} myInfo={myInfo} />}
      {page === 'game' && <Game send={send} gameState={gameState} myHand={myHand} setMyHand={setMyHand} myInfo={myInfo} toast={toast} />}
      {page === 'settlement' && <Settlement data={settlementData} send={send} myInfo={myInfo} gameState={gameState} />}
    </div>
  );
}
