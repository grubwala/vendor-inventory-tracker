import { useMemo, useState } from 'react';
import type { Chef, ID } from '../types';

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

export function useChefs(initial: Chef[] = []) {
  const [chefs, setChefs] = useState<Chef[]>(initial);

  const addChef = (partial: Omit<Chef, 'id'>) => {
    const next: Chef = { id: genId(), isActive: true, ...partial };
    setChefs(prev => [...prev, next]);
    return next;
  };

  const updateChef = (id: ID, patch: Partial<Chef>) => {
    setChefs(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  };

  const deleteChef = (id: ID) => {
    setChefs(prev => prev.filter(c => c.id !== id));
  };

  const byId = useMemo(() => {
    const map = new Map<ID, Chef>();
    for (const chef of chefs) map.set(chef.id, chef);
    return map;
  }, [chefs]);

  return { chefs, addChef, updateChef, deleteChef, byId };
}

export type UseChefsReturn = ReturnType<typeof useChefs>;
