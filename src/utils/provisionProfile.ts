import { supabase } from '../supabaseClient';
import type { Profile, Role } from '../types';

const FOUNDER_EMAILS = new Set<string>([
  'founder@grubwala.com', // add all founder emails here (lowercase)
]);

function uuid4() {
  const webCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID();
  }

  const cryptoWithRandomValues = webCrypto;
  if (cryptoWithRandomValues && typeof cryptoWithRandomValues.getRandomValues === 'function') {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const random = new Uint8Array(1);
      cryptoWithRandomValues.getRandomValues(random);
      const value = random[0] ?? 0;
      const r = (value & 15);
      const v = c === 'x' ? r : ((r & 0x3) | 0x8);
      return v.toString(16);
    });
  }

  // Final fallback (e.g. during SSR builds) – not cryptographically strong, but avoids crashing.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return Math.floor(v).toString(16);
  });
}

type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: Role | null;
  chef_id: string | null;
};

export async function ensureProfile(user: { id: string; email?: string | null }): Promise<Profile | null> {
  const uid = user.id;
  const email = (user.email || '').toLowerCase();

  const { data: existing } = await supabase
    .from('profiles')
    .select('id,role,chef_id,name,email')
    .eq('id', uid)
    .maybeSingle<ProfileRow>();
  if (existing) {
    return {
      id: existing.id,
      email: existing.email ?? '',
      name: existing.name ?? '',
      role: existing.role ?? null,
      chefId: existing.chef_id ?? null
    };
  }

  const isFounder = email && FOUNDER_EMAILS.has(email);
  const role = isFounder ? 'Founder' : 'Home Chef';
  const chef_id = isFounder ? null : uuid4();

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: uid,
      role,
      chef_id,
      name: email ? email.split('@')[0] : 'User',
      email,
    })
    .select()
    .single<ProfileRow>();
  if (error) throw error;
  return {
    id: data.id,
    email: data.email ?? '',
    name: data.name ?? '',
    role: data.role ?? null,
    chefId: data.chef_id ?? null
  };
}
