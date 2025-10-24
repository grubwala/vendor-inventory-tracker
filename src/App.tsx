import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./components/Auth";
import { ensureProfile } from "./utils/provisionProfile";

import { useItems, Item } from "./hooks/useItems";
import { useVendors, Vendor } from "./hooks/useVendors";
import { useStock, StockRow } from "./hooks/useStock";
import { useAudit } from "./hooks/useAudit";

/** ---------- Types for current signed-in user ---------- */
type Role = "Founder" | "Home Chef";
interface CurrentUser {
  id: string;
  email: string | null;
  name: string;
  role: Role;
  chefId?: string | null;
}

/** ---------- Small UI helpers ---------- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-2xl p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
      {children}
    </span>
  );
}

/** ---------- Items Manager (Founder) ---------- */
function ItemsManager({
  items,
  onAdd,
  onDelete,
}: {
  items: Item[];
  onAdd: (row: { name: string; sku: string; unit: string; minLevel?: number }) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [form, setForm] = useState<{ name: string; sku: string; unit: string; minLevel?: number }>({
    name: "",
    sku: "",
    unit: "pcs",
    minLevel: 0,
  });

  const add = async () => {
    if (!form.name || !form.sku || !form.unit) return;
    await onAdd({
      name: form.name.trim(),
      sku: form.sku.trim(),
      unit: form.unit.trim(),
      minLevel: Number(form.minLevel) || 0,
    });
    setForm({ name: "", sku: "", unit: "pcs", minLevel: 0 });
  };

  return (
    <Section title="Items Catalog (Founder)">
      <div className="grid md:grid-cols-4 gap-3">
        <input
          className="border rounded-xl px-3 py-2 text-sm"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <input
          className="border rounded-xl px-3 py-2 text-sm"
          placeholder="SKU"
          value={form.sku}
          onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
        />
        <input
          className="border rounded-xl px-3 py-2 text-sm"
          placeholder="Unit (kg, L, pcs)"
          value={form.unit}
          onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
        />
        <input
          className="border rounded-xl px-3 py-2 text-sm"
          type="number"
          placeholder="Min level"
          value={form.minLevel}
          onChange={(e) => setForm((f) => ({ ...f, minLevel: Number(e.target.value) }))}
        />
      </div>
      <div className="mt-3">
        <button onClick={add} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm">
          Add Item
        </button>
      </div>

      <div className="mt-6 overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2">Name</th>
              <th>SKU</th>
              <th>Unit</th>
              <th>Min level</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="py-2">{it.name}</td>
                <td>{it.sku}</td>
                <td>{it.unit}</td>
                <td>{it.minLevel ?? 0}</td>
                <td className="text-right">
                  <button
                    onClick={() => onDelete(it.id)}
                    className="px-2 py-1 rounded-lg border text-xs hover:bg-gray-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-500">
                  No items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/** ---------- Vendors Manager (Chef) ---------- */
function VendorsManager({
  chefId,
  vendors,
  onAdd,
  onDelete,
}: {
  chefId: string;
  vendors: Vendor[];
  onAdd: (row: { chefId: string; name: string; contact?: string; notes?: string }) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [form, setForm] = useState<{ name: string; contact?: string; notes?: string }>({
    name: "",
    contact: "",
    notes: "",
  });

  const add = async () => {
    if (!form.name) return;
    await onAdd({
      chefId,
      name: form.name.trim(),
      contact: form.contact?.trim(),
      notes: form.notes?.trim(),
    });
    setForm({ name: "", contact: "", notes: "" });
  };

  return (
    <Section title="My Vendors">
      <div className="grid md:grid-cols-3 gap-3">
        <input
          className="border rounded-xl px-3 py-2 text-sm"
          placeholder="Vendor name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <input
          className="border rounded-xl px-3 py-2 text-sm"
          placeholder="Contact"
          value={form.contact}
          onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
        />
        <input
          className="border rounded-xl px-3 py-2 text-sm"
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>
      <div className="mt-3">
        <button onClick={add} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm">
          Add Vendor
        </button>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-3">
        {vendors.map((v) => (
          <div key={v.id} className="border rounded-2xl p-3">
            <div className="font-medium">{v.name}</div>
            <div className="text-xs text-gray-600">{v.contact || "—"}</div>
            <div className="text-xs text-gray-500">{v.notes || ""}</div>
            <div className="mt-2">
              <button
                onClick={() => onDelete(v.id)}
                className="px-2 py-1 rounded-lg border text-xs hover:bg-gray-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {vendors.length === 0 && (
          <div className="text-sm text-gray-500">No vendors yet. Add your first vendor above.</div>
        )}
      </div>
    </Section>
  );
}

/** ---------- Inventory Manager (Chef/Warehouse/Overview) ---------- */
function InventoryManager({
  currentUser,
  items,
  vendors,
  stock,
  viewMode,
  onAdjust,
  onDeleteRow,
}: {
  currentUser: CurrentUser;
  items: Item[];
  vendors: Vendor[];
  stock: StockRow[];
  viewMode: "chef" | "warehouse" | "overview";
  onAdjust: (args: { itemId: string; qty: number; chefId?: string | null; vendorId?: string | null }) => Promise<void> | void;
  onDeleteRow: (id: string) => Promise<void> | void;
}) {
  const isFounder = currentUser.role === "Founder";
  const [selItemId, setSelItemId] = useState<string>("");
  const [qty, setQty] = useState<number>(0);
  const [vendorId, setVendorId] = useState<string | "">("");
  const [forChefId, setForChefId] = useState<string | "">(currentUser.chefId || "");

  const uniqueChefIds = useMemo(() => {
    const set = new Set<string>();
    stock.forEach((s) => {
      if (s.chefId) set.add(s.chefId);
    });
    return Array.from(set);
  }, [stock]);

  const addAdjust = async (sign: 1 | -1) => {
    if (!selItemId || qty === 0) return;
    const owner =
      viewMode === "warehouse" ? null : isFounder ? (forChefId || null) : currentUser.chefId || null;

    await onAdjust({
      itemId: selItemId,
      qty: sign * qty,
      chefId: owner,
      vendorId: vendorId || undefined,
    });
    setQty(0);
  };

  const rows = stock.map((s) => {
    const item = items.find((i) => i.id === s.itemId);
    return { ...s, itemName: item?.name ?? "-", unit: item?.unit ?? "" };
  });

  return (
    <Section
      title={
        viewMode === "warehouse"
          ? "Warehouse Inventory"
          : viewMode === "chef"
          ? "My Inventory"
          : "Overview (All)"
      }
    >
      <div className="grid md:grid-cols-5 gap-3">
        <select
          className="border rounded-xl px-3 py-2 text-sm"
          value={selItemId}
          onChange={(e) => setSelItemId(e.target.value)}
        >
          <option value="">Select item…</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.unit})
            </option>
          ))}
        </select>

        <input
          className="border rounded-xl px-3 py-2 text-sm"
          type="number"
          placeholder="Quantity"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
        />

        <select
          className="border rounded-xl px-3 py-2 text-sm"
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
        >
          <option value="">Vendor (optional)</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        {viewMode !== "warehouse" && isFounder && (
          <select
            className="border rounded-xl px-3 py-2 text-sm"
            value={forChefId}
            onChange={(e) => setForChefId(e.target.value)}
          >
            <option value="">(select chef)</option>
            {uniqueChefIds.map((cid) => (
              <option key={cid} value={cid}>
                {cid}
              </option>
            ))}
          </select>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => addAdjust(1)}
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm"
          >
            + Add
          </button>
          <button
            onClick={() => addAdjust(-1)}
            className="px-3 py-2 rounded-xl border text-sm"
          >
            − Remove
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2">Item</th>
              <th>Qty</th>
              <th>Owner</th>
              <th>Vendor</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) =>
                viewMode === "warehouse"
                  ? !r.chefId
                  : viewMode === "chef"
                  ? r.chefId === currentUser.chefId
                  : true
              )
              .map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <span>{r.itemName}</span>
                      <Pill>{r.unit}</Pill>
                    </div>
                  </td>
                  <td>{r.quantity}</td>
                  <td>{r.chefId ? r.chefId : "Warehouse"}</td>
                  <td>{r.vendorId ?? "—"}</td>
                  <td>{new Date(r.lastUpdated).toLocaleString()}</td>
                  <td className="text-right">
                    <button
                      onClick={() => onDeleteRow(r.id)}
                      className="px-2 py-1 rounded-lg border text-xs hover:bg-gray-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            {rows.filter((r) =>
              viewMode === "warehouse" ? !r.chefId : viewMode === "chef" ? r.chefId === currentUser.chefId : true
            ).length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-500">
                  No stock rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/** ---------- Audit Log ---------- */
function AuditLog({ items }: { items: { id: string; actorUserId: string; action: string; ts: string; meta?: any }[] }) {
  return (
    <Section title="Audit Trail">
      <div className="space-y-2">
        {items.map((a) => (
          <div key={a.id} className="border rounded-xl px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-medium">{a.action}</div>
              <div className="text-xs text-gray-500">{new Date(a.ts).toLocaleString()}</div>
            </div>
            <div className="text-xs text-gray-600">By: {a.actorUserId}</div>
            {a.meta && <pre className="text-xs bg-gray-50 p-2 rounded-lg mt-1 overflow-auto">{JSON.stringify(a.meta, null, 2)}</pre>}
          </div>
        ))}
        {items.length === 0 && <div className="text-sm text-gray-500">No activity yet.</div>}
      </div>
    </Section>
  );
}

/** =========================================================
 *                        MAIN APP
 * ========================================================= */
export default function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState<"overview" | "warehouse" | "chef" | "items" | "vendors" | "audit">("overview");
  const isFounder = currentUser?.role === "Founder";

  // Data hooks (Supabase)
  const { items, addItem, deleteItem } = useItems();
  const { vendors, addVendor, deleteVendor } = useVendors(currentUser?.chefId || undefined);
  const { stock, upsertStock, deleteRow } = useStock();
  const { audit, log } = useAudit();

  /** ---- Auth bootstrap + provisioning ---- */
  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const prof = await ensureProfile({ id: session.user.id, email: session.user.email });
        if (mounted) {
          setCurrentUser({
            id: session.user.id,
            email: session.user.email ?? null,
            name: prof.name || (session.user.email?.split("@")[0] ?? "User"),
            role: prof.role,
            chefId: prof.chef_id ?? null,
          });
        }
      } else {
        if (mounted) setCurrentUser(null);
      }

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const prof = await ensureProfile({ id: session.user.id, email: session.user.email });
          if (mounted) {
            setCurrentUser({
              id: session.user.id,
              email: session.user.email ?? null,
              name: prof.name || (session.user.email?.split("@")[0] ?? "User"),
              role: prof.role,
              chefId: prof.chef_id ?? null,
            });
          }
        } else {
          if (mounted) setCurrentUser(null);
        }
      });

      setAuthReady(true);
      return () => {
        mounted = false;
        sub.subscription.unsubscribe();
      };
    }

    init();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setCurrentUser(null);
  }

  /** ---- Gate: not ready / not logged in ---- */
  if (!authReady) {
    return <div className="p-6 text-sm text-gray-600">Loading…</div>;
  }
  if (!currentUser) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-semibold text-emerald-700">Grubwala Inventory</div>
            <Pill>{currentUser.role}</Pill>
            {currentUser.chefId && <Pill>Chef: {currentUser.chefId}</Pill>}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              {currentUser.name} • {currentUser.email}
            </div>
            <button onClick={signOut} className="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 mt-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            className={`px-3 py-2 rounded-xl border text-sm ${tab === "overview" ? "bg-emerald-50 border-emerald-200" : ""}`}
            onClick={() => setTab("overview")}
          >
            Overview
          </button>
          <button
            className={`px-3 py-2 rounded-xl border text-sm ${tab === "warehouse" ? "bg-emerald-50 border-emerald-200" : ""}`}
            onClick={() => setTab("warehouse")}
          >
            Warehouse
          </button>
          <button
            className={`px-3 py-2 rounded-xl border text-sm ${tab === "chef" ? "bg-emerald-50 border-emerald-200" : ""}`}
            onClick={() => setTab("chef")}
          >
            My Inventory
          </button>
          <button
            disabled={!isFounder}
            className={`px-3 py-2 rounded-xl border text-sm ${tab === "items" ? "bg-emerald-50 border-emerald-200" : ""} ${!isFounder ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={() => isFounder && setTab("items")}
          >
            Items (Founder)
          </button>
          <button
            className={`px-3 py-2 rounded-xl border text-sm ${tab === "vendors" ? "bg-emerald-50 border-emerald-200" : ""}`}
            onClick={() => setTab("vendors")}
          >
            Vendors
          </button>
          <button
            className={`px-3 py-2 rounded-xl border text-sm ${tab === "audit" ? "bg-emerald-50 border-emerald-200" : ""}`}
            onClick={() => setTab("audit")}
          >
            Audit
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-10">
          {tab === "overview" && (
            <InventoryManager
              currentUser={currentUser}
              items={items}
              vendors={vendors}
              stock={stock}
              viewMode="overview"
              onAdjust={async (args) => {
                await upsertStock(args);
                await log(currentUser.id, "stock.adjust", args);
              }}
              onDeleteRow={async (id) => {
                await deleteRow(id);
                await log(currentUser.id, "stock.delete", { id });
              }}
            />
          )}

          {tab === "warehouse" && (
            <InventoryManager
              currentUser={currentUser}
              items={items}
              vendors={vendors}
              stock={stock.filter((s) => !s.chefId)}
              viewMode="warehouse"
              onAdjust={async (args) => {
                await upsertStock({ ...args, chefId: null });
                await log(currentUser.id, "stock.adjust", args);
              }}
              onDeleteRow={async (id) => {
                await deleteRow(id);
                await log(currentUser.id, "stock.delete", { id });
              }}
            />
          )}

          {tab === "chef" && (
            <InventoryManager
              currentUser={currentUser}
              items={items}
              vendors={vendors}
              stock={stock.filter((s) => s.chefId === currentUser.chefId)}
              viewMode="chef"
              onAdjust={async (args) => {
                await upsertStock({ ...args, chefId: currentUser.chefId ?? null });
                await log(currentUser.id, "stock.adjust", args);
              }}
              onDeleteRow={async (id) => {
                await deleteRow(id);
                await log(currentUser.id, "stock.delete", { id });
              }}
            />
          )}

          {tab === "items" && (
            isFounder ? (
              <ItemsManager
                items={items}
                onAdd={async (row) => {
                  await addItem(row);
                  await log(currentUser.id, "item.add", row);
                }}
                onDelete={async (id) => {
                  await deleteItem(id);
                  await log(currentUser.id, "item.delete", { id });
                }}
              />
            ) : (
              <Section title="Items (Founder only)">
                <div className="text-sm text-gray-600">
                  Only founders can manage the master items catalog.
                </div>
              </Section>
            )
          )}

          {tab === "vendors" && (
            currentUser.chefId ? (
              <VendorsManager
                chefId={currentUser.chefId}
                vendors={vendors}
                onAdd={async (row) => {
                  await addVendor(row);
                  await log(currentUser.id, "vendor.add", row);
                }}
                onDelete={async (id) => {
                  await deleteVendor(id);
                  await log(currentUser.id, "vendor.delete", { id });
                }}
              />
            ) : (
              <Section title="Vendors">
                <div className="text-sm text-gray-600">
                  Switch to a Home Chef account to manage vendors.
                </div>
              </Section>
            )
          )}

          {tab === "audit" && <AuditLog items={audit} />}
        </div>
      </div>
    </div>
  );
}
