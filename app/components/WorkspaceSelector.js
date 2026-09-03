'use client';

import { useEffect, useRef, useState } from 'react';

export default function WorkspaceSelector({ name, countryName, role }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function close(event) {
      if (open && ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    function key(event) { if (event.key === 'Escape') setOpen(false); }
    document.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('keydown', key); };
  }, [open]);

  const workspaceName = name || 'Recruiter workspace';
  return <div className="workspace-selector-wrap" ref={ref}>
    <button className="workspace-switcher" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" aria-label="Select workspace">
      <span className="workspace-avatar">{workspaceName.slice(0, 1).toUpperCase()}</span>
      <span className="workspace-copy"><b>{workspaceName}</b><small>{countryName || 'Global workspace'}</small></span>
      <span aria-hidden="true">⌄</span>
    </button>
    {open && <div className="workspace-menu" role="menu">
      <div className="workspace-menu-label">Current workspace</div>
      <button type="button" role="menuitemradio" aria-checked="true" onClick={() => setOpen(false)}>
        <span className="workspace-avatar">{workspaceName.slice(0, 1).toUpperCase()}</span>
        <span><b>{workspaceName}</b><small>{role || 'MEMBER'} · {countryName || 'Global'}</small></span>
        <strong aria-hidden="true">✓</strong>
      </button>
      <p>Additional workspace switching will use this selector when multi-workspace access is enabled.</p>
    </div>}
  </div>;
}
