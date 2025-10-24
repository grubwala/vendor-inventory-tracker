import { useState, type FormEvent } from 'react';
import { supabase } from '../supabaseClient';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  async function signInWithGoogle() {
    setError(null);
    setGoogleLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to start Google sign-in.');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function signInWithMagic(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMagicLoading(true);

    try {
      const { error: magicError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
      });

      if (magicError) {
        setError(magicError.message);
        return;
      }

      setSent(true);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to send magic link.');
    } finally {
      setMagicLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6 bg-white rounded-2xl border mt-10 space-y-3">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={googleLoading || magicLoading}
        className="w-full px-3 py-2 rounded-xl border bg-white transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {googleLoading ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <div className="text-center text-xs text-gray-500">or</div>

      {error && (
        <p role="alert" className="text-sm text-red-600 text-center">
          {error}
        </p>
      )}

      {sent ? (
        <p className="text-sm text-gray-700 text-center">We sent a magic link to <b>{email}</b>.</p>
      ) : (
        <form onSubmit={signInWithMagic} className="space-y-2">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm"
            disabled={googleLoading || magicLoading}
          />
          <button
            type="submit"
            disabled={magicLoading || googleLoading}
            className="w-full px-3 py-2 rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {magicLoading ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      )}
    </div>
  );
}
