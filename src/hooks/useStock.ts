import { useCallback, useMemo, useState } from 'react';
import type { ID, StockRow } from '../types';

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

export type MovementInput = Omit<StockRow, 'id' | 'timestamp'>;

export function useStock(initial: StockRow[] = []) {
  const [movements, setMovements] = useState<StockRow[]>(initial);

  const addMovement = (movement: MovementInput) => {
    const next: StockRow = {
      id: genId(),
      timestamp: new Date().toISOString(),
      chefId: movement.chefId ?? null,
      ...movement,
    };
    setMovements(prev => [next, ...prev]);
    return next;
  };

  // Computes on-hand quantity per item per owner from movements
  const onHandByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const mv of movements) {
      const sign = mv.type === 'IN' ? 1 : mv.type === 'OUT' ? -1 : 0;
      const chefKey = mv.chefId ?? 'warehouse';
      const key = `${chefKey}::${mv.itemId}`;
      map.set(key, (map.get(key) ?? 0) + sign * mv.quantity);
    }
    return map;
  }, [movements]);

  const getOnHand = useCallback((itemId: ID, chefId: ID | null = null) => {
    const key = `${chefId ?? 'warehouse'}::${itemId}`;
    return onHandByKey.get(key) ?? 0;
  }, [onHandByKey]);

  const getChefInventory = useCallback(
    (chefId: ID | null) => movements.filter(mv => (chefId === null ? mv.chefId === null : mv.chefId === chefId)),
    [movements]
  );

  return { movements, addMovement, getOnHand, getChefInventory };
}

export type UseStockReturn = ReturnType<typeof useStock>;
