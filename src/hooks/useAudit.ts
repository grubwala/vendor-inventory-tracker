import { useState } from 'react';
import type { AuditEntry } from '../types';

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

export function useAudit(initial: AuditEntry[] = []) {
  const [audit, setAudit] = useState<AuditEntry[]>(initial);

  const log = (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => {
    const next: AuditEntry = { id: genId(), timestamp: new Date().toISOString(), ...entry };
    setAudit(prev => [next, ...prev]);
    return next;
  };

  return { audit, log };
}

export type UseAuditReturn = ReturnType<typeof useAudit>;
