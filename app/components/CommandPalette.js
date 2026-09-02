'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export const commandCatalog = [
  { id: 'home', label: 'Go to Home', keywords: 'dashboard home radar', href: '/dashboard', group: 'Navigate', enabled: true },
  { id: 'global-settings', label: 'Open global settings', keywords: 'country locale currency timezone language settings', href: '/settings/global', group: 'Navigate', enabled: true },
  { id: 'search-candidate', label: 'Search candidate', keywords: 'candidate people resume cv', group: 'Search', enabled: false },
  { id: 'search-company', label: 'Search company', keywords: 'company hiring radar', group: 'Search', enabled: false },
  { id: 'search-client', label: 'Search client', keywords: 'client crm', group: 'Search', enabled: false },
  { id: 'search-job', label: 'Search job', keywords: 'job vacancy role', group: 'Search', enabled: false },
  { id: 'create-candidate', label: 'Create candidate', keywords: 'new candidate', group: 'Quick create', enabled: false },
  { id: 'create-job', label: 'Create job', keywords: 'new job', group: 'Quick create', enabled: false },
  { id: 'create-client', label: 'Create client', keywords: 'new client', group: 'Quick create', enabled: false },
  { id: 'schedule-interview', label: 'Schedule interview', keywords: 'calendar event interview', group: 'Quick create', enabled: false }
];

export default function CommandPalette({ open, onClose }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commandCatalog;
    return commandCatalog.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery(''); setActive(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => { if (active >= items.length) setActive(Math.max(0, items.length - 1)); }, [items.length, active]);

  if (!open) return null;

  function run(item) {
    if (!item?.enabled || !item.href) return;
    onClose?.();
    router.push(item.href);
  }

  function keyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); onClose?.(); }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((v) => Math.min(v + 1, items.length - 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive((v) => Math.max(v - 1, 0)); }
    if (event.key === 'Enter') { event.preventDefault(); run(items[active]); }
  }

  return <div className="command-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
    <section className="command-palette" role="dialog" aria-modal="true" aria-label="Global command palette" onKeyDown={keyDown}>
      <div className="command-search-row">
        <span aria-hidden="true">⌕</span>
        <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search or jump anywhere…" aria-label="Search commands" />
        <kbd>Esc</kbd>
      </div>
      <div className="command-results" role="listbox">
        {items.length ? items.map((item, index) => <button
          key={item.id}
          type="button"
          className={`command-item ${index === active ? 'active' : ''}`}
          onMouseEnter={() => setActive(index)}
          onClick={() => run(item)}
          disabled={!item.enabled}
          role="option"
          aria-selected={index === active}
        >
          <span><b>{item.label}</b><small>{item.group}</small></span>
          {item.enabled ? <span className="command-enter">↵</span> : <span className="coming-chip">Coming later</span>}
        </button>) : <div className="command-empty">No matching command.</div>}
      </div>
      <footer className="command-footer"><span>↑↓ Navigate</span><span>Enter Open</span><span>⌘/Ctrl + K Anywhere</span></footer>
    </section>
  </div>;
}
