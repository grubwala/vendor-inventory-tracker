import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string|null>(null);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  async function signInWithMagic(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="max-w-sm mx-auto p-6 bg-white rounded-2xl border mt-10 space-y-3">
      <button onClick={signInWithGoogle}
        className="w-full px-3 py-2 rounded-xl border bg-white hover:bg-gray-50">
        Continue with Google
      </button>

      <div className="text-center text-xs text-gray-500">or</div>

      {sent ? (
        <p className="text-sm text-gray-700 text-center">We sent a magic link to <b>{email}</b>.</p>
      ) : (
        <form onSubmit={signInWithMagic} className="space-y-2">
          <input type="email" required placeholder="you@example.com"
            value={email} onChange={e=>setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm" />
          <button className="w-full px-3 py-2 rounded-xl bg-emerald-600 text-white">
            Send magic link
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
