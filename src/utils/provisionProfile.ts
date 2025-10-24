import { supabase } from '../supabaseClient';

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

export async function ensureProfile(user: { id: string; email?: string | null }) {
  const uid = user.id;
  const email = (user.email || '').toLowerCase();

  const { data: existing } = await supabase
    .from('profiles')
    .select('id,role,chef_id,name,email')
    .eq('id', uid)
    .maybeSingle();
  if (existing) return existing;

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
    .single();
  if (error) throw error;
  return data;
}
