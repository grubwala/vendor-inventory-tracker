import { useMemo, useState } from 'react';
import type { ID, Item } from '../types';

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

export function useItems(initial: Item[] = []) {
  const [items, setItems] = useState<Item[]>(initial);

  const addItem = (partial: Omit<Item, 'id'>) => {
    const next: Item = { id: genId(), isActive: true, ...partial };
    setItems(prev => [...prev, next]);
    return next;
  };

  const updateItem = (id: ID, patch: Partial<Item>) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
  };

  const deleteItem = (id: ID) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const byId = useMemo(() => {
    const m = new Map<ID, Item>();
    for (const i of items) m.set(i.id, i);
    return m;
  }, [items]);

  return { items, addItem, updateItem, deleteItem, byId };
}

export type UseItemsReturn = ReturnType<typeof useItems>;
