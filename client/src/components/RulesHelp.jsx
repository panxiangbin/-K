import React, { useEffect, useRef } from 'react';
import { RULES_HELP_SECTIONS, RULES_HELP_TITLE } from '../rules-help-data';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function RulesHelp({ open, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="rules-help-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        ref={dialogRef}
        className="rules-help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-help-title"
        aria-describedby="rules-help-intro"
      >
        <header className="rules-help-header">
          <div>
            <h1 id="rules-help-title">{RULES_HELP_TITLE}</h1>
            <p id="rules-help-intro">这里只展示当前游戏已经确认的牌型、大小和压牌规则。</p>
          </div>
          <button ref={closeRef} type="button" className="rules-help-close" onClick={onClose} aria-label="关闭游戏规则">关闭</button>
        </header>

        <div className="rules-help-scroll" tabIndex="0" aria-label="游戏规则正文，可上下滚动">
          {RULES_HELP_SECTIONS.map(section => (
            <section key={section.id} className="rules-help-section" aria-labelledby={`rules-${section.id}`}>
              <h2 id={`rules-${section.id}`}>{section.title}</h2>
              <ul>
                {section.items.map(item => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ))}
        </div>

        <footer className="rules-help-footer">
          <button type="button" className="rules-help-done" onClick={onClose}>我知道了</button>
        </footer>
      </section>
    </div>
  );
}
