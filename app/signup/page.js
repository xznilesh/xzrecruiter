'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Brand from '@/app/components/Brand';

export default function Signup() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim().toLowerCase();
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          agency: form.get('agency'),
          email,
          password: form.get('password')
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create workspace.');
      router.push(`/verify-email?email=${encodeURIComponent(email)}&sent=${data.verificationSent ? '1' : '0'}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-wrap">
    <section className="auth-art">
      <Brand />
      <div><div className="eyebrow"><span className="dot" />Enterprise hiring intelligence</div><h1>Turn hiring activity into agency revenue.</h1><p>Create an isolated agency workspace. Email ownership must be verified before the dashboard or recruiter data can be opened.</p></div>
      <small className="muted">Workspace isolation · Role-ready access · Audit trail</small>
    </section>
    <section className="auth-main"><div className="form-card">
      <div className="form-kicker">Create workspace</div><h2>Set up your agency</h2><div className="muted">Your first account becomes the workspace owner.</div>
      <form className="form" onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
        <div className="field"><label>Your name</label><input name="name" autoComplete="name" required /></div>
        <div className="field"><label>Agency / company name</label><input name="agency" autoComplete="organization" required /></div>
        <div className="field"><label>Work email</label><input name="email" type="email" autoComplete="email" required /></div>
        <div className="field"><label>Password</label><input name="password" type="password" minLength="12" autoComplete="new-password" required /><small>Minimum 12 characters. Never shared with another workspace.</small></div>
        <button className="btn primary" disabled={busy}>{busy ? 'Creating secure workspace…' : 'Create secure workspace →'}</button>
        <div className="form-note">Already have an account? <Link href="/login">Sign in</Link></div>
      </form>
    </div></section>
  </main>;
}
