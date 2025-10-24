import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Auth from './components/Auth';
import InventoryDashboard from './components/InventoryDashboard';
import ProfileSetup from './components/ProfileSetup';
import { useItems } from './hooks/useItems';
import { useVendors } from './hooks/useVendors';
import { useStock, type MovementInput } from './hooks/useStock';
import { useAudit } from './hooks/useAudit';
import { useChefs } from './hooks/useChefs';
import {
  fetchProfile,
  getActiveSession,
  onAuthChange,
  signOut as supabaseSignOut,
  upsertProfile
} from './supabaseClient';
import type { Chef, Item, Profile, Role, StockRow, Vendor } from './types';

const INITIAL_ITEMS: Item[] = [
  { id: 'cnt_100ml', name: '100 ml Container', unit: 'pcs', sku: 'CNT-100', minStock: 50, isActive: true },
  { id: 'cnt_200ml', name: '200 ml Container', unit: 'pcs', sku: 'CNT-200', minStock: 40, isActive: true },
  { id: 'cnt_300ml', name: '300 ml Container', unit: 'pcs', sku: 'CNT-300', minStock: 30, isActive: true }
];

const INITIAL_VENDORS: Vendor[] = [
  { id: 'vendor_alpha', name: 'Alpha Packaging', phone: '9876543210', isActive: true },
  { id: 'vendor_beta', name: 'Beta Box Co.', phone: '9123456780', isActive: true }
];

const INITIAL_CHEFS: Chef[] = [
  { id: 'chef_aabha', name: 'Chef Aabha — South Delhi', email: 'aabha.chef@example.com', isActive: true },
  { id: 'chef_riya', name: 'Chef Riya — Gurgaon', email: 'riya.chef@example.com', isActive: true }
];

const INITIAL_MOVEMENTS: StockRow[] = [
  {
    id: 'mv_warehouse_seed',
    itemId: 'cnt_200ml',
    vendorId: 'vendor_alpha',
    type: 'IN',
    quantity: 120,
    timestamp: new Date('2024-02-01T10:00:00Z').toISOString(),
    chefId: null,
    note: 'Opening stock received at warehouse'
  },
  {
    id: 'mv_ship_aabha',
    itemId: 'cnt_200ml',
    vendorId: 'vendor_alpha',
    type: 'OUT',
    quantity: 30,
    timestamp: new Date('2024-02-03T09:30:00Z').toISOString(),
    chefId: 'chef_aabha',
    note: 'Dispatched for Sunday brunch service'
  },
  {
    id: 'mv_ship_riya',
    itemId: 'cnt_100ml',
    vendorId: 'vendor_beta',
    type: 'OUT',
    quantity: 40,
    timestamp: new Date('2024-02-05T07:15:00Z').toISOString(),
    chefId: 'chef_riya',
    note: 'Packed tasting menu kits'
  }
];

export default function App() {
  const { items, addItem, byId: itemById } = useItems(INITIAL_ITEMS);
  const { vendors, addVendor, byId: vendorById } = useVendors(INITIAL_VENDORS);
  const { chefs, addChef, byId: chefById } = useChefs(INITIAL_CHEFS);
  const stock = useStock(INITIAL_MOVEMENTS);
  const { audit, log: logAudit } = useAudit();

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const current = await getActiveSession();
        if (active) setSession(current);
      } catch (error) {
        if (error instanceof Error) {
          // eslint-disable-next-line no-console
          console.warn('[app] Failed to get active session', error.message);
        }
      } finally {
        if (active) setAuthReady(true);
      }
    };

    bootstrap();
    const unsubscribe = onAuthChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    setProfileLoading(true);

    const loadProfile = async () => {
      try {
        const dbProfile = await fetchProfile();
        if (cancelled) return;
        const fallback: Profile = {
          id: session.user.id,
          email: session.user.email ?? '',
          name: session.user.user_metadata?.full_name ?? session.user.email ?? 'User',
          role: dbProfile?.role ?? null,
          chefId: dbProfile?.chefId ?? null
        };
        setProfile(dbProfile ?? fallback);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleSignOut = async () => {
    await supabaseSignOut();
    setSession(null);
    setProfile(null);
  };

  const handleAddChef = (
    partial: Omit<Chef, 'id'>,
    scope: 'founder' | 'chef' = 'founder',
    actorOverride?: string
  ) => {
    const chef = addChef(partial);
    logAudit({
      actor: actorOverride ?? profile?.id ?? 'system',
      action: 'chef.create',
      scope,
      chefId: chef.id,
      meta: { name: chef.name, email: chef.email }
    });
    return chef;
  };

  const handleAddItem = (partial: Omit<Item, 'id'>) => {
    const item = addItem(partial);
    logAudit({
      actor: profile?.id ?? 'system',
      action: 'catalog.item.create',
      scope: 'founder',
      chefId: null,
      meta: { name: item.name, unit: item.unit, sku: item.sku }
    });
    return item;
  };

  const handleAddVendor = (partial: Omit<Vendor, 'id'>) => {
    const vendor = addVendor(partial);
    logAudit({
      actor: profile?.id ?? 'system',
      action: 'catalog.vendor.create',
      scope: 'founder',
      chefId: null,
      meta: { name: vendor.name, phone: vendor.phone }
    });
    return vendor;
  };

  const handleRecordMovement = async (payload: MovementInput) => {
    if (!profile) throw new Error('Profile not ready yet.');
    const movement = stock.addMovement(payload);
    const item = itemById.get(payload.itemId);
    const vendor = payload.vendorId ? vendorById.get(payload.vendorId) : null;
    const ownerName = payload.chefId ? chefById.get(payload.chefId)?.name ?? payload.chefId : 'Warehouse';

    logAudit({
      actor: profile.id,
      action: `stock.${payload.type.toLowerCase()}`,
      scope: payload.chefId ? 'chef' : 'founder',
      chefId: payload.chefId ?? null,
      refId: movement.id,
      meta: {
        item: item?.name ?? payload.itemId,
        vendor: vendor?.name ?? null,
        quantity: payload.quantity,
        note: payload.note ?? null,
        owner: ownerName
      }
    });
  };

  const handleProfileComplete = async (payload: { role: Role; chefId?: string | null; chefName?: string }) => {
    if (!session) return;
    setProfileSaving(true);
    setProfileError(null);

    try {
      let chefId = payload.chefId ?? null;
      if (payload.role === 'Home Chef') {
        if (!chefId && payload.chefName) {
          const created = handleAddChef(
            {
              name: payload.chefName,
              email: session.user.email ?? undefined,
              isActive: true
            },
            'chef',
            session.user.id
          );
          chefId = created.id;
        }
        if (!chefId) {
          throw new Error('Select a kitchen or create a new one to continue.');
        }
      }

      const updated = await upsertProfile({
        userId: session.user.id,
        email: session.user.email ?? '',
        name: session.user.user_metadata?.full_name ?? session.user.email ?? 'User',
        role: payload.role,
        chefId
      });

      const finalProfile: Profile =
        updated ?? {
          id: session.user.id,
          email: session.user.email ?? '',
          name: session.user.user_metadata?.full_name ?? session.user.email ?? 'User',
          role: payload.role,
          chefId
        };

      setProfile(finalProfile);

      logAudit({
        actor: session.user.id,
        action: `profile.role.${payload.role === 'Founder' ? 'founder' : 'chef'}`,
        scope: payload.role === 'Founder' ? 'founder' : 'chef',
        chefId: chefId ?? null,
        meta: { email: session.user.email, name: finalProfile.name }
      });
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Unable to save profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const sessionName = useMemo(() => {
    if (profile?.name) return profile.name;
    if (session?.user.user_metadata?.full_name) return session.user.user_metadata.full_name;
    return session?.user.email ?? 'User';
  }, [profile?.name, session]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        Checking session...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Auth />
      </div>
    );
  }

  if (profileLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        Loading your profile...
      </div>
    );
  }

  if (!profile.role) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ProfileSetup
          email={profile.email}
          displayName={sessionName}
          chefs={chefs}
          onSubmit={handleProfileComplete}
          submitting={profileSaving}
          serverError={profileError}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Grubwala Inventory</p>
            <p className="text-xs text-gray-500">Track containers for founders and home chefs in one dashboard.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <div className="text-right">
              <div className="font-medium">{sessionName}</div>
              <div className="text-xs text-gray-500">{profile.role}</div>
            </div>
            <button type="button" onClick={handleSignOut} className="rounded-xl border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <InventoryDashboard
          profile={profile}
          items={items}
          vendors={vendors}
          chefs={chefs}
          movements={stock.movements}
          audit={audit}
          getOnHand={stock.getOnHand}
          onRecordMovement={handleRecordMovement}
          onCreateItem={handleAddItem}
          onCreateVendor={handleAddVendor}
          onCreateChef={(partial) => handleAddChef(partial, 'founder')}
        />
      </main>
    </div>
  );
}
