import React, { useEffect, useState } from 'react';
import RulesHelp from './RulesHelp';

function getSurface() {
  if (document.querySelector('.game-table-shell')) return 'game';
  if (document.querySelector('.waiting-room-card, .waiting-room-shell')) return 'waiting';
  if (document.querySelector('.settlement-screen, .settlement-panel')) return 'settlement';
  if (document.querySelector('.lobby-shell')) return 'lobby';
  return null;
}

const SURFACE_LABELS = {
  lobby: '查看河南五十K规则',
  waiting: '查看房间游戏规则',
  game: '查看本局游戏规则',
  settlement: '查看河南五十K规则',
};

export default function RulesHelpLauncher() {
  const [surface, setSurface] = useState(() => getSurface());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const nextSurface = getSurface();
      setSurface(nextSurface);
      if (!nextSurface) setOpen(false);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.getElementById('root'), { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!surface) return null;

  return (
    <>
      <button
        type="button"
        className="rules-help-launcher"
        data-surface={surface}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={SURFACE_LABELS[surface]}
        title={SURFACE_LABELS[surface]}
      >
        <span aria-hidden="true">规</span>
        <span className="rules-help-launcher-label">规则</span>
      </button>
      <RulesHelp open={open} onClose={() => setOpen(false)} />
    </>
  );
}
