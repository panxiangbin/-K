import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getLobbyActionState, getLobbyActionStatus, LOBBY_ACTION_TIMEOUT_MS } from '../lobby-action-state';
import { getRoomActionState, getRoomActionStatus, ROOM_ACTION_TIMEOUT_MS } from '../room-action-state';
import { formatPlayerName, getPresenceState, getRoomCopyState } from '../waiting-room-display';

const AVATAR_COLORS = ['#7a4930', '#315d4d', '#8a6a35', '#6f3e3e'];
const AVATARS = ['龙', '虎', '狐', '狼'];
const CONNECTION_EVENT = 'henan50k-connection-change';

function loadSavedSession(roomId) {
  return {
    playerId: localStorage.getItem(`henan50k:${roomId}:playerId`) || undefined,
    playerToken: localStorage.getItem(`henan50k:${roomId}:playerToken`) || undefined,
  };
}

function getLastSavedSession() {
  const roomId = localStorage.getItem('henan50k:lastRoomId');
  if (!roomId) return null;
  const saved = loadSavedSession(roomId);
  return saved.playerId && saved.playerToken ? { roomId, ...saved } : null;
}

function StatusBox({ children, danger = false }) {
  if (!children) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`lobby-status${danger ? ' danger' : ''}`}
    >
      {children}
    </div>
  );
}

function ViewHeading({ eyebrow, title, description }) {
  return (
    <header className="lobby-view-heading">
      {eyebrow && <span className="lobby-eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </header>
  );
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('copy failed');
}

export default function Lobby({ send, gameState, myInfo }) {
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [view, setView] = useState('home');
  const [savedSession, setSavedSession] = useState(false);
  const [connected, setConnected] = useState(() => Boolean(window.__henan50kConnected));
  const [pendingAction, setPendingAction] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [roomPendingAction, setRoomPendingAction] = useState(null);
  const [roomTimedOutAction, setRoomTimedOutAction] = useState(null);
  const [copyState, setCopyState] = useState('idle');
  const pendingTimer = useRef(null);
  const roomTimer = useRef(null);
  const copyTimer = useRef(null);

  const inRoom = Boolean(myInfo && gameState);
  const isHost = inRoom && gameState.players[0]?.id === myInfo.playerId;
  const playerCount = gameState?.players?.length || 0;
  const statusText = getLobbyActionStatus({ connected, pendingAction, timedOut });
  const roomStatusText = getRoomActionStatus({ connected, pendingAction: roomPendingAction, timedOutAction: roomTimedOutAction });
  const roomCopyState = getRoomCopyState({ mode: gameState?.mode, roomId: gameState?.id, copyState });

  useEffect(() => { setSavedSession(Boolean(getLastSavedSession())); }, [view, inRoom]);
  useEffect(() => { if (inRoom) setView('room'); }, [inRoom]);
  useEffect(() => {
    const handler = event => setConnected(Boolean(event.detail?.connected));
    window.addEventListener(CONNECTION_EVENT, handler);
    return () => window.removeEventListener(CONNECTION_EVENT, handler);
  }, []);
  useEffect(() => {
    if (connected && !inRoom) return;
    clearTimeout(pendingTimer.current);
    setPendingAction(null);
    setTimedOut(false);
  }, [connected, inRoom]);
  useEffect(() => {
    if (!inRoom || !connected) {
      clearTimeout(roomTimer.current);
      setRoomPendingAction(null);
    }
  }, [inRoom, connected]);
  useEffect(() => {
    if (gameState?.status !== 'waiting') {
      clearTimeout(roomTimer.current);
      setRoomPendingAction(null);
      setRoomTimedOutAction(null);
    }
  }, [gameState?.status]);
  useEffect(() => {
    clearTimeout(copyTimer.current);
    setCopyState('idle');
  }, [gameState?.id]);
  useEffect(() => () => {
    clearTimeout(pendingTimer.current);
    clearTimeout(roomTimer.current);
    clearTimeout(copyTimer.current);
  }, []);

  const states = useMemo(() => ({
    continue: getLobbyActionState({ connected, pendingAction, action: 'continue' }),
    create: getLobbyActionState({ connected, pendingAction, action: 'create' }),
    solo: getLobbyActionState({ connected, pendingAction, action: 'solo' }),
    join: getLobbyActionState({ connected, pendingAction, action: 'join', valid: joinId.length === 6 }),
  }), [connected, pendingAction, joinId]);

  const roomStates = useMemo(() => ({
    start: getRoomActionState({ action: 'start', connected, pendingAction: roomPendingAction, isHost, playerCount, roomStatus: gameState?.status }),
    exit: getRoomActionState({ action: 'exit', connected, pendingAction: roomPendingAction, isHost, playerCount, roomStatus: gameState?.status }),
  }), [connected, roomPendingAction, isHost, playerCount, gameState?.status]);

  function beginRequest(action, message) {
    const state = getLobbyActionState({ connected, pendingAction, action, valid: action !== 'join' || joinId.length === 6 });
    if (state.disabled || !send(message)) return;
    setTimedOut(false);
    setPendingAction(action);
    clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => {
      setPendingAction(null);
      setTimedOut(true);
    }, LOBBY_ACTION_TIMEOUT_MS);
  }

  function beginRoomRequest(action, message) {
    const state = action === 'start' ? roomStates.start : roomStates.exit;
    if (state.disabled || !send(message)) return;
    setRoomTimedOutAction(null);
    setRoomPendingAction(action);
    clearTimeout(roomTimer.current);
    roomTimer.current = setTimeout(() => {
      setRoomPendingAction(null);
      setRoomTimedOutAction(action);
    }, ROOM_ACTION_TIMEOUT_MS);
  }

  function requireName(nextView) {
    if (name.trim()) {
      setView(nextView);
      return;
    }
    document.getElementById('player-name')?.focus();
  }

  function joinRoom() {
    if (!name.trim() || joinId.length !== 6) return;
    beginRequest('join', {
      type: 'join_room',
      roomId: joinId.trim(),
      playerName: name.trim(),
      ...loadSavedSession(joinId.trim()),
    });
  }

  async function copyRoomId() {
    if (roomCopyState.disabled || !gameState?.id) return;
    setCopyState('copying');
    clearTimeout(copyTimer.current);
    try {
      await copyText(String(gameState.id));
      setCopyState('success');
    } catch {
      setCopyState('error');
    }
    copyTimer.current = setTimeout(() => setCopyState('idle'), 2600);
  }

  return (
    <div className="lobby-shell">
      <aside className="lobby-brand" aria-label="河南五十K">
        <div className="lobby-brand-mark" aria-hidden="true">五十K</div>
        <h1 className="lobby-brand-title">河南五十K</h1>
        <p className="lobby-brand-subtitle">家乡规则，随时开一桌</p>
        <ul className="lobby-brand-points" aria-label="游戏特点">
          <li>单机练习，开局更快</li>
          <li>三人或四人联网对战</li>
          <li>自动断线恢复与规则提示</li>
        </ul>
      </aside>

      <main className="lobby-main">
        <section className="lobby-panel" aria-label={inRoom ? '等待房间' : '进入游戏'}>
          {!inRoom && <StatusBox danger={timedOut}>{statusText}</StatusBox>}
          {inRoom && <StatusBox danger={Boolean(roomTimedOutAction)}>{roomStatusText}</StatusBox>}

          {view === 'home' && !inRoom && (
            <>
              <ViewHeading
                eyebrow="开始游戏"
                title="选一种方式，马上开局"
                description="单机不用填写昵称；联网对战请先输入昵称。"
              />
              <div className="lobby-field">
                <label htmlFor="player-name">你的昵称</label>
                <input
                  id="player-name"
                  value={name}
                  maxLength={8}
                  autoComplete="nickname"
                  onChange={event => setName(event.target.value)}
                  placeholder="联网对战时填写，最多8个字"
                />
              </div>

              {savedSession && (
                <button
                  type="button"
                  className="lobby-button secondary full"
                  disabled={states.continue.disabled}
                  onClick={() => {
                    const session = getLastSavedSession();
                    if (session) beginRequest('continue', { type: 'join_room', ...session, playerName: '' });
                  }}
                >
                  {states.continue.label}
                </button>
              )}

              <button
                type="button"
                className="lobby-button primary full lobby-solo-button"
                disabled={Boolean(pendingAction)}
                onClick={() => setView('solo')}
              >
                <span className="lobby-button-icon" aria-hidden="true">牌</span>
                <span><strong>单机练习</strong><small>和电脑直接开局</small></span>
              </button>

              <div className="lobby-action-grid">
                <button
                  type="button"
                  className="lobby-button secondary"
                  disabled={!connected || Boolean(pendingAction)}
                  onClick={() => requireName('create')}
                >
                  <strong>创建房间</strong>
                  <small>邀请朋友加入</small>
                </button>
                <button
                  type="button"
                  className="lobby-button secondary"
                  disabled={!connected || Boolean(pendingAction)}
                  onClick={() => requireName('join')}
                >
                  <strong>加入房间</strong>
                  <small>输入6位房间号</small>
                </button>
              </div>
              {!name.trim() && (
                <p className="lobby-field-hint">联网功能需要昵称；点击后会自动定位到输入框。</p>
              )}
            </>
          )}

          {view === 'solo' && !inRoom && (
            <>
              <ViewHeading eyebrow="单机练习" title="选择参与人数" description="其余座位由电脑玩家补齐。" />
              <div className="lobby-choice-grid">
                <button
                  type="button"
                  className="lobby-choice-card"
                  disabled={states.solo.disabled}
                  onClick={() => beginRequest('solo', { type: 'create_room', playerName: name.trim() || '我', maxPlayers: 3, solo: true })}
                >
                  <strong>三人单机</strong>
                  <span>节奏更快，适合练习</span>
                </button>
                <button
                  type="button"
                  className="lobby-choice-card"
                  disabled={states.solo.disabled}
                  onClick={() => beginRequest('solo', { type: 'create_room', playerName: name.trim() || '我', maxPlayers: 4, solo: true })}
                >
                  <strong>四人单机</strong>
                  <span>完整四人牌桌体验</span>
                </button>
              </div>
            </>
          )}

          {view === 'create' && !inRoom && (
            <>
              <ViewHeading eyebrow="创建房间" title="选择房间人数" description="创建后把房间号发给朋友。" />
              <div className="lobby-choice-grid">
                <button
                  type="button"
                  className="lobby-choice-card"
                  disabled={states.create.disabled}
                  onClick={() => beginRequest('create', { type: 'create_room', playerName: name.trim(), maxPlayers: 3 })}
                >
                  <strong>三人局</strong>
                  <span>满3人即可开始</span>
                </button>
                <button
                  type="button"
                  className="lobby-choice-card"
                  disabled={states.create.disabled}
                  onClick={() => beginRequest('create', { type: 'create_room', playerName: name.trim(), maxPlayers: 4 })}
                >
                  <strong>四人局</strong>
                  <span>满4人即可开始</span>
                </button>
              </div>
            </>
          )}

          {view === 'join' && !inRoom && (
            <>
              <ViewHeading eyebrow="加入房间" title="输入6位房间号" description="房间号只包含数字。" />
              <div className="lobby-field">
                <label htmlFor="room-id">房间号</label>
                <input
                  id="room-id"
                  className="room-id-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={joinId}
                  maxLength={6}
                  disabled={Boolean(pendingAction)}
                  onChange={event => setJoinId(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={event => { if (event.key === 'Enter' && !states.join.disabled) joinRoom(); }}
                  placeholder="000000"
                />
              </div>
              <button type="button" disabled={states.join.disabled} onClick={joinRoom} className="lobby-button primary full">
                {states.join.label}
              </button>
            </>
          )}

          {!inRoom && view !== 'home' && (
            <button type="button" disabled={Boolean(pendingAction)} onClick={() => setView('home')} className="lobby-back-button">
              <span aria-hidden="true">←</span> 返回开始页
            </button>
          )}

          {inRoom && (
            <>
              <ViewHeading
                eyebrow={gameState.mode === 'solo' ? '单机练习' : '等待房间'}
                title={gameState.mode === 'solo' ? `${gameState.maxPlayers}人牌桌` : `房间 ${gameState.id}`}
                description={isHost ? '人员到齐后即可开始。' : '等待房主开始游戏。'}
              />
              <section aria-label="房间玩家" className="waiting-room-card">
                <div className="waiting-room-header">
                  <span>{gameState.mode === 'solo' ? '参与人数' : '房间号'}</span>
                  <div className="waiting-room-code-wrap">
                    <strong className="waiting-room-code">{gameState.mode === 'solo' ? `${gameState.maxPlayers}人` : gameState.id}</strong>
                    {roomCopyState.visible && (
                      <button type="button" className="waiting-room-copy" disabled={roomCopyState.disabled} onClick={copyRoomId} aria-describedby="copy-room-status">
                        {roomCopyState.label}
                      </button>
                    )}
                  </div>
                </div>
                <div id="copy-room-status" role="status" aria-live="polite" aria-atomic="true" className={`waiting-room-copy-status ${copyState}`}>
                  {roomCopyState.status}
                </div>
                <div className="waiting-room-count">玩家 {playerCount}/{gameState.maxPlayers}</div>
                {gameState.players.map((player, index) => {
                  const displayName = formatPlayerName(player.name, { isSelf: player.id === myInfo.playerId });
                  const presence = getPresenceState(player);
                  return (
                    <div
                      key={player.id}
                      className={`waiting-player${player.id === myInfo.playerId ? ' self' : ''}`}
                      aria-label={`${displayName.full}，${presence.announced}`}
                    >
                      <span
                        aria-hidden="true"
                        className="waiting-player-avatar"
                        style={{ '--avatar-color': AVATAR_COLORS[index % AVATAR_COLORS.length] }}
                      >
                        {player.isBot ? '机' : AVATARS[index % AVATARS.length]}
                      </span>
                      <span className="waiting-player-name" title={displayName.truncated ? displayName.full : undefined}>{displayName.visible}</span>
                      <span className={`waiting-player-status ${presence.tone}`}>{presence.label}</span>
                    </div>
                  );
                })}
              </section>

              {isHost ? (
                <button
                  type="button"
                  disabled={roomStates.start.disabled}
                  aria-describedby="room-action-help"
                  onClick={() => beginRoomRequest('start', { type: 'start_game' })}
                  className="lobby-button primary full"
                >
                  {roomStates.start.label}
                </button>
              ) : (
                <div className="waiting-room-message">等待房主开始游戏…</div>
              )}
              {roomStates.start.reason && isHost && !roomPendingAction && <div className="waiting-room-reason">{roomStates.start.reason}</div>}
              <button
                type="button"
                disabled={roomStates.exit.disabled}
                aria-describedby="room-action-help"
                onClick={() => beginRoomRequest('exit', { type: 'leave_room' })}
                className="lobby-button danger full lobby-exit-button"
              >
                {roomStates.exit.label}
              </button>
              <span id="room-action-help" className="visually-hidden">
                {roomStatusText || roomStates.start.reason || roomStates.exit.reason || '房间操作可用。'}
              </span>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
