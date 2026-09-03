'use client';

export default function ContextActionBar({ title = 'Quick actions', actions = [] }) {
  return <div className="context-action-bar" aria-label={title}><span className="context-action-title">{title}</span><div>{actions.map((action) => <button key={action.label} type="button" onClick={action.onClick} disabled={action.disabled} title={action.disabled ? `${action.label} — coming later` : action.label}>{action.icon && <span aria-hidden="true">{action.icon}</span>}{action.label}{action.shortcut && <kbd>{action.shortcut}</kbd>}</button>)}</div></div>;
}
