import { supabase } from '../supabaseClient';

const FOUNDER_EMAILS = new Set<string>([
  'founder@grubwala.com', // add all founder emails here (lowercase)
]);

function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15);
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
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
