'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">♠</div>
          <h1 className="text-xl font-black text-white">Reset Password</h1>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
          {sent ? (
            <div className="text-center">
              <div className="text-3xl mb-3">📧</div>
              <p className="text-slate-300 text-sm">
                If that email is registered, we&apos;ve sent a reset link. Check your inbox (and spam).
              </p>
              <p className="text-slate-500 text-xs mt-2">
                For local dev — check the server console for the link.
              </p>
              <Link href="/login" className="block mt-4 text-violet-400 text-sm hover:text-violet-300">
                ← Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-slate-400 text-sm">
                Enter your email and we&apos;ll send a password reset link.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@email.com"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
              <Link href="/login" className="text-center text-slate-500 text-xs hover:text-slate-300">
                ← Back to Sign In
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
