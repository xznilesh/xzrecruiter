'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Brand from '@/app/components/Brand';

export default function VerifyEmailPage() {
  const [state, setState] = useState('waiting');
  const [message, setMessage] = useState('Check your inbox and open the secure verification link.');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get('email') || '');
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hash.get('access_token');
    if (!accessToken) return;

    setState('verifying');
    setMessage('Verifying your work email…');
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accessToken })
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verification failed.');
      window.history.replaceState({}, '', '/verify-email?verified=1');
      setState('verified');
      setMessage('Email verified. Your secure workspace is ready to sign in.');
    }).catch((error) => {
      setState('error');
      setMessage(error.message);
    });
  }, []);

  async function resend() {
    if (!email) return;
    setState('sending');
    const response = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    setState(response.ok ? 'waiting' : 'error');
    setMessage(data.message || data.error || 'Check your inbox for the verification email.');
  }

  return <main className="auth-single">
    <section className="auth-panel">
      <Brand />
      <div className="auth-status-icon" aria-hidden="true">{state === 'verified' ? '✓' : '✦'}</div>
      <h1>{state === 'verified' ? 'Email verified' : 'Verify your work email'}</h1>
      <p className="muted auth-copy">{message}</p>
      {email && state !== 'verified' && <button className="btn" type="button" onClick={resend} disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Resend verification email'}</button>}
      <Link className="btn primary" href="/login">Continue to secure sign in →</Link>
      <p className="security-note">Dashboard access stays blocked until email ownership is verified.</p>
    </section>
  </main>;
}
