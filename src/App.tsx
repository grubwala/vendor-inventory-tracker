// src/App.tsx
import { useMemo, useState } from 'react';
import type { Item, Vendor, StockRow, CurrentUser, AuditEntry, ID } from './types';

// If you have a real component, keep this import.
// Otherwise, comment it and use the inline placeholder below.
// import InventoryManager from './components/InventoryManager';

type Tab = 'overview' | 'warehouse' | 'chef' | 'items' | 'vendors' | 'audit';

const genId = () =>
  (globalThis.crypto && 'randomUUID' in globalThis.crypto
    ? (crypto.randomUUID as () => string)()
    : Math.random().toString(36).slice(2));

/** Placeholder InventoryManager (remove if you have your own component) */
function InventoryManager(props: {
  currentUser: CurrentUser;
  items: Item[];
  vendors: Vendor[];
  stock: StockRow[];
  itemById: Map<string, Item>;
  vendorById: Map<string, Vendor>;
  viewMode: 'overview' | 'warehouse' | 'chef';
  onAdjust: (args: Omit<StockRow, 'id' | 'timestamp'> & { id?: ID }) => Promise<void>;
  onDeleteRow: (id: ID) => Promise<void>;
}) {
  const { viewMode, stock } = props;
  return (
    <div className="rounded-2xl border p-4">
      <h2 className="text-lg font-semibold mb-3">Inventory — {viewMode}</h2>
      <p className="text-sm text-gray-600 mb-3">Rows: {stock.length}</p>
      <div className="text-xs text-gray-500">This is a placeholder. Replace with your real UI.</div>
    </div>
  );
}

export default function App() {
  // ---- Auth / user (adjust to your auth bootstrap) ----
  const [currentUser] = useState<CurrentUser>({
    id: 'u_1',
    name: 'Aabha Dogra',
    email: 'aabha@example.com',
    role: 'Founder',         // or 'Home Chef'
    chefId: null,            // set for Home Chef accounts
  });

  const isFounder = currentUser.role === 'Founder';

  // ---- Tabs ----
  const [tab, setTab] = useState<Tab>('overview');

  // ---- App state (replace with hooks/server data) ----
  const [items, setItems] = useState<Item[]>([
    { id: 'it_flour', name: 'Flour', unit: 'kg', sku: 'F-001', minStock: 5, isActive: true },
    { id: 'it_oil', name: 'Oil', unit: 'ltr', sku: 'O-050', minStock: 2, isActive: true },
  ]);

  const [vendors, setVendors] = useState<Vendor[]>([
    { id: 'v_alpha', name: 'Alpha Foods', phone: '9999999999', isActive: true },
  ]);

  const [stock, setStock] = useState<StockRow[]>([
    {
      id: 's1',
      itemId: 'it_flour',
      vendorId: 'v_alpha',
      type: 'IN',
      quantity: 10,
      unitCost: 45,
      timestamp: new Date().toISOString(),
      chefId: null,
      note: 'Initial stock',
    }
  ]);

  const [audit, setAudit] = useState<AuditEntry[]>([]);

  // ---- Derived maps ----
  const itemById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const vendorById = useMemo(() => new Map(vendors.map(v => [v.id, v])), [vendors]);

  // ---- Actions (local state version; wire to Supabase later) ----
  async function upsertStock(args: Omit<StockRow, 'id' | 'timestamp'> & { id?: ID }) {
    // normalize chefId: null represents "warehouse"
    const normalized: Omit<StockRow, 'timestamp'> = {
      ...args,
      chefId: args.chefId ?? null,
      id: args.id ?? genId(),
    };

    setStock(prev => {
      const idx = prev.findIndex(r => r.id === normalized.id);
      if (idx === -1) {
        // insert
        return [
          {
            ...normalized,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ];
      }
      // update (preserve original timestamp)
      const old = prev[idx];
      const updated: StockRow = {
        ...old,
        ...normalized,
        timestamp: old.timestamp ?? new Date().toISOString(),
      };
      const next = prev.slice();
      next[idx] = updated;
      return next;
    });
  }

  async function deleteRow(id: ID) {
    setStock(prev => prev.filter(r => r.id !== id));
  }

  type LogInput = { actor: ID; action: string; meta?: Record<string, unknown>; refId?: ID };
  async function log({ actor, action, meta, refId }: LogInput) {
    const entry: AuditEntry = {
      id: genId(),
      actor,
      action,
      timestamp: new Date().toISOString(),
      refId,
      meta,
    };
    setAudit(prev => [entry, ...prev]);
  }

  async function signOut() {
    // If you have Supabase auth, call supabase.auth.signOut() here.
    // For now, no-op to avoid build errors.
    return;
  }

  // ---- Render ----
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid">
              <span className="font-semibold">Grubwala — Vendor Inventory</span>
              <span className="text-xs text-gray-500">Track items, vendors, and stock across warehouse & kitchens</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              {currentUser.name} • {currentUser.email}
            </div>
            <button
              onClick={signOut}
              className="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 mt-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            className={`px-3 py-2 rounded-xl border text-sm ${tab === 'overview' ? 'bg-emerald-50 border-emerald-200' : ''}`}
            onClick={() => setTab('overview')}
          >
            Overview
          </button>
          <button
            className={`px-3 py-2 rounded-xl border text-sm ${tab === 'warehouse' ? 'bg-emerald-50 border-emerald-200' : ''}`}
            onClick={() => setTab('warehouse')}
          >
            Warehouse
          </button>
          <button
            className={`px-3 py-2 rounded-xl border text-sm ${tab === 'chef' ? 'bg-emerald-50 border-emerald-200' : ''}`}
            onClick={() => setTab('chef')}
          >
            My Inventory
          </button>
          <button
            disabled={!isFounder}
            className={`px-3 py-2 rounded-xl border text-sm ${tab === 'items' ? 'bg-emerald-50 border-emerald-200' : ''} ${!isFounder ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => isFounder && setTab('items')}
          >
            Items (Founder)
          </button>
          <button
            className={`px-3 py-2 rounded-xl border text-sm ${tab === 'vendors' ? 'bg-emerald-50 border-emerald-200' : ''}`}
            onClick={() => setTab('vendors')}
          >
            Vendors
          </button>
          <button
            className={`px-3 py-2 rounded-xl border text-sm ${tab === 'audit' ? 'bg-emerald-50 border-emerald-200' : ''}`}
            onClick={() => setTab('audit')}
          >
            Audit
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-10">
          {tab === 'overview' && (
            <InventoryManager
              currentUser={currentUser}
              items={items}
              vendors={vendors}
              stock={stock}
              itemById={itemById}
              vendorById={vendorById}
              viewMode="overview"
              onAdjust={async (args) => {
                await upsertStock(args);
                await log({ actor: currentUser.id, action: 'stock.adjust', meta: args });
              }}
              onDeleteRow={async (id) => {
                await deleteRow(id);
                await log({ actor: currentUser.id, action: 'stock.delete', meta: { id }, refId: id });
              }}
            />
          )}

          {tab === 'warehouse' && (
            <InventoryManager
              currentUser={currentUser}
              items={items}
              vendors={vendors}
              stock={stock.filter((s: StockRow) => !s.chefId)}
              itemById={itemById}
              vendorById={vendorById}
              viewMode="warehouse"
              onAdjust={async (args) => {
                await upsertStock({ ...args, chefId: null });
                await log({ actor: currentUser.id, action: 'stock.adjust', meta: args });
              }}
              onDeleteRow={async (id) => {
                await deleteRow(id);
                await log({ actor: currentUser.id, action: 'stock.delete', meta: { id }, refId: id });
              }}
            />
          )}

          {tab === 'chef' && (
            <InventoryManager
              currentUser={currentUser}
              items={items}
              vendors={vendors}
              stock={stock.filter((s: StockRow) => s.chefId === currentUser.chefId)}
              itemById={itemById}
              vendorById={vendorById}
              viewMode="chef"
              onAdjust={async (args) => {
                await upsertStock({ ...args, chefId: currentUser.chefId ?? null });
                await log({ actor: currentUser.id, action: 'stock.adjust', meta: args });
              }}
              onDeleteRow={async (id) => {
                await deleteRow(id);
                await log({ actor: currentUser.id, action: 'stock.delete', meta: { id }, refId: id });
              }}
            />
          )}

          {tab === 'items' && isFounder && (
            <div className="rounded-2xl border p-4">
              <h2 className="text-lg font-semibold mb-3">Items (Founder)</h2>
              <button
                className="px-3 py-2 rounded-xl border text-sm"
                onClick={() => {
                  const newItem: Omit<Item, 'id'> = {
                    name: `Item ${items.length + 1}`,
                    sku: `SKU-${items.length + 1}`,
                    unit: 'pcs',
                    minStock: 1,
                    isActive: true
                  };
                  setItems(prev => [{ id: genId(), ...newItem }, ...prev]);
                }}
              >
                Add sample item
              </button>
            </div>
          )}

          {tab === 'vendors' && (
            <div className="rounded-2xl border p-4">
              <h2 className="text-lg font-semibold mb-3">Vendors</h2>
              <button
                className="px-3 py-2 rounded-xl border text-sm"
                onClick={() => {
                  const newVendor: Omit<Vendor, 'id'> = {
                    name: `Vendor ${vendors.length + 1}`,
                    isActive: true
                  };
                  setVendors(prev => [{ id: genId(), ...newVendor }, ...prev]);
                }}
              >
                Add sample vendor
              </button>
            </div>
          )}

          {tab === 'audit' && (
            <div className="rounded-2xl border p-4">
              <h2 className="text-lg font-semibold mb-3">Audit</h2>
              <ul className="text-sm space-y-1">
                {audit.map(a => (
                  <li key={a.id} className="text-gray-700">
                    <span className="font-mono text-xs">{a.timestamp}</span>{' '}
                    <span className="text-gray-500">•</span>{' '}
                    <span className="font-semibold">{a.action}</span>{' '}
                    <span className="text-gray-500">by</span> {a.actor}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
