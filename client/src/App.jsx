import React, { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { scheduleAdaptivePreload } from './adaptive-preload';
import { scheduleSettlementPreload, isSettlementImminent } from './settlement-preload';
import { getGameConnectionGuard, getGlobalConnectionLabel } from './game-connection-guard';
import { getGameChromeState, getTurnAnnouncement } from './game-chrome-state';
import {
  createPlaybackGate,
  getSoundButtonState,
  getSoundToggleResult,
  prefersReducedFeedback,
  readSoundPreference,
  writeSoundPreference,
} from './sound-feedback.js';
import Lobby from './pages/Lobby';

const preloadGame = () => import('./pages/Game');
const preloadSettlement = () => import('./pages/Settlement');
const Game = lazy(preloadGame);
const Settlement = lazy(preloadSettlement);
const VOICE_VERSION = 'V2';
const RECORDED_BOMB_AUDIO_SRC = '/audio/langaishou-v2.mp3';

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
    return await new Promise((resolve) => {
      const audio = new Audio(RECORDED_BOMB_AUDIO_SRC);
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

function GameConnectionGuard({ guard, onReturnLobby }) {
  if (!guard.active) return null;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="game-connection-title"
      aria-describedby="game-connection-message"
      style={{ position:'fixed', inset:0, zIndex:1900, display:'grid', placeItems:'center', padding:20, background:'rgba(2,12,8,.72)', backdropFilter:'blur(5px)' }}
    >
      <div style={{ width:'min(390px, 100%)', borderRadius:22, padding:20, background:'#f8fafc', color:'#0f172a', boxShadow:'0 18px 50px rgba(0,0,0,.45)', textAlign:'center' }}>
        <div aria-hidden="true" style={{ fontSize:34, marginBottom:8 }}>📡</div>
        <div id="game-connection-title" style={{ fontSize:21, fontWeight:900, marginBottom:8 }}>{guard.title}</div>
        <div id="game-connection-message" style={{ fontSize:14, lineHeight:1.7, color:'#475569', marginBottom:16 }}>{guard.message}</div>
        <div role="status" aria-live="assertive" aria-atomic="true" style={{ fontSize:13, color:'#b45309', fontWeight:800, marginBottom:14 }}>正在自动重连，请稍候…</div>
        {guard.canReturnLobby && <button onClick={onReturnLobby} style={{ width:'100%', minHeight:48, borderRadius:15, border:'none', background:'#f5c518', color:'#102016', fontSize:16, fontWeight:900 }}>返回大厅等待</button>}
      </div>
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
  const [soundOn, setSoundOn] = useState(() => readSoundPreference(localStorage));
  const [reconnectEpoch, setReconnectEpoch] = useState(0);
  const tid = useRef(0);
  const autoRejoinTried = useRef(false);
  const settlementPreloadTask = useRef(null);
  const bombPlaybackGate = useRef(null);
  const reducedFeedback = useRef(prefersReducedFeedback(window.matchMedia?.bind(window)));
  if (!bombPlaybackGate.current) bombPlaybackGate.current = createPlaybackGate();

  const toast = useCallback((text, type = 'info') => {
    const id = tid.current++;
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2500);
  }, []);

  const toggleSound = useCallback(async () => {
    if (soundOn) {
      const result = getSoundToggleResult({ currentlyOn: true, playbackSucceeded: true, voiceVersion: VOICE_VERSION });
      writeSoundPreference(localStorage, result.enabled);
      setSoundOn(result.enabled);
      bombPlaybackGate.current?.reset();
      toast(result.message, result.type);
      return;
    }

    const ok = await playBombLine();
    const result = getSoundToggleResult({ currentlyOn: false, playbackSucceeded: ok, voiceVersion: VOICE_VERSION });
    writeSoundPreference(localStorage, result.enabled);
    setSoundOn(result.enabled);
    if (result.enabled) bombPlaybackGate.current?.reset();
    toast(result.message, result.type);
  }, [soundOn, toast]);

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
          if (soundOn && bombPlaybackGate.current?.tryStart()) {
            playBombLine().then(ok => {
              if (!ok) {
                writeSoundPreference(localStorage, false);
                setSoundOn(false);
                toast(`浏览器已阻止人声播放，已自动关闭。请返回大厅后重新开启人声${VOICE_VERSION}。`, 'error');
              }
            });
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
        settlementPreloadTask.current?.preloadNow();
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
  const protectedPage = page === 'game' || page === 'settlement';
  const connectionGuard = getGameConnectionGuard({ connected, page });
  const connectionLabel = getGlobalConnectionLabel(connected, protectedPage);
  const chrome = getGameChromeState({ page, connected });
  const players = gameState?.players || [];
  const currentPlayer = players[gameState?.currentPlayer] || null;
  const isMyTurn = Boolean(currentPlayer && currentPlayer.id === myInfo?.playerId);
  const turnAnnouncement = getTurnAnnouncement({ page, connected, isMyTurn, currentPlayerName: currentPlayer?.name });
  const soundButton = getSoundButtonState(soundOn, VOICE_VERSION);

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
    const task = scheduleAdaptivePreload({ windowObject: window, navigatorObject: navigator, preload: preloadGame });
    return () => task.cancel();
  }, [page]);

  useEffect(() => {
    if (page !== 'game') return undefined;
    const task = scheduleSettlementPreload({ windowObject: window, navigatorObject: navigator, preload: preloadSettlement });
    settlementPreloadTask.current = task;
    return () => {
      if (settlementPreloadTask.current === task) settlementPreloadTask.current = null;
      task.cancel();
    };
  }, [page]);

  useEffect(() => {
    if (page === 'game' && isSettlementImminent(gameState)) settlementPreloadTask.current?.preloadNow();
  }, [page, gameState]);

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
    if (!connected) {
      toast('当前未连接，房间记录仍保留。连接恢复后再退出。', 'error');
      return false;
    }
    const ok = send({ type: 'leave_room' });
    if (!ok) {
      toast('退出请求没有发送成功，房间记录仍保留。', 'error');
      return false;
    }
    toast('正在退出房间，请稍候…', 'info');
    return true;
  }, [connected, send, toast]);

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
      {chrome.showFloatingConnection && <div role="status" aria-live="polite" aria-label={`网络状态：${connectionLabel}`} style={{ position: 'fixed', top: 8, right: 8, zIndex: 1000, fontSize: 11, padding: '3px 8px', borderRadius: 12, background: '#00000088', backdropFilter: 'blur(8px)', color: connected ? '#4ade80' : '#f87171', border: `1px solid ${connected ? '#4ade8033' : '#f8717133'}`, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block', animation: connected || reducedFeedback.current ? 'none' : 'pulse 1s infinite' }} />
        {connectionLabel}
      </div>}

      {chrome.showFloatingSound && <button aria-label={soundButton.label} aria-pressed={soundButton.pressed} title={soundButton.title} onClick={toggleSound} style={{ position:'fixed', top:chrome.showFloatingConnection ? 34 : 8, right:8, zIndex:1001, minHeight:44, padding:'0 12px', borderRadius:16, border:'1px solid rgba(251,191,36,.45)', background:soundOn ? 'rgba(20,83,45,.92)' : 'rgba(120,53,15,.92)', color:soundOn ? '#86efac' : '#fbbf24', fontSize:12, fontWeight:900, boxShadow:'0 4px 12px rgba(0,0,0,.25)', touchAction:'manipulation' }}>
        {soundButton.text}
      </button>}

      {turnAnnouncement && <div role="status" aria-live="polite" aria-atomic="true" style={{ position:'absolute', width:1, height:1, padding:0, margin:-1, overflow:'hidden', clip:'rect(0,0,0,0)', whiteSpace:'nowrap', border:0 }}>{turnAnnouncement}</div>}

      <div style={{ position: 'fixed', top: chrome.inGame ? 50 : 70, left: '50%', transform: 'translateX(-50%)', zIndex: 999, width:'min(560px, calc(100vw - 24px))', display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', pointerEvents: 'none' }}>
        {toasts.map(t => {
          const s = TOAST_STYLE[t.type] || TOAST_STYLE.info;
          return <div key={t.id} style={{ maxWidth:'100%', padding: '7px 18px', borderRadius: 20, fontSize: 13, lineHeight:1.45, fontWeight: 600, textAlign:'center', color: s.color, background: s.bg + 'ee', border: `1px solid ${s.color}44`, animation: reducedFeedback.current ? 'none' : 'floatUp 2.5s ease-out forwards', whiteSpace: 'normal', overflowWrap:'anywhere', backdropFilter: 'blur(6px)' }}>{t.text}</div>;
        })}
      </div>

      {page === 'lobby' && <Lobby send={send} gameState={gameState} myInfo={myInfo} onContinueLastRoom={continueLastRoom} onExitRoom={exitRoom} />}
      <Suspense fallback={<ScreenLoader />}>
        {page === 'game' && <Game key={`game-${reconnectEpoch}`} send={send} gameState={gameState} myHand={myHand} setMyHand={setMyHand} myInfo={myInfo} toast={toast} onReturnLobby={returnToLobby} onExitRoom={exitRoom} />}
        {page === 'settlement' && <Settlement data={settlementData} send={send} myInfo={myInfo} gameState={gameState} connected={connected} onReturnLobby={returnToLobby} onExitRoom={exitRoom} />}
      </Suspense>
      <GameConnectionGuard guard={connectionGuard} onReturnLobby={returnToLobby} />
    </div>
  );
}
