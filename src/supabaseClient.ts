// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * If you've generated DB types from Supabase, uncomment this import and type the client:
 * import type { Database } from '@/types/supabase'; // run: npx supabase gen types typescript --project-id <id> > src/types/supabase.ts
 * type TypedClient = SupabaseClient<Database>;
 */
type TypedClient = SupabaseClient;

/**
 * Read from Vite env vars.
 * In Vercel, set these as Environment Variables (Project Settings → Environment Variables)
 * and prefix with VITE_ so the browser can read them.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail fast in development so we don’t chase ghost bugs
  // (This won't break production if Vercel env vars are set correctly.)
  // eslint-disable-next-line no-console
  console.warn(
    '[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Check your .env and Vercel project settings.'
  );
}

/**
 * Avoid creating multiple clients during Vite HMR by stashing on globalThis.
 */
declare global {
  // eslint-disable-next-line no-var
  var __supabase__: TypedClient | undefined;
}

const getRedirectUrl = () => {
  // Where magic link / OAuth should land after auth
  if (typeof window !== 'undefined') {
    return window.location.origin; // e.g., https://vendor-inventory-tracker.vercel.app
  }
  // during SSR / build fall back to env or site URL
  return SUPABASE_URL;
};

export const supabase: TypedClient =
  globalThis.__supabase__ ??
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Persist session in browser (localStorage)
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      // Send along credentials for RLS if you later host behind a proxy
      headers: { 'x-application-name': 'grubwala-inventory' }
    }
  });

if (!globalThis.__supabase__) {
  globalThis.__supabase__ = supabase;
}

/* ---------------------------
 * Convenience Auth Helpers
 * -------------------------*/

/**
 * Email OTP / Magic Link sign-in.
 * - Ensure "Email" provider is enabled in Supabase Dashboard → Authentication → Providers.
 * - Add your site URL to "Redirect URLs".
 */
export async function signInWithOtp(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getRedirectUrl()
    }
  });
}

/**
 * Google OAuth sign-in.
 * - Enable Google in Providers, add OAuth client ID/secret, and set the same Redirect URL.
 */
export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getRedirectUrl()
    }
  });
}

/**
 * Sign out current user.
 */
export async function signOut() {
  return supabase.auth.signOut();
}

/**
 * Get current session/user (useful on app bootstrap).
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user ?? null;
}

/**
 * Listen to auth state changes. Call once on app mount.
 * Returns an unsubscribe function.
 */
export function onAuthChange(
  cb: (event: Parameters<NonNullable<ReturnType<typeof supabase.auth.onAuthStateChange>['data']>['subscription']['callback']>[0],
       session: Parameters<NonNullable<ReturnType<typeof supabase.auth.onAuthStateChange>['data']>['subscription']['callback']>[1]) => void
) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => cb(event, session));
  return () => data.subscription.unsubscribe();
}

/* ---------------------------
 * (Optional) First-login profile bootstrap
 * Call after successful sign-in to ensure a profile row exists.
 * Adjust table/columns to your schema.
 * -------------------------*/
export async function ensureProfile({
  role,
  chefId
}: {
  role: 'Founder' | 'Home Chef';
  chefId?: string | null;
}) {
  // Example table: public.profiles (id uuid references auth.users, name, email, role, chef_id)
  const user = await getUser();
  if (!user) return;

  // Try to upsert; rely on unique constraint on id
  await supabase
    .from('profiles')
    .upsert(
      [
        {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name ?? user.email?.split('@')[0],
          role,
          chef_id: chefId ?? null
        }
      ],
      { onConflict: 'id' }
    )
    .select()
    .single();
}
