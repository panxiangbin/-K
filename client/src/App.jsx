import React, { useState, useCallback, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Settlement from './pages/Settlement';

export default function App() {
  const [page, setPage] = useState('lobby'); // lobby | game | settlement
  const [gameState, setGameState] = useState(null);
  const [myHand, setMyHand] = useState([]);
  const [myInfo, setMyInfo] = useState(null); // { playerId, roomId, playerIndex }
  const [settlementData, setSettlementData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const notifId = useRef(0);

  const addNotif = useCallback((text, color = '#00d4ff') => {
    const id = notifId.current++;
    setNotifications(n => [...n, { id, text, color }]);
    setTimeout(() => setNotifications(n => n.filter(x => x.id !== id)), 2500);
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
        addNotif('游戏开始！', '#00ff88');
        break;
      case 'your_hand':
        setMyHand(msg.hand);
        break;
      case 'turn_change':
        setGameState(s => s ? { ...s, currentPlayer: msg.currentPlayer } : s);
        break;
      case 'cards_played':
        setGameState(msg.state);
        if (msg.pattern?.type === 'bomb') addNotif(`💥 ${msg.playerName} 炸弹！`, '#ff4466');
        break;
      case 'player_passed':
        addNotif(`${msg.playerName} 过牌`, '#6888aa');
        break;
      case 'pile_won':
        setGameState(msg.state);
        if (msg.score > 0) addNotif(`${msg.winnerName} +${msg.score}分`, '#ffd700');
        break;
      case 'round_end':
        setSettlementData(msg.result);
        setGameState(msg.state);
        setPage('settlement');
        break;
      case 'error':
        addNotif(`❌ ${msg.msg}`, '#ff4466');
        break;
    }
  }, [addNotif]);

  const { send, connected } = useWebSocket(onMessage);

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {/* 星空背景 */}
      <StarBg />

      {/* 连接状态 */}
      <div style={{
        position: 'fixed', top: 8, right: 8, zIndex: 999,
        fontSize: 11, color: connected ? '#00ff88' : '#ff4466',
        background: '#0008', padding: '2px 8px', borderRadius: 8,
      }}>
        {connected ? '● 已连接' : '● 连接中...'}
      </div>

      {/* 浮动通知 */}
      <div style={{ position: 'fixed', top: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 999, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', pointerEvents: 'none' }}>
        {notifications.map(n => (
          <div key={n.id} style={{
            color: n.color, fontWeight: 700, fontSize: 16,
            textShadow: `0 0 10px ${n.color}`,
            animation: 'float-up 2.5s ease-out forwards',
            background: '#000a', padding: '4px 16px', borderRadius: 20,
          }}>{n.text}</div>
        ))}
      </div>

      {page === 'lobby' && (
        <Lobby send={send} gameState={gameState} myInfo={myInfo} />
      )}
      {page === 'game' && (
        <Game send={send} gameState={gameState} myHand={myHand} setMyHand={setMyHand} myInfo={myInfo} addNotif={addNotif} />
      )}
      {page === 'settlement' && (
        <Settlement data={settlementData} send={send} myInfo={myInfo} gameState={gameState} />
      )}
    </div>
  );
}

function StarBg() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden',
      background: 'radial-gradient(ellipse at 20% 50%, #0d1a4a 0%, #0a0f2e 60%, #050810 100%)',
      pointerEvents: 'none',
    }}>
      {[...Array(60)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: Math.random() * 2 + 1,
          height: Math.random() * 2 + 1,
          borderRadius: '50%',
          background: '#fff',
          opacity: Math.random() * 0.6 + 0.2,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animation: `pulse-glow ${2 + Math.random() * 3}s ease-in-out infinite`,
          animationDelay: `${Math.random() * 3}s`,
        }} />
      ))}
    </div>
  );
}
