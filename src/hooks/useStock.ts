import { useMemo, useState } from 'react';
import type { ID, StockMovement } from '../types';

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

export function useStock(initial: StockMovement[] = []) {
  const [movements, setMovements] = useState<StockMovement[]>(initial);

  const addMovement = (m: Omit<StockMovement, 'id' | 'timestamp'>) => {
    const next: StockMovement = {
      id: genId(),
      timestamp: new Date().toISOString(),
      ...m,
    };
    setMovements(prev => [next, ...prev]);
    return next;
  };

  // Computes on-hand quantity per item from movements
  const onHandByItem = useMemo(() => {
    const m = new Map<ID, number>();
    for (const mv of movements) {
      const sign = mv.type === 'IN' ? 1 : mv.type === 'OUT' ? -1 : 0;
      m.set(mv.itemId, (m.get(mv.itemId) ?? 0) + sign * mv.quantity);
    }
    return m;
  }, [movements]);

  const getOnHand = (itemId: ID) => onHandByItem.get(itemId) ?? 0;

  return { movements, addMovement, getOnHand, onHandByItem };
}

export type UseStockReturn = ReturnType<typeof useStock>;
