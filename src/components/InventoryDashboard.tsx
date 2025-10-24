import { useMemo, useState } from 'react';
import type {
  AuditEntry,
  Chef,
  ID,
  Item,
  Profile,
  StockRow,
  Vendor
} from '../types';
import type { MovementInput } from '../hooks/useStock';

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

type InventoryDashboardProps = {
  profile: Profile;
  items: Item[];
  vendors: Vendor[];
  chefs: Chef[];
  movements: StockRow[];
  audit: AuditEntry[];
  getOnHand: (itemId: ID, chefId?: ID | null) => number;
  onRecordMovement: (payload: MovementInput) => Promise<void>;
  onCreateItem: (payload: Omit<Item, 'id'>) => Item;
  onCreateVendor: (payload: Omit<Vendor, 'id'>) => Vendor;
  onCreateChef: (payload: Omit<Chef, 'id'>) => Chef;
};

type MovementFormState = {
  owner: ID | 'warehouse';
  itemId: ID | '';
  vendorId: ID | '';
  type: MovementInput['type'];
  quantity: string;
  note: string;
};

export default function InventoryDashboard({
  profile,
  items,
  vendors,
  chefs,
  movements,
  audit,
  getOnHand,
  onRecordMovement,
  onCreateItem,
  onCreateVendor,
  onCreateChef
}: InventoryDashboardProps) {
  const isFounder = profile.role === 'Founder';
  const defaultOwner = isFounder ? 'warehouse' : (profile.chefId ?? 'warehouse');
  const [form, setForm] = useState<MovementFormState>(() => ({
    owner: defaultOwner,
    itemId: items[0]?.id ?? '',
    vendorId: vendors[0]?.id ?? '',
    type: 'IN',
    quantity: '1',
    note: ''
  }));
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [itemDraft, setItemDraft] = useState({ name: '', sku: '', unit: 'pcs' as Item['unit'], minStock: 0 });
  const [vendorDraft, setVendorDraft] = useState({ name: '', phone: '' });
  const [chefDraft, setChefDraft] = useState({ name: '', email: '' });
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);

  const itemById = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);
  const vendorById = useMemo(() => new Map(vendors.map(vendor => [vendor.id, vendor])), [vendors]);
  const chefById = useMemo(() => new Map(chefs.map(chef => [chef.id, chef])), [chefs]);

  const ownerLabel = (chefId: ID | null) => (chefId ? (chefById.get(chefId)?.name ?? 'Home Chef') : 'Warehouse');

  const visibleMovements = useMemo(() => {
    if (isFounder) return movements;
    if (!profile.chefId) return movements.filter(mv => mv.chefId === null);
    return movements.filter(mv => mv.chefId === profile.chefId);
  }, [movements, isFounder, profile.chefId]);

  const visibleAudit = useMemo(() => {
    if (isFounder) return audit;
    if (!profile.chefId) return audit.filter(entry => entry.scope === 'founder');
    return audit.filter(entry => entry.chefId === profile.chefId || entry.scope === 'founder');
  }, [audit, isFounder, profile.chefId]);

  const totalWarehouse = useMemo(
    () => items.reduce((acc, item) => acc + getOnHand(item.id, null), 0),
    [items, getOnHand, movements]
  );

  const totalForChef = (chefId: ID | null) => items.reduce((acc, item) => acc + getOnHand(item.id, chefId), 0);

  const totalMine = useMemo(() => totalForChef(profile.chefId ?? null), [profile.chefId, items, getOnHand, movements]);

  const shipmentsIn = useMemo(
    () => visibleMovements.filter(mv => mv.type === 'IN').length,
    [visibleMovements]
  );

  const shipmentsOut = useMemo(
    () => visibleMovements.filter(mv => mv.type === 'OUT').length,
    [visibleMovements]
  );

  const ownerSummaries = useMemo(() => {
    if (!isFounder) {
      return [
        {
          chefId: profile.chefId ?? null,
          name: ownerLabel(profile.chefId ?? null),
          totals: items.map(item => ({
            item,
            quantity: getOnHand(item.id, profile.chefId ?? null)
          }))
        }
      ];
    }

    const allOwners: Array<{ chefId: ID | null; name: string; totals: Array<{ item: Item; quantity: number }> }> = [];
    allOwners.push({
      chefId: null,
      name: 'Warehouse',
      totals: items.map(item => ({ item, quantity: getOnHand(item.id, null) }))
    });

    for (const chef of chefs) {
      allOwners.push({
        chefId: chef.id,
        name: chef.name,
        totals: items.map(item => ({ item, quantity: getOnHand(item.id, chef.id) }))
      });
    }

    return allOwners;
  }, [isFounder, profile.chefId, chefs, items, getOnHand, movements]);

  const handleFormChange = <K extends keyof MovementFormState>(key: K, value: MovementFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFormMessage(null);
    setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setFormMessage(null);

    if (!form.itemId) {
      setFormError('Select a container.');
      return;
    }

    const quantity = Number(form.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError('Quantity must be a positive number.');
      return;
    }

    const payload: MovementInput = {
      itemId: form.itemId,
      vendorId: form.vendorId || undefined,
      type: form.type,
      quantity,
      note: form.note.trim() ? form.note.trim() : undefined,
      chefId: form.owner === 'warehouse' ? null : form.owner
    };

    try {
      setSubmitting(true);
      await onRecordMovement(payload);
      setForm(prev => ({ ...prev, quantity: '1', note: '' }));
      setFormMessage('Movement logged successfully.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to log movement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddItem = (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemDraft.name.trim()) return;
    const payload: Omit<Item, 'id'> = {
      name: itemDraft.name.trim(),
      unit: itemDraft.unit,
      sku: itemDraft.sku.trim() || undefined,
      minStock: itemDraft.minStock || undefined,
      isActive: true
    };
    const item = onCreateItem(payload);
    setItemDraft({ name: '', sku: '', unit: itemDraft.unit, minStock: 0 });
    setForm(prev => ({ ...prev, itemId: item.id }));
    setCatalogMessage(`Added container “${item.name}”.`);
  };

  const handleAddVendor = (event: React.FormEvent) => {
    event.preventDefault();
    if (!vendorDraft.name.trim()) return;
    const payload: Omit<Vendor, 'id'> = {
      name: vendorDraft.name.trim(),
      phone: vendorDraft.phone.trim() || undefined,
      isActive: true
    };
    const vendor = onCreateVendor(payload);
    setVendorDraft({ name: '', phone: '' });
    setForm(prev => ({ ...prev, vendorId: vendor.id }));
    setCatalogMessage(`Added vendor “${vendor.name}”.`);
  };

  const handleAddChef = (event: React.FormEvent) => {
    event.preventDefault();
    if (!chefDraft.name.trim()) return;
    const payload: Omit<Chef, 'id'> = {
      name: chefDraft.name.trim(),
      email: chefDraft.email.trim() || undefined,
      isActive: true
    };
    const chef = onCreateChef(payload);
    setChefDraft({ name: '', email: '' });
    setCatalogMessage(`Added kitchen “${chef.name}”.`);
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-gray-900">Inventory overview</h1>
        <p className="text-sm text-gray-600">
          Track containers across the warehouse and every chef. Use the log below to record what ships in and out.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title={isFounder ? 'Warehouse on hand' : 'Containers on hand'} value={isFounder ? totalWarehouse : totalMine} />
          <SummaryCard title="Shipments received" value={shipmentsIn} />
          <SummaryCard title="Shipments sent" value={shipmentsOut} />
          {isFounder && <SummaryCard title="Chefs on hand" value={chefs.reduce((acc, chef) => acc + totalForChef(chef.id), 0)} />}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Log a movement</h2>
            <p className="text-sm text-gray-600">Record containers coming in or going out for a kitchen.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
          {isFounder && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Inventory owner</label>
              <select
                value={form.owner}
                onChange={event => handleFormChange('owner', event.target.value as MovementFormState['owner'])}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              >
                <option value="warehouse">Warehouse</option>
                {chefs.map(chef => (
                  <option key={chef.id} value={chef.id}>
                    {chef.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Container</label>
            <select
              value={form.itemId}
              onChange={event => handleFormChange('itemId', event.target.value as ID)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Vendor</label>
            <select
              value={form.vendorId}
              onChange={event => handleFormChange('vendorId', event.target.value as ID)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="">Not specified</option>
              {vendors.map(vendor => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Movement</label>
            <div className="flex gap-2">
              {(['IN', 'OUT'] satisfies MovementInput['type'][]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleFormChange('type', type)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                    form.type === type ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {type === 'IN' ? 'Incoming' : 'Outgoing'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Quantity</label>
            <input
              type="number"
              min={1}
              step={1}
              value={form.quantity}
              onChange={event => handleFormChange('quantity', event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-medium text-gray-600">Notes</label>
            <textarea
              value={form.note}
              onChange={event => handleFormChange('note', event.target.value)}
              rows={2}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="e.g. Dispatched for Chef Priya’s dinner service"
            />
          </div>

          <div className="md:col-span-2 flex flex-col gap-2">
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            {formMessage && <p className="text-sm text-emerald-600">{formMessage}</p>}
            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Record movement'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Inventory by kitchen</h2>
            <p className="text-sm text-gray-600">Live on-hand counts for every chef and the warehouse.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {ownerSummaries.map(owner => (
            <div key={owner.chefId ?? 'warehouse'} className="rounded-xl border bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-800">{owner.name}</h3>
              <ul className="mt-3 space-y-1 text-sm text-gray-700">
                {owner.totals.map(total => (
                  <li key={total.item.id} className="flex items-center justify-between">
                    <span>{total.item.name}</span>
                    <span className={total.quantity < 0 ? 'text-red-600' : ''}>{total.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Movement log</h2>
            <p className="text-sm text-gray-600">Detailed log of inventory coming in and out.</p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Container</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {visibleMovements.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-sm text-gray-500" colSpan={7}>
                    No movements recorded yet.
                  </td>
                </tr>
              )}
              {visibleMovements.map(movement => {
                const item = itemById.get(movement.itemId);
                const vendor = movement.vendorId ? vendorById.get(movement.vendorId) : null;
                return (
                  <tr key={movement.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 align-top text-xs text-gray-500">
                      {dateFormatter.format(new Date(movement.timestamp))}
                    </td>
                    <td className="px-3 py-2 align-top">{ownerLabel(movement.chefId ?? null)}</td>
                    <td className="px-3 py-2 align-top">{item?.name ?? movement.itemId}</td>
                    <td className="px-3 py-2 align-top">{vendor?.name ?? '—'}</td>
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          movement.type === 'IN'
                            ? 'bg-emerald-100 text-emerald-700'
                            : movement.type === 'OUT'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {movement.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top text-right font-mono">
                      {movement.type === 'OUT' ? '-' : '+'}
                      {movement.quantity}
                    </td>
                    <td className="px-3 py-2 align-top text-gray-600">{movement.note ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {isFounder && (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Catalog management</h2>
              <p className="text-sm text-gray-600">
                Add containers, vendors, and kitchens so you can assign inventory accurately.
              </p>
            </div>
            {catalogMessage && <p className="text-sm text-emerald-600">{catalogMessage}</p>}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <form onSubmit={handleAddItem} className="space-y-3 rounded-xl border p-4">
              <h3 className="text-sm font-semibold text-gray-800">Add container type</h3>
              <div className="space-y-1 text-sm">
                <label className="text-xs font-medium text-gray-600" htmlFor="container-name">
                  Name
                </label>
                <input
                  id="container-name"
                  type="text"
                  className="w-full rounded-xl border px-3 py-2"
                  value={itemDraft.name}
                  onChange={event => setItemDraft(draft => ({ ...draft, name: event.target.value }))}
                  placeholder="e.g. 500 ml Container"
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 text-sm">
                  <label className="text-xs font-medium text-gray-600" htmlFor="container-sku">
                    SKU (optional)
                  </label>
                  <input
                    id="container-sku"
                    type="text"
                    className="w-full rounded-xl border px-3 py-2"
                    value={itemDraft.sku}
                    onChange={event => setItemDraft(draft => ({ ...draft, sku: event.target.value }))}
                  />
                </div>
                <div className="space-y-1 text-sm">
                  <label className="text-xs font-medium text-gray-600" htmlFor="container-unit">
                    Unit
                  </label>
                  <select
                    id="container-unit"
                    className="w-full rounded-xl border px-3 py-2"
                    value={itemDraft.unit}
                    onChange={event => setItemDraft(draft => ({ ...draft, unit: event.target.value as Item['unit'] }))}
                  >
                    <option value="pcs">Pieces</option>
                    <option value="ml">Millilitres</option>
                    <option value="ltr">Litres</option>
                    <option value="kg">Kilograms</option>
                    <option value="g">Grams</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <label className="text-xs font-medium text-gray-600" htmlFor="container-min">
                  Minimum stock alert
                </label>
                <input
                  id="container-min"
                  type="number"
                  min={0}
                  className="w-full rounded-xl border px-3 py-2"
                  value={itemDraft.minStock}
                  onChange={event =>
                    setItemDraft(draft => ({ ...draft, minStock: Number(event.target.value) || 0 }))
                  }
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
              >
                Add container
              </button>
            </form>

            <form onSubmit={handleAddVendor} className="space-y-3 rounded-xl border p-4">
              <h3 className="text-sm font-semibold text-gray-800">Add vendor</h3>
              <div className="space-y-1 text-sm">
                <label className="text-xs font-medium text-gray-600" htmlFor="vendor-name">
                  Name
                </label>
                <input
                  id="vendor-name"
                  type="text"
                  className="w-full rounded-xl border px-3 py-2"
                  value={vendorDraft.name}
                  onChange={event => setVendorDraft(draft => ({ ...draft, name: event.target.value }))}
                  placeholder="e.g. Alpha Packaging"
                  required
                />
              </div>
              <div className="space-y-1 text-sm">
                <label className="text-xs font-medium text-gray-600" htmlFor="vendor-phone">
                  Phone (optional)
                </label>
                <input
                  id="vendor-phone"
                  type="text"
                  className="w-full rounded-xl border px-3 py-2"
                  value={vendorDraft.phone}
                  onChange={event => setVendorDraft(draft => ({ ...draft, phone: event.target.value }))}
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
              >
                Add vendor
              </button>
            </form>

            <form onSubmit={handleAddChef} className="space-y-3 rounded-xl border p-4 md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-800">Add kitchen / chef</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 text-sm">
                  <label className="text-xs font-medium text-gray-600" htmlFor="chef-name">
                    Kitchen name
                  </label>
                  <input
                    id="chef-name"
                    type="text"
                    className="w-full rounded-xl border px-3 py-2"
                    value={chefDraft.name}
                    onChange={event => setChefDraft(draft => ({ ...draft, name: event.target.value }))}
                    placeholder="e.g. Chef Riya — Gurgaon"
                    required
                  />
                </div>
                <div className="space-y-1 text-sm">
                  <label className="text-xs font-medium text-gray-600" htmlFor="chef-email">
                    Contact email (optional)
                  </label>
                  <input
                    id="chef-email"
                    type="email"
                    className="w-full rounded-xl border px-3 py-2"
                    value={chefDraft.email}
                    onChange={event => setChefDraft(draft => ({ ...draft, email: event.target.value }))}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white md:w-auto"
              >
                Add kitchen
              </button>
            </form>
          </div>
        </section>
      )}

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Activity feed</h2>
            <p className="text-sm text-gray-600">Audit trail of movements and catalog changes.</p>
          </div>
        </div>

        <ul className="mt-4 space-y-2 text-sm text-gray-700">
          {visibleAudit.length === 0 && (
            <li className="text-sm text-gray-500">No activity logged yet.</li>
          )}
          {visibleAudit.map(entry => (
            <li key={entry.id} className="rounded-xl border bg-gray-50 px-3 py-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{dateFormatter.format(new Date(entry.timestamp))}</span>
                <span>{entry.scope === 'founder' ? 'Warehouse' : ownerLabel(entry.chefId ?? null)}</span>
              </div>
              <div className="mt-1 font-medium text-gray-800">{entry.action}</div>
              {entry.meta && (
                <pre className="mt-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-xs text-gray-600">
                  {JSON.stringify(entry.meta, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type SummaryCardProps = {
  title: string;
  value: number;
};

function SummaryCard({ title, value }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
