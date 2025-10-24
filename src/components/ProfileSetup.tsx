import { useMemo, useState } from 'react';
import type { Chef, ID, Role } from '../types';

type ProfileSetupProps = {
  email: string;
  displayName: string;
  chefs: Chef[];
  onSubmit: (payload: { role: Role; chefId?: ID | null; chefName?: string }) => Promise<void>;
  submitting?: boolean;
  serverError?: string | null;
};

type JoinMode = 'existing' | 'new';

export default function ProfileSetup({
  email,
  displayName,
  chefs,
  onSubmit,
  submitting = false,
  serverError = null
}: ProfileSetupProps) {
  const [role, setRole] = useState<Role>('Founder');
  const [joinMode, setJoinMode] = useState<JoinMode>(chefs.length > 0 ? 'existing' : 'new');
  const [selectedChefId, setSelectedChefId] = useState<ID | ''>('');
  const [chefName, setChefName] = useState(displayName || '');
  const [error, setError] = useState<string | null>(null);

  const chefOptions = useMemo(
    () => chefs.filter(chef => chef.isActive !== false).sort((a, b) => a.name.localeCompare(b.name)),
    [chefs]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (role === 'Founder') {
      await onSubmit({ role: 'Founder', chefId: null });
      return;
    }

    if (joinMode === 'existing') {
      if (!selectedChefId) {
        setError('Please select the kitchen you cook for.');
        return;
      }
      await onSubmit({ role: 'Home Chef', chefId: selectedChefId });
      return;
    }

    if (!chefName.trim()) {
      setError('Please name your kitchen.');
      return;
    }

    await onSubmit({ role: 'Home Chef', chefName: chefName.trim() });
  };

  return (
    <div className="max-w-lg mx-auto mt-12 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Set up your profile</h2>
      <p className="mt-2 text-sm text-gray-600">
        Signed in as <span className="font-medium">{email}</span>
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <label className="text-sm font-medium text-gray-700">How do you use Grubwala?</label>
          <div className="mt-3 grid gap-2">
            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${role === 'Founder' ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'}`}>
              <input
                type="radio"
                name="role"
                value="Founder"
                checked={role === 'Founder'}
                onChange={() => setRole('Founder')}
              />
              <div>
                <div className="font-medium">Founder / Warehouse</div>
                <p className="text-xs text-gray-500">Track central stock, vendors, and shipments.</p>
              </div>
            </label>

            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${role === 'Home Chef' ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'}`}>
              <input
                type="radio"
                name="role"
                value="Home Chef"
                checked={role === 'Home Chef'}
                onChange={() => setRole('Home Chef')}
              />
              <div>
                <div className="font-medium">Home Chef</div>
                <p className="text-xs text-gray-500">Log the containers you receive and use from your kitchen.</p>
              </div>
            </label>
          </div>
        </div>

        {role === 'Home Chef' && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm font-medium text-gray-700">
              Join existing kitchen?
              <label className="flex items-center gap-2 text-xs font-normal">
                <input
                  type="radio"
                  name="join-mode"
                  value="existing"
                  checked={joinMode === 'existing'}
                  onChange={() => setJoinMode('existing')}
                  disabled={chefOptions.length === 0}
                />
                Yes
              </label>
              <label className="flex items-center gap-2 text-xs font-normal">
                <input
                  type="radio"
                  name="join-mode"
                  value="new"
                  checked={joinMode === 'new'}
                  onChange={() => setJoinMode('new')}
                />
                No, create new kitchen
              </label>
            </div>

            {joinMode === 'existing' && chefOptions.length > 0 && (
              <select
                value={selectedChefId}
                onChange={event => setSelectedChefId(event.target.value as ID)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                required
              >
                <option value="">Select kitchen</option>
                {chefOptions.map(chef => (
                  <option key={chef.id} value={chef.id}>
                    {chef.name}
                  </option>
                ))}
              </select>
            )}

            {joinMode === 'new' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600" htmlFor="chef-name">
                  Kitchen name
                </label>
                <input
                  id="chef-name"
                  type="text"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={chefName}
                  onChange={event => setChefName(event.target.value)}
                  placeholder="e.g. Chef Aabha — South Delhi"
                  required
                />
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {serverError && <p className="text-sm text-red-600">{serverError}</p>}

        <button
          type="submit"
          className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow disabled:cursor-not-allowed disabled:opacity-70"
          disabled={submitting}
        >
          {submitting ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
