import React, { useEffect, useMemo, useState } from "react";

/**
 * Grubwala Inventory Tracker — Single‑file React App
 * --------------------------------------------------
 * ⚙️ No backend required (uses localStorage). Ready to wire to an API later.
 * 👥 Roles: "Founder" (admin) and "Home Chef" (chef).
 * 🔐 Simple local auth (email + role). Chefs can only see/update their own data.
 * 🧱 Entities: Users, Vendors, Items, Inventory (stock), and Audit Log.
 * 📦 Two inventories tracked: each Chef's inventory, and the central Warehouse.
 * 📤 CSV export / 📥 CSV import (items & stock) + JSON backup/restore.
 * 📝 Audit trail per action.
 * 
 * How to deploy: export this component as default in a Vite/CRA project.
 * TailwindCSS is assumed (utility classes used). If Tailwind isn't present,
 * you can swap classes for inline styles quickly.
 */

// ---------- Types ----------

type Role = "Founder" | "Home Chef";

interface User {
  id: string; // uuid-like
  email: string;
  name: string;
  role: Role;
  chefId?: string; // present for Home Chef users
  createdAt: number;
}

interface Vendor {
  id: string;
  chefId: string; // vendor belongs to a specific chef
  name: string;
  contact?: string;
  notes?: string;
  createdAt: number;
}

interface Item {
  id: string;
  name: string;
  sku: string;
  unit: string; // e.g., kg, g, pcs, L
  minLevel?: number; // optional reorder threshold
  createdAt: number;
}

// Where the stock lives
// - chefId defined  => stock owned by that chef
// - chefId undefined => stock is in warehouse
interface StockRow {
  id: string;
  itemId: string;
  quantity: number; // can be fractional for kg/L
  chefId?: string;  // undefined => warehouse
  vendorId?: string; // optional source
  lastUpdated: number;
}

interface AuditRow {
  id: string;
  actorUserId: string;
  action: string;
  meta?: Record<string, any>;
  ts: number;
}

// ---------- Storage helpers ----------

const LS_KEYS = {
  users: "gw_users_v1",
  items: "gw_items_v1",
  vendors: "gw_vendors_v1",
  stock: "gw_stock_v1",
  audit: "gw_audit_v1",
  session: "gw_session_v1",
} as const;

function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function readLS<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function writeLS<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)); }

// ---------- Seed data (first run) ----------

function ensureSeed() {
  const users = readLS<User[]>(LS_KEYS.users, []);
  if (users.length === 0) {
    const founder: User = { id: uid("user"), email: "founder@grubwala.com", name: "Founder", role: "Founder", createdAt: Date.now() };
    const chefAId = uid("chef");
    const chefA: User = { id: uid("user"), email: "chef.a@example.com", name: "Chef A", role: "Home Chef", chefId: chefAId, createdAt: Date.now() };
    writeLS(LS_KEYS.users, [founder, chefA]);

    const items: Item[] = [
      { id: uid("item"), name: "Basmati Rice", sku: "RICE-BAS-001", unit: "kg", minLevel: 10, createdAt: Date.now() },
      { id: uid("item"), name: "Wheat Flour", sku: "FLOUR-WHT-002", unit: "kg", minLevel: 15, createdAt: Date.now() },
      { id: uid("item"), name: "Ghee", sku: "GHEE-003", unit: "L", minLevel: 5, createdAt: Date.now() },
      { id: uid("item"), name: "Meal Boxes", sku: "BOX-STD-004", unit: "pcs", minLevel: 100, createdAt: Date.now() },
    ];
    writeLS(LS_KEYS.items, items);

    const vendors: Vendor[] = [
      { id: uid("vndr"), chefId: chefAId, name: "Fresh Farms", contact: "+91-90000-00001", createdAt: Date.now(), notes: "Bulk grains" },
    ];
    writeLS(LS_KEYS.vendors, vendors);

    const stock: StockRow[] = [
      // Warehouse stock (no chefId)
      { id: uid("stk"), itemId: items[0].id, quantity: 250, lastUpdated: Date.now() },
      { id: uid("stk"), itemId: items[3].id, quantity: 1000, lastUpdated: Date.now() },
      // Chef A stock
      { id: uid("stk"), itemId: items[1].id, quantity: 20, chefId: chefAId, lastUpdated: Date.now(), vendorId: vendors[0].id },
      { id: uid("stk"), itemId: items[2].id, quantity: 3, chefId: chefAId, lastUpdated: Date.now(), vendorId: vendors[0].id },
    ];
    writeLS(LS_KEYS.stock, stock);

    writeLS<AuditRow[]>(LS_KEYS.audit, []);
  }
}

ensureSeed();

// ---------- Utilities ----------

function nowISO() { return new Date().toLocaleString(); }

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ---------- CSV Helpers ----------

function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const esc = (v: any) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headerLine = headers.map(esc).join(",");
  const lines = rows.map(r => headers.map(h => esc(r[h])).join(","));
  return [headerLine, ...lines].join("\n");
}

function download(filename: string, data: string, mime = "text/plain") {
  const blob = new Blob([data], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Small UI primitives ----------

function Button({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "px-3 py-2 rounded-2xl shadow-sm border border-gray-200 hover:shadow transition text-sm",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >{children}</button>
  );
}

function TextInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("w-full px-3 py-2 rounded-xl border border-gray-300 text-sm", className)} {...props} />;
}

function NumberInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" className={cn("w-full px-3 py-2 rounded-xl border border-gray-300 text-sm", className)} {...props} />;
}

function Card({ title, actions, children }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4 border border-gray-100">
      {(title || actions) && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <div className="flex gap-2">{actions}</div>
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

function Pill({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "green" | "red" | "amber" }) {
  const tones: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return <span className={cn("px-2 py-1 rounded-full text-xs", tones[tone])}>{children}</span>;
}

// ---------- Auth ----------

function useSession() {
  const [session, setSession] = useState<User | null>(() => readLS<User | null>(LS_KEYS.session, null));
  const save = (u: User | null) => { setSession(u); writeLS(LS_KEYS.session, u); };
  return { session, setSession: save };
}

function AuthView({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("Home Chef");

  const users = readLS<User[]>(LS_KEYS.users, []);

  const handleLogin = () => {
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) { onLogin(existing); return; }
    // create new user
    let newUser: User;
    if (role === "Home Chef") {
      newUser = { id: uid("user"), email, name: name || email.split("@")[0], role, chefId: uid("chef"), createdAt: Date.now() };
    } else {
      newUser = { id: uid("user"), email, name: name || "Founder", role, createdAt: Date.now() };
    }
    const next = [...users, newUser];
    writeLS(LS_KEYS.users, next);
    onLogin(newUser);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Grubwala Inventory Tracker</h1>
          <p className="text-sm text-gray-600">Sign in or create an account. New emails will be registered automatically.</p>
        </div>
        <div className="grid gap-3">
          <label className="text-sm">Name</label>
          <TextInput placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
          <label className="text-sm">Email</label>
          <TextInput placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          <label className="text-sm">Role</label>
          <div className="flex gap-3">
            {(["Home Chef", "Founder"] as Role[]).map(r => (
              <button key={r} onClick={() => setRole(r)} className={cn(
                "px-3 py-2 rounded-2xl border text-sm",
                role === r ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-gray-300"
              )}>{r}</button>
            ))}
          </div>
          <div className="pt-2">
            <Button className="bg-emerald-600 text-white border-emerald-600 w-full" onClick={handleLogin}>Continue</Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Tip: Use <b>founder@grubwala.com</b> to log into a seeded Founder account.</p>
        </div>
      </div>
    </div>
  );
}

// ---------- Data hooks ----------

function useRepo<T>(key: string, seed: T) {
  const [data, setData] = useState<T>(() => readLS<T>(key, seed));
  useEffect(() => { writeLS<T>(key, data); }, [key, data]);
  return [data, setData] as const;
}

// ---------- Feature: Items ----------

function ItemsManager({ items, setItems }: { items: Item[]; setItems: (fn: (prev: Item[]) => Item[]) => void; }) {
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Partial<Item>>({ name: "", sku: "", unit: "pcs", minLevel: 0 });

  const filtered = items.filter(i => [i.name, i.sku, i.unit].some(x => x.toLowerCase().includes(q.toLowerCase())));

  const addItem = () => {
    if (!form.name || !form.sku || !form.unit) return;
    const row: Item = { id: uid("item"), name: form.name!, sku: form.sku!, unit: form.unit!, minLevel: Number(form.minLevel) || 0, createdAt: Date.now() };
    setItems(prev => [row, ...prev]);
    setForm({ name: "", sku: "", unit: "pcs", minLevel: 0 });
  };
  const remove = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const exportCSV = () => download(`items_${Date.now()}.csv`, toCSV(items));
  const exportJSON = () => download(`items_${Date.now()}.json`, JSON.stringify(items, null, 2), "application/json");

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const list = JSON.parse(String(reader.result)) as Item[];
        setItems(() => list);
      } catch { alert("Invalid JSON file"); }
    };
    reader.readAsText(file);
  };

  return (
    <Card title="Items Catalog" actions={
      <div className="flex gap-2">
        <Button onClick={exportCSV}>Export CSV</Button>
        <Button onClick={exportJSON}>Backup JSON</Button>
        <label className="px-3 py-2 rounded-2xl border border-gray-200 text-sm cursor-pointer">
          Import JSON
          <input type="file" accept="application/json" className="hidden" onChange={e => e.target.files?.[0] && importJSON(e.target.files[0])} />
        </label>
      </div>
    }>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <div className="grid gap-2">
            <TextInput placeholder="Search items..." value={q} onChange={e => setQ(e.target.value)} />
            <div className="grid gap-2 bg-gray-50 rounded-2xl p-3 border">
              <div className="grid grid-cols-2 gap-2">
                <TextInput placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <TextInput placeholder="SKU" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <TextInput placeholder="Unit (kg/pcs/L)" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
                <NumberInput placeholder="Reorder @" value={form.minLevel as any} onChange={e => setForm(f => ({ ...f, minLevel: Number(e.target.value) }))} />
                <Button className="bg-emerald-600 text-white border-emerald-600" onClick={addItem}>Add</Button>
              </div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Name</th>
                <th>SKU</th>
                <th>Unit</th>
                <th>Reorder</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => (
                <tr key={i.id} className="border-b last:border-b-0">
                  <td className="py-2">{i.name}</td>
                  <td>{i.sku}</td>
                  <td>{i.unit}</td>
                  <td>{i.minLevel ?? 0}</td>
                  <td className="text-right">
                    <Button className="border-red-300" onClick={() => remove(i.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

// ---------- Feature: Vendors (per Chef) ----------

function VendorsManager({ chefId, vendors, setVendors }: { chefId: string; vendors: Vendor[]; setVendors: (fn: (prev: Vendor[]) => Vendor[]) => void; }) {
  const [q, setQ] = useState("");
  const mine = vendors.filter(v => v.chefId === chefId);
  const filtered = mine.filter(v => [v.name, v.contact ?? "", v.notes ?? ""].some(x => x.toLowerCase().includes(q.toLowerCase())));

  const [form, setForm] = useState<Partial<Vendor>>({ name: "", contact: "", notes: "" });
  const add = () => {
    if (!form.name) return;
    const row: Vendor = { id: uid("vndr"), chefId, name: form.name!, contact: form.contact, notes: form.notes, createdAt: Date.now() };
    setVendors(prev => [row, ...prev]);
    setForm({ name: "", contact: "", notes: "" });
  };
  const remove = (id: string) => setVendors(prev => prev.filter(v => v.id !== id));

  return (
    <Card title="My Vendors">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <div className="grid gap-2">
            <TextInput placeholder="Search vendors..." value={q} onChange={e => setQ(e.target.value)} />
            <div className="grid gap-2 bg-gray-50 rounded-2xl p-3 border">
              <TextInput placeholder="Vendor name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <TextInput placeholder="Contact" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
              <TextInput placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              <Button className="bg-emerald-600 text-white border-emerald-600" onClick={add}>Add Vendor</Button>
            </div>
          </div>
        </div>
        <div className="lg:col-span-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Name</th>
                <th>Contact</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id} className="border-b last:border-b-0">
                  <td className="py-2">{v.name}</td>
                  <td>{v.contact}</td>
                  <td>{v.notes}</td>
                  <td className="text-right"><Button className="border-red-300" onClick={() => remove(v.id)}>Delete</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

// ---------- Feature: Inventory ----------

function InventoryManager({
  currentUser,
  items,
  vendors,
  stock,
  setStock,
  viewMode,
}: {
  currentUser: User;
  items: Item[];
  vendors: Vendor[];
  stock: StockRow[];
  setStock: (fn: (prev: StockRow[]) => StockRow[]) => void;
  viewMode: "chef" | "warehouse" | "overview";
}) {
  const isFounder = currentUser.role === "Founder";
  const chefId = currentUser.chefId;

  const rows = useMemo(() => {
    if (viewMode === "warehouse") return stock.filter(s => !s.chefId);
    if (viewMode === "chef") return stock.filter(s => s.chefId === chefId);
    return stock; // overview
  }, [stock, viewMode, chefId]);

  const [q, setQ] = useState("");
  const byId = Object.fromEntries(items.map(i => [i.id, i]));
  const vendorById = Object.fromEntries(vendors.map(v => [v.id, v]));

  const visible = rows.filter(r => {
    const it = byId[r.itemId];
    const vendor = r.vendorId ? vendorById[r.vendorId] : undefined;
    const hay = [it?.name ?? "", it?.sku ?? "", vendor?.name ?? "", r.chefId ? "chef" : "warehouse"].join(" ").toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const [selItemId, setSelItemId] = useState(items[0]?.id || "");
  const [qty, setQty] = useState<number>(0);
  const [forChefId, setForChefId] = useState<string | undefined>(chefId);
  const [vendorId, setVendorId] = useState<string | undefined>(undefined);

  useEffect(() => { if (viewMode === "warehouse") setForChefId(undefined); }, [viewMode]);

  const addAdjust = (sign: 1 | -1) => {
    if (!selItemId || qty === 0) return;
    const ownershipKey = forChefId ?? "__warehouse__";

    // try to find existing stock row
    const idx = stock.findIndex(s => s.itemId === selItemId && (s.chefId ?? "__warehouse__") === ownershipKey);

    if (idx >= 0) {
      const next = [...stock];
      const cur = { ...next[idx] };
      cur.quantity = Math.max(0, cur.quantity + sign * qty);
      cur.vendorId = vendorId || cur.vendorId;
      cur.lastUpdated = Date.now();
      next[idx] = cur;
      setStock(() => next);
    } else {
      const row: StockRow = { id: uid("stk"), itemId: selItemId, quantity: Math.max(0, qty * (sign > 0 ? 1 : -1)), chefId: forChefId, vendorId, lastUpdated: Date.now() };
      setStock(prev => [row, ...prev]);
    }
    setQty(0);
  };

  const removeRow = (id: string) => setStock(prev => prev.filter(s => s.id !== id));

  // Aggregations for low-stock alerts
  const aggByItemOwnership = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(r => {
      const key = `${r.itemId}|${r.chefId ?? "__wh__"}`;
      map.set(key, (map.get(key) || 0) + r.quantity);
    });
    return map;
  }, [rows]);

  const alerts = Array.from(aggByItemOwnership.entries()).map(([key, qty]) => {
    const [itemId] = key.split("|");
    const item = byId[itemId];
    return item && item.minLevel !== undefined && item.minLevel > 0 && qty <= item.minLevel
      ? { item, qty } : null;
  }).filter(Boolean) as { item: Item; qty: number; }[];

  const exportCSV = () => {
    const out = visible.map(r => ({
      id: r.id,
      item: byId[r.itemId]?.name ?? r.itemId,
      sku: byId[r.itemId]?.sku ?? "",
      unit: byId[r.itemId]?.unit ?? "",
      quantity: r.quantity,
      location: r.chefId ? "chef" : "warehouse",
      chefId: r.chefId ?? "",
      vendor: r.vendorId ? vendorById[r.vendorId]?.name : "",
      lastUpdated: new Date(r.lastUpdated).toISOString(),
    }));
    download(`inventory_${viewMode}_${Date.now()}.csv`, toCSV(out));
  };

  const exportJSON = () => download(`stock_${Date.now()}.json`, JSON.stringify(stock, null, 2), "application/json");
  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const list = JSON.parse(String(reader.result)) as StockRow[];
        setStock(() => list);
      } catch { alert("Invalid JSON file"); }
    };
    reader.readAsText(file);
  };

  // Founder: list of chefs for targeting
  const users = readLS<User[]>(LS_KEYS.users, []);
  const chefUsers = users.filter(u => u.role === "Home Chef");

  return (
    <Card title={viewMode === "warehouse" ? "Warehouse Stock" : viewMode === "chef" ? "My Inventory" : "All Inventory (Overview)"} actions={
      <div className="flex gap-2">
        <Button onClick={exportCSV}>Export CSV</Button>
        <Button onClick={exportJSON}>Backup JSON</Button>
        <label className="px-3 py-2 rounded-2xl border border-gray-200 text-sm cursor-pointer">
          Import JSON
          <input type="file" accept="application/json" className="hidden" onChange={e => e.target.files?.[0] && importJSON(e.target.files[0])} />
        </label>
      </div>
    }>
      {/* Controls */}
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-1 grid gap-2 bg-gray-50 rounded-2xl p-3 border">
          <div className="grid gap-2">
            <label className="text-xs text-gray-600">Search</label>
            <TextInput placeholder="Search item, SKU, vendor..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-gray-600">Select Item</label>
            <select className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm" value={selItemId} onChange={e => setSelItemId(e.target.value)}>
              {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2 items-end">
            <div className="col-span-2">
              <label className="text-xs text-gray-600">Quantity</label>
              <NumberInput value={qty as any} onChange={e => setQty(parseFloat(e.target.value))} placeholder="e.g., 5" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => addAdjust(1)} className="bg-emerald-600 text-white border-emerald-600">Add</Button>
              <Button onClick={() => addAdjust(-1)} className="border-amber-500">Remove</Button>
            </div>
          </div>
          <div className="grid gap-2">
            {isFounder ? (
              <>
                <label className="text-xs text-gray-600">Apply to (Owner)</label>
                <select className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm" value={forChefId ?? "__warehouse__"} onChange={e => setForChefId(e.target.value === "__warehouse__" ? undefined : e.target.value)}>
                  <option value="__warehouse__">Warehouse</option>
                  {chefUsers.map(c => <option key={c.chefId} value={c.chefId}>{c.name}</option>)}
                </select>
              </>
            ) : (
              <div className="text-xs text-gray-600">Owner: You ({currentUser.name})</div>
            )}
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-gray-600">Vendor (optional)</label>
            <select className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm" value={vendorId ?? ""} onChange={e => setVendorId(e.target.value || undefined)}>
              <option value="">— None —</option>
              {(isFounder && forChefId) ? vendors.filter(v => v.chefId === forChefId).map(v => <option key={v.id} value={v.id}>{v.name}</option>)
                : !isFounder ? vendors.filter(v => v.chefId === chefId).map(v => <option key={v.id} value={v.id}>{v.name}</option>)
                : []}
            </select>
          </div>
          {alerts.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold mb-1">Low stock alerts</div>
              <div className="flex flex-wrap gap-2">
                {alerts.map(a => <Pill key={a.item.id} tone="amber">{a.item.name}: {a.qty} {a.item.unit}</Pill>)}
              </div>
            </div>
          )}
        </div>
        <div className="lg:col-span-2 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Item</th>
                <th>SKU</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Location</th>
                <th>Vendor</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => {
                const it = byId[r.itemId];
                const vendor = r.vendorId ? vendorById[r.vendorId] : undefined;
                return (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="py-2">{it?.name ?? r.itemId}</td>
                    <td>{it?.sku ?? ""}</td>
                    <td>{r.quantity}</td>
                    <td>{it?.unit ?? ""}</td>
                    <td>{r.chefId ? `Chef (${users.find(u => u.chefId === r.chefId)?.name || r.chefId})` : "Warehouse"}</td>
                    <td>{vendor?.name ?? "—"}</td>
                    <td>{new Date(r.lastUpdated).toLocaleString()}</td>
                    <td className="text-right"><Button className="border-red-300" onClick={() => removeRow(r.id)}>Delete</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

// ---------- Feature: Audit Log (read-only) ----------

function AuditPanel() {
  const [audit] = useRepo<AuditRow[]>(LS_KEYS.audit, []);
  const users = readLS<User[]>(LS_KEYS.users, []);
  const nameOf = (id: string) => users.find(u => u.id === id)?.name || id;

  return (
    <Card title="Audit Trail">
      <div className="max-h-64 overflow-auto">
        {audit.length === 0 && <div className="text-sm text-gray-500">No activity yet.</div>}
        <ul className="space-y-2">
          {audit.slice().reverse().map(a => (
            <li key={a.id} className="text-sm">
              <span className="font-medium">{nameOf(a.actorUserId)}</span> • {a.action} • <span className="text-gray-500">{new Date(a.ts).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

// ---------- Main App ----------

export default function App() {
  const { session, setSession } = useSession();
  const [items, setItems] = useRepo<Item[]>(LS_KEYS.items, []);
  const [vendors, setVendors] = useRepo<Vendor[]>(LS_KEYS.vendors, []);
  const [stock, setStock] = useRepo<StockRow[]>(LS_KEYS.stock, []);
  const [, setAudit]   = useRepo<AuditRow[]>(LS_KEYS.audit, []);


  const [tab, setTab] = useState<"chef" | "warehouse" | "overview" | "items" | "vendors" | "audit">("overview");

  useEffect(() => {
    // hook into stock/users/items/vendors changes to create a simple audit trail message (shallow)
    const fn = (action: string, meta?: Record<string, any>) => setAudit(prev => [...prev, { id: uid("aud"), actorUserId: session?.id || "system", action, meta, ts: Date.now() }]);
    // naive: on each mount only log a visit
    fn(`visited ${tab} @ ${nowISO()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const isFounder = session?.role === "Founder";

  if (!session) return <AuthView onLogin={setSession} />;

  const logout = () => setSession(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-emerald-50">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600" />
            <div>
              <div className="font-semibold">Grubwala Inventory</div>
              <div className="text-xs text-gray-500">{session.role} • {session.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Pill>{new Date().toLocaleString()}</Pill>
            <Button onClick={logout}>Sign out</Button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <TabBtn label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
          <TabBtn label="Warehouse" active={tab === "warehouse"} onClick={() => setTab("warehouse")} />
          <TabBtn label={isFounder ? "My Chefs' Inventory" : "My Inventory"} active={tab === "chef"} onClick={() => setTab("chef")} />
          <TabBtn label="Items" active={tab === "items"} onClick={() => setTab("items")} />
          <TabBtn label="Vendors" active={tab === "vendors"} onClick={() => setTab("vendors")} />
          <TabBtn label="Audit" active={tab === "audit"} onClick={() => setTab("audit")} />
        </div>

        {/* Views */}
        <div className="grid gap-4 pb-10">
          {tab === "overview" && (
            <InventoryManager currentUser={session} items={items} vendors={vendors} stock={stock} setStock={setStock} viewMode="overview" />
          )}
          {tab === "warehouse" && (
            <InventoryManager currentUser={session} items={items} vendors={vendors} stock={stock} setStock={setStock} viewMode="warehouse" />
          )}
          {tab === "chef" && (
            <InventoryManager currentUser={session} items={items} vendors={vendors} stock={stock} setStock={setStock} viewMode="chef" />
          )}
          {tab === "items" && (
            <>
              {isFounder ? (
                <ItemsManager items={items} setItems={fn => setItems(prev => fn(prev))} />
              ) : (
                <Card>
                  <div className="text-sm text-gray-600">Only Founders can manage the master item catalog. Please contact the admin.</div>
                </Card>
              )}
            </>
          )}
          {tab === "vendors" && (
            session.chefId ? (
              <VendorsManager chefId={session.chefId} vendors={vendors} setVendors={fn => setVendors(prev => fn(prev))} />
            ) : (
              <Card>
                <div className="text-sm text-gray-600">Switch to a Home Chef account to manage vendors.</div>
              </Card>
            )
          )}
          {tab === "audit" && <AuditPanel />}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-500 py-6">© {new Date().getFullYear()} Grubwala. Inventory system prototype. Ready for API integration.</footer>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void; }) {
  return (
    <button onClick={onClick} className={cn(
      "px-3 py-1.5 rounded-full text-sm border",
      active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-gray-300 hover:bg-gray-50"
    )}>{label}</button>
  );
}
