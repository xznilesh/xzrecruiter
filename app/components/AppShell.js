'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Brand from '@/app/components/Brand';
import CommandPalette from '@/app/components/CommandPalette';
import { namespace } from '@/i18n/resources';
import { directionFor } from '@/lib/globalization';

const navigation = [
  { label: 'Home', items: [{ key: 'home', label: 'Home', href: '/dashboard', icon: '⌂', enabled: true }] },
  { label: 'INTELLIGENCE', items: [
    { key: 'radar', label: 'Hiring Radar', icon: '◉' }, { key: 'companies', label: 'Companies', icon: '▦' },
    { key: 'signals', label: 'Signals', icon: '⌁' }, { key: 'people', label: 'People', icon: '◎' }
  ]},
  { label: 'RECRUITMENT', items: [
    { key: 'candidates', label: 'Candidates', icon: '◌' }, { key: 'jobs', label: 'Jobs', icon: '▤' },
    { key: 'matches', label: 'Matches', icon: '≋' }, { key: 'interviews', label: 'Interviews', icon: '□' },
    { key: 'offers', label: 'Offers', icon: '◇' }, { key: 'placements', label: 'Placements', icon: '✓' }
  ]},
  { label: 'BUSINESS', items: [
    { key: 'clients', label: 'Clients', icon: '▣' }, { key: 'contacts', label: 'Contacts', icon: '◍' },
    { key: 'opportunities', label: 'Opportunities', icon: '↗' }, { key: 'pipeline', label: 'Pipeline', icon: '⋮' },
    { key: 'outreach', label: 'Outreach', icon: '✉' }
  ]},
  { label: 'PRODUCTIVITY', items: [
    { key: 'tasks', label: 'Tasks', icon: '☑' }, { key: 'calendar', label: 'Calendar', icon: '□' }, { key: 'automation', label: 'Automation', icon: '⚡' }
  ]},
  { label: 'INSIGHTS', items: [
    { key: 'reports', label: 'Reports', icon: '▥' }, { key: 'analytics', label: 'Analytics', icon: '⌁' }
  ]},
  { label: 'ADMIN', items: [
    { key: 'integrations', label: 'Integrations', icon: '⌘' }, { key: 'team', label: 'Team', icon: '◉' },
    { key: 'settings', label: 'Settings', href: '/settings/global', icon: '⚙', enabled: true }
  ]}
];

export default function AppShell({ user, globalSettings, active = 'home', children }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const language = globalSettings?.language_code || 'en';
  const direction = globalSettings?.direction?.toLowerCase() || directionFor(language);
  const shellText = useMemo(() => namespace(language, 'shell'), [language]);

  useEffect(() => {
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setCommandOpen(true);
      }
      if (event.key === 'Escape') { setQuickOpen(false); setNotifyOpen(false); setUserOpen(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const workspaceName = user?.agency_name || 'Recruiter workspace';

  return <div className="xz-app" dir={direction} data-language={language}>
    <aside className="xz-sidebar" aria-label="Primary navigation">
      <div className="xz-sidebar-brand"><Brand compact /></div>
      <nav className="xz-nav-scroll">
        {navigation.map((group) => <div className="xz-nav-group" key={group.label}>
          <div className="xz-nav-label">{group.label}</div>
          {group.items.map((item) => item.enabled ? <Link key={item.key} href={item.href} className={`xz-nav-item ${active === item.key ? 'active' : ''}`} prefetch>
            <span className="xz-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>
          </Link> : <button key={item.key} className="xz-nav-item disabled" type="button" disabled title={`${item.label} — coming later`}>
            <span className="xz-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span><span className="nav-soon">Soon</span>
          </button>)}
        </div>)}
      </nav>
      <div className="xz-sidebar-footer"><span className="security-dot"/> Verified workspace</div>
    </aside>

    <div className="xz-stage">
      <header className="xz-topbar">
        <div className="mobile-brand"><Brand compact /></div>
        <button className="workspace-switcher" type="button" aria-label="Current workspace">
          <span className="workspace-avatar">{workspaceName.slice(0,1).toUpperCase()}</span>
          <span className="workspace-copy"><b>{workspaceName}</b><small>{globalSettings?.country_name || 'Global workspace'}</small></span>
          <span aria-hidden="true">⌄</span>
        </button>

        <button className="global-search" type="button" onClick={() => setCommandOpen(true)} aria-label="Open global command palette">
          <span aria-hidden="true">⌕</span><span className="global-search-copy">{shellText.commandPlaceholder || 'Search or jump anywhere…'}</span><kbd>⌘ K</kbd>
        </button>

        <div className="topbar-actions">
          <div className="topbar-pop-wrap">
            <button className="icon-button" type="button" onClick={() => { setQuickOpen(!quickOpen); setNotifyOpen(false); setUserOpen(false); }} aria-expanded={quickOpen} aria-label="Quick create">＋</button>
            {quickOpen && <div className="topbar-pop quick-pop" role="menu">
              <b>Quick create</b>
              <button type="button" disabled>Create candidate <span>Coming later</span></button>
              <button type="button" disabled>Create job <span>Coming later</span></button>
              <button type="button" disabled>Create client <span>Coming later</span></button>
              <Link href="/settings/global" onClick={() => setQuickOpen(false)}>Global settings <span>Open</span></Link>
            </div>}
          </div>
          <div className="topbar-pop-wrap">
            <button className="icon-button" type="button" onClick={() => { setNotifyOpen(!notifyOpen); setQuickOpen(false); setUserOpen(false); }} aria-expanded={notifyOpen} aria-label="Notifications">◔</button>
            {notifyOpen && <div className="topbar-pop notification-pop"><b>Notifications</b><p>You’re all caught up.</p></div>}
          </div>
          <div className="topbar-pop-wrap">
            <button className="user-button" type="button" onClick={() => { setUserOpen(!userOpen); setQuickOpen(false); setNotifyOpen(false); }} aria-expanded={userOpen} aria-label="Open user menu">
              <span>{(user?.display_name || user?.email || 'R').slice(0,1).toUpperCase()}</span>
            </button>
            {userOpen && <div className="topbar-pop user-pop">
              <div className="user-pop-head"><b>{user?.display_name || 'Recruiter'}</b><small>{user?.email}</small><span>{user?.role}</span></div>
              <Link href="/settings/global" onClick={() => setUserOpen(false)}>Global settings</Link>
              <form action="/api/auth/logout" method="post"><button type="submit">Sign out</button></form>
            </div>}
          </div>
        </div>
      </header>

      <main className="xz-content">{children}</main>
    </div>

    <nav className="xz-mobile-nav" aria-label="Mobile navigation">
      <Link href="/dashboard" className={active === 'home' ? 'active' : ''}><span>⌂</span><small>Home</small></Link>
      <button type="button" onClick={() => setCommandOpen(true)}><span>⌕</span><small>Search</small></button>
      <button type="button" className="mobile-create" onClick={() => setCommandOpen(true)}><span>＋</span><small>Create</small></button>
      <Link href="/settings/global" className={active === 'settings' ? 'active' : ''}><span>⚙</span><small>Settings</small></Link>
      <button type="button" onClick={() => setUserOpen(!userOpen)}><span>•••</span><small>More</small></button>
    </nav>

    <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
  </div>;
}
