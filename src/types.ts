// src/types.ts

export type ID = string;

/** Master item kept by Founder */
export interface Item {
  id: ID;
  name: string;
  unit: 'kg' | 'g' | 'ltr' | 'ml' | 'pcs';
  sku?: string;
  minStock?: number;     // threshold for low stock warnings
  isActive?: boolean;
}

/** Vendor/supplier of items */
export interface Vendor {
  id: ID;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive?: boolean;
}

/** One stock movement entry (IN/OUT/ADJUST) */
export interface StockMovement {
  id: ID;
  itemId: ID;
  vendorId?: ID;
  type: 'IN' | 'OUT' | 'ADJUST';
  quantity: number;
  unitCost?: number;
  timestamp: string;        // ISO string
  note?: string;
}

/** Row shown in the inventory table; may belong to a chef (personal) or warehouse (no chef) */
export type StockRow = StockMovement & {
  chefId?: string | null;
};

/** Minimal user shape used by the app */
export interface CurrentUser {
  id: ID;
  name: string;
  email: string;
  role: 'Founder' | 'Home Chef';
  chefId?: string | null;
}

/** Simple audit entry (UI-friendly shape) */
export interface AuditEntry {
  id: ID;
  actor: ID;                // user id/email
  action: string;           // e.g., "stock.adjust", "stock.delete"
  timestamp: string;        // ISO
  refId?: ID;               // e.g., StockRow id
  meta?: Record<string, unknown>;
}
