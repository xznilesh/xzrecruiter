'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Brand from '@/app/components/Brand';

export default function ResetPasswordPage() {
  const [accessToken, setAccessToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = hash.get('access_token') || '';
    setAccessToken(token);
  }, []);

  async function requestReset(event) {
    event.preventDefault();
    setBusy(true); setMessage('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/password-reset/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: form.get('email') })
    });
    const data = await response.json();
    setMessage(data.message || data.error || 'Check your inbox.');
    setBusy(false);
  }

  async function completeReset(event) {
    event.preventDefault();
    setBusy(true); setMessage('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    const confirm = String(form.get('confirm') || '');
    if (password !== confirm) { setMessage('Passwords do not match.'); setBusy(false); return; }
    const response = await fetch('/api/auth/password-reset/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accessToken, password })
    });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || 'Reset failed.'); setBusy(false); return; }
    window.history.replaceState({}, '', '/reset-password?done=1');
    setDone(true); setBusy(false);
  }

  return <main className="auth-single"><section className="auth-panel">
    <Brand />
    {done ? <>
      <div className="auth-status-icon">✓</div>
      <h1>Password updated</h1>
      <p className="muted auth-copy">All existing XZ Recruiter sessions were revoked. Sign in again with your new password.</p>
      <Link className="btn primary" href="/login">Return to sign in →</Link>
    </> : accessToken ? <>
      <h1>Choose a new password</h1>
      <p className="muted auth-copy">Use at least 12 characters. Completing the reset signs out every existing session.</p>
      <form className="form" onSubmit={completeReset}>
        {message && <div className="form-error">{message}</div>}
        <div className="field"><label>New password</label><input name="password" type="password" minLength="12" autoComplete="new-password" required /></div>
        <div className="field"><label>Confirm password</label><input name="confirm" type="password" minLength="12" autoComplete="new-password" required /></div>
        <button className="btn primary" disabled={busy}>{busy ? 'Updating…' : 'Update password →'}</button>
      </form>
    </> : <>
      <h1>Reset your password</h1>
      <p className="muted auth-copy">We’ll send a secure email proof link. For privacy, the response is the same whether an account exists or not.</p>
      <form className="form" onSubmit={requestReset}>
        {message && <div className="form-info">{message}</div>}
        <div className="field"><label>Work email</label><input name="email" type="email" autoComplete="email" required /></div>
        <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Send secure reset link →'}</button>
      </form>
      <p className="form-note"><Link href="/login">Back to sign in</Link></p>
    </>}
  </section></main>;
}
