'use client';

import { useEffect } from 'react';

export default function DetailDrawer({ open, title, subtitle, children, actions, onClose }) {
  useEffect(() => {
    if (!open) return;
    function key(event) { if (event.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, onClose]);

  if (!open) return null;
  return <div className="drawer-layer" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
    <aside className="detail-drawer" role="dialog" aria-modal="true" aria-label={title || 'Record details'}>
      <header><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" onClick={onClose} aria-label="Close details">×</button></header>
      <div className="detail-drawer-body">{children}</div>
      {actions && <footer>{actions}</footer>}
    </aside>
  </div>;
}
