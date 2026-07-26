import React, { useEffect, useState } from 'react';
import RulesHelp from './RulesHelp';

function lobbyVisible() {
  return Boolean(document.querySelector('.lobby-shell'));
}

export default function RulesHelpLauncher() {
  const [visible, setVisible] = useState(() => lobbyVisible());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const nextVisible = lobbyVisible();
      setVisible(nextVisible);
      if (!nextVisible) setOpen(false);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.getElementById('root'), { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        className="rules-help-launcher"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        游戏规则
      </button>
      <RulesHelp open={open} onClose={() => setOpen(false)} />
    </>
  );
}
