import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Settlement from './pages/Settlement';

function savePlayerSession(msg) {
  if (!msg?.roomId || !msg?.playerId || !msg?.playerToken) return;
  localStorage.setItem('henan50k:lastRoomId', msg.roomId);
  localStorage.setItem(`henan50k:${msg.roomId}:playerId`, msg.playerId);
  localStorage.setItem(`henan50k:${msg.roomId}:playerToken`, msg.playerToken);
}

function loadLastSession() {
  const roomId = localStorage.getItem('henan50k:lastRoomId');
  if (!roomId) return null;
  const playerId = localStorage.getItem(`henan50k:${roomId}:playerId`);
  const playerToken = localStorage.getItem(`henan50k:${roomId}:playerToken`);
  if (!playerId || !playerToken) return null;
  return { roomId, playerId, playerToken };
}

export default function App() {
  const [page, setPage] = useState('lobby');
  const [gameState, setGameState] = useState(null);
  const [myHand, setMyHand] = useState([]);
  const [myInfo, setMyInfo] = useState(null);
  const [settlementData, setSettlementData] = useState(null);
  const [toasts, setToasts] = useState([]);
  const tid = useRef(0);
  const autoRejoinTried = useRef(false);

  const toast = useCallback((text, type = 'info') => {
    const id = tid.current++;
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2500);
  }, []);

  const onMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'room_joined':
        savePlayerSession(msg);
        setMyInfo({
          playerId: msg.playerId,
          playerToken: msg.playerToken,
          roomId: msg.roomId,
          playerIndex: msg.playerIndex,
        });
        if (msg.reconnect) toast('已回到房间', 'success');
        break;
      case 'room_update':
        setGameState(msg.state);
        if (msg.state.status === 'waiting') {
          setPage('lobby');
          setMyHand([]);
          setSettlementData(null);
        } else if (msg.state.status === 'playing') {
          setPage('game');
        } else if (msg.state.status === 'settlement') {
          setPage('settlement');
        }
        break;
      case 'game_start':
        setGameState(msg.state);
        setSettlementData(null);
        setPage('game');
        toast('🎮 游戏开始！', 'success');
        break;
      case 'your_hand':
        setMyHand(msg.hand);
        break;
      case 'turn_change':
        setGameState(s => s ? { ...s, currentPlayer: msg.currentPlayer } : s);
        break;
      case 'cards_played':
        setGameState(msg.state);
        if (msg.pattern?.type === 'bomb') toast('💥 ' + msg.playerName + ' 炸弹！', 'bomb');
        break;
      case 'player_finished':
        toast(`🏁 ${msg.playerName} 第${msg.finishRank}名出完`, 'gold');
        break;
      case 'player_passed':
        toast(msg.playerName + ' 过牌', msg.auto ? 'info' : 'dim');
        break;
      case 'pile_won':
        setGameState(msg.state);
        if (msg.score > 0) toast('🪙 ' + msg.winnerName + ' +' + msg.score + '分', 'gold');
        break;
      case 'round_end':
        setSettlementData(msg.result);
        setGameState(msg.state);
        setTimeout(() => setPage('settlement'), 600);
        break;
      case 'error':
        toast('⚠ ' + msg.msg, 'error');
        break;
      default:
        break;
    }
  }, [toast]);

  const { send, connected } = useWebSocket(onMessage);

  useEffect(() => {
    if (!connected || myInfo || autoRejoinTried.current) return;
    const saved = loadLastSession();
    if (!saved) return;
    autoRejoinTried.current = true;
    const ok = send({ type: 'join_room', roomId: saved.roomId, playerId: saved.playerId, playerToken: saved.playerToken, playerName: '' });
    if (ok) toast('正在回到房间...', 'info');
  }, [connected, myInfo, send, toast]);

  const TOAST_STYLE = {
    info: { color: '#60a5fa', bg: '#1e3a5f' },
    success: { color: '#4ade80', bg: '#14532d' },
    error: { color: '#f87171', bg: '#7f1d1d' },
    gold: { color: '#fbbf24', bg: '#78350f' },
    bomb: { color: '#fb923c', bg: '#7c2d12' },
    dim: { color: '#94a3b8', bg: '#1e293b' },
  };

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* 网络状态 */}
      <div style={{
        position: 'fixed', top: 8, right: 8, zIndex: 1000,
        fontSize: 11, padding: '3px 8px', borderRadius: 12,
        background: '#00000088', backdropFilter: 'blur(8px)',
        color: connected ? '#4ade80' : '#f87171',
        border: `1px solid ${connected ? '#4ade8033' : '#f8717133'}`,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block', animation: connected ? 'none' : 'pulse 1s infinite' }} />
        {connected ? '在线' : '连接中...'}
      </div>

      {/* Toast */}
      <div style={{ position: 'fixed', top: 36, left: '50%', transform: 'translateX(-50%)', zIndex: 999, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', pointerEvents: 'none' }}>
        {toasts.map(t => {
          const s = TOAST_STYLE[t.type] || TOAST_STYLE.info;
          return (
            <div key={t.id} style={{
              padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              color: s.color, background: s.bg + 'ee',
              border: `1px solid ${s.color}44`,
              animation: 'floatUp 2.5s ease-out forwards',
              whiteSpace: 'nowrap', backdropFilter: 'blur(6px)',
            }}>{t.text}</div>
          );
        })}
      </div>

      {page === 'lobby' && <Lobby send={send} gameState={gameState} myInfo={myInfo} />}
      {page === 'game' && <Game send={send} gameState={gameState} myHand={myHand} setMyHand={setMyHand} myInfo={myInfo} toast={toast} />}
      {page === 'settlement' && <Settlement data={settlementData} send={send} myInfo={myInfo} gameState={gameState} />}
    </div>
  );
}
