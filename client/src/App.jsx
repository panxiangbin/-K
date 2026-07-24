import React, { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import Lobby from './pages/Lobby';

const preloadGame = () => import('./pages/Game');
const preloadSettlement = () => import('./pages/Settlement');
const Game = lazy(preloadGame);
const Settlement = lazy(preloadSettlement);
const VOICE_VERSION = 'V2';
let recordedBombAudioSrcPromise = null;

function loadRecordedBombAudioSrc() {
  if (!recordedBombAudioSrcPromise) {
    recordedBombAudioSrcPromise = import('./assets/langaishouBase64')
      .then(module => `data:audio/mpeg;base64,${module.default}`)
      .catch(error => {
        recordedBombAudioSrcPromise = null;
        throw error;
      });
  }
  return recordedBombAudioSrcPromise;
}

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

function clearSavedSession(roomId) {
  const targetRoomId = roomId || localStorage.getItem('henan50k:lastRoomId');
  if (targetRoomId) {
    localStorage.removeItem(`henan50k:${targetRoomId}:playerId`);
    localStorage.removeItem(`henan50k:${targetRoomId}:playerToken`);
  }
  localStorage.removeItem('henan50k:lastRoomId');
}

async function playRecordedBombVoice() {
  try {
    if (typeof window === 'undefined') return false;
    const audioSrc = await loadRecordedBombAudioSrc();
    return await new Promise((resolve) => {
      const audio = new Audio(audioSrc);
      audio.volume = 1;
      audio.preload = 'auto';
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        audio.onplaying = null;
        audio.onerror = null;
        resolve(ok);
      };
      audio.onplaying = () => finish(true);
      audio.onerror = () => finish(false);
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => finish(false));
      setTimeout(() => finish(false), 1200);
    });
  } catch {
    return false;
  }
}

async function playBombLine() {
  return playRecordedBombVoice();
}

function ScreenLoader() {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#facc15', background: '#052e22', fontWeight: 800 }}>
      正在加载牌桌…
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('lobby');
  const [gameState, setGameState] = useState(null);
  const [myHand, setMyHand] = useState([]);
  const [myInfo, setMyInfo] = useState(null);
  const [settlementData, setSettlementData] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('henan50k:soundOn') === '1');
  const [reconnectEpoch, setReconnectEpoch] = useState(0);
  const tid = useRef(0);
  const autoRejoinTried = useRef(false);

  const toast = useCallback((text, type = 'info') => {
    const id = tid.current++;
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2500);
  }, []);

  const enableSound = useCallback(async () => {
    localStorage.setItem('henan50k:soundOn', '1');
    setSoundOn(true);
    const ok = await playBombLine();
    toast(ok ? `人声${VOICE_VERSION}已开启：以后炸弹会喊“懒干受”` : `人声${VOICE_VERSION}播放被浏览器拦截，请再点一次测试人声`, ok ? 'success' : 'dim');
  }, [toast]);

  const resetToLobby = useCallback(() => {
    setPage('lobby');
    setGameState(null);
    setMyHand([]);
    setMyInfo(null);
    setSettlementData(null);
    setReconnectEpoch(0);
    autoRejoinTried.current = false;
  }, []);

  const onMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'room_joined':
        savePlayerSession(msg);
        setMyInfo({ playerId: msg.playerId, playerToken: msg.playerToken, roomId: msg.roomId, playerIndex: msg.playerIndex });
        if (msg.reconnect) {
          setToasts([]);
          setReconnectEpoch(epoch => epoch + 1);
          toast('已回到房间，操作状态已刷新', 'success');
        }
        break;
      case 'room_left':
        clearSavedSession(msg.roomId);
        resetToLobby();
        toast('已退出房间', 'success');
        break;
      case 'room_update':
        setGameState(msg.state);
        if (msg.state.status === 'waiting') { setPage('lobby'); setMyHand([]); setSettlementData(null); }
        else if (msg.state.status === 'playing') setPage('game');
        else if (msg.state.status === 'settlement') setPage('settlement');
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
        if (msg.pattern?.type === 'bomb') {
          toast('💥 ' + msg.playerName + ' 炸弹！懒干受！', 'bomb');
          if (soundOn) {
            playBombLine().then(ok => {
              if (!ok) toast(`人声${VOICE_VERSION}被浏览器拦截，请点右上角“测试人声V2”`, 'dim');
            });
          } else {
            toast('点右上角“测试人声V2”一次，炸弹就会喊话', 'dim');
          }
        }
        break;
      case 'player_finished':
        toast(`🏁 ${msg.playerName} 第${msg.finishRank}名出完`, 'gold');
        break;
      case 'player_passed':
        if (msg.state) setGameState(msg.state);
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
  }, [toast, resetToLobby, soundOn]);

  const { send, connected } = useWebSocket(onMessage);

  useEffect(() => {
    if (!connected) { autoRejoinTried.current = false; return; }
    if (autoRejoinTried.current) return;
    const saved = myInfo?.roomId && myInfo?.playerId && myInfo?.playerToken
      ? { roomId: myInfo.roomId, playerId: myInfo.playerId, playerToken: myInfo.playerToken }
      : null;
    if (!saved) return;
    autoRejoinTried.current = true;
    const ok = send({ type: 'join_room', roomId: saved.roomId, playerId: saved.playerId, playerToken: saved.playerToken, playerName: '' });
    if (ok) toast('正在恢复连接...', 'info');
  }, [connected, myInfo, send, toast]);

  useEffect(() => {
    if (page !== 'lobby') return undefined;

    // 首屏渲染完成后再利用浏览器空闲时间下载牌桌代码：
    // 不增加大厅首屏阻塞，但用户创建/加入房间时通常已准备好牌桌。
    let cancelled = false;
    const warmGame = () => {
      if (!cancelled) preloadGame().catch(() => {});
    };
    const idleId = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(warmGame, { timeout: 1800 })
      : window.setTimeout(warmGame, 900);

    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
    };
  }, [page]);

  useEffect(() => {
    if (page !== 'game') return undefined;

    // 游戏进行时后台预热结算页，避免回合结束后再等待第二个代码块。
    const timer = window.setTimeout(() => {
      preloadSettlement().catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [page]);

  const continueLastRoom = useCallback(() => {
    const saved = loadLastSession();
    if (!saved) { toast('没有可继续的房间', 'dim'); return; }
    send({ type: 'join_room', roomId: saved.roomId, playerId: saved.playerId, playerToken: saved.playerToken, playerName: '' });
  }, [send, toast]);

  const returnToLobby = useCallback(() => {
    setPage('lobby');
    toast('已返回大厅，房间仍保留', 'info');
  }, [toast]);

  const exitRoom = useCallback(() => {
    const roomId = myInfo?.roomId || gameState?.id;
    send({ type: 'leave_room' });
    clearSavedSession(roomId);
    resetToLobby();
  }, [send, myInfo, gameState, resetToLobby]);

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
      <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 1000, fontSize: 11, padding: '3px 8px', borderRadius: 12, background: '#00000088', backdropFilter: 'blur(8px)', color: connected ? '#4ade80' : '#f87171', border: `1px solid ${connected ? '#4ade8033' : '#f8717133'}`, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block', animation: connected ? 'none' : 'pulse 1s infinite' }} />
        {connected ? '在线' : '连接中...'}
      </div>

      <button onClick={enableSound} style={{ position:'fixed', top:34, right:8, zIndex:1001, minHeight:30, padding:'0 10px', borderRadius:14, border:'1px solid rgba(251,191,36,.45)', background: soundOn ? 'rgba(20,83,45,.88)' : 'rgba(120,53,15,.88)', color:soundOn ? '#86efac' : '#fbbf24', fontSize:12, fontWeight:900, boxShadow:'0 4px 12px rgba(0,0,0,.25)' }}>
        {soundOn ? `测试人声${VOICE_VERSION}` : `开启人声${VOICE_VERSION}`}
      </button>

      <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 999, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', pointerEvents: 'none' }}>
        {toasts.map(t => {
          const s = TOAST_STYLE[t.type] || TOAST_STYLE.info;
          return <div key={t.id} style={{ padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, color: s.color, background: s.bg + 'ee', border: `1px solid ${s.color}44`, animation: 'floatUp 2.5s ease-out forwards', whiteSpace: 'nowrap', backdropFilter: 'blur(6px)' }}>{t.text}</div>;
        })}
      </div>

      {page === 'lobby' && <Lobby send={send} gameState={gameState} myInfo={myInfo} onContinueLastRoom={continueLastRoom} onExitRoom={exitRoom} />}
      <Suspense fallback={<ScreenLoader />}>
        {page === 'game' && <Game key={`game-${reconnectEpoch}`} send={send} gameState={gameState} myHand={myHand} setMyHand={setMyHand} myInfo={myInfo} toast={toast} onReturnLobby={returnToLobby} onExitRoom={exitRoom} />}
        {page === 'settlement' && <Settlement data={settlementData} send={send} myInfo={myInfo} gameState={gameState} onReturnLobby={returnToLobby} onExitRoom={exitRoom} />}
      </Suspense>
    </div>
  );
}
