import { useState } from 'react';
import type { ID, Vendor } from '../types';

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

export function useVendors(initial: Vendor[] = []) {
  const [vendors, setVendors] = useState<Vendor[]>(initial);

  const addVendor = (partial: Omit<Vendor, 'id'>) => {
    const next: Vendor = { id: genId(), isActive: true, ...partial };
    setVendors(prev => [...prev, next]);
    return next;
  };

  const updateVendor = (id: ID, patch: Partial<Vendor>) => {
    setVendors(prev => prev.map(v => (v.id === id ? { ...v, ...patch } : v)));
  };

  const deleteVendor = (id: ID) => {
    setVendors(prev => prev.filter(v => v.id !== id));
  };

  return { vendors, addVendor, updateVendor, deleteVendor };
}

export type UseVendorsReturn = ReturnType<typeof useVendors>;
