export type ID = string;

export interface Item {
  id: ID;
  name: string;
  unit: 'kg' | 'g' | 'ltr' | 'ml' | 'pcs';
  sku?: string;
  minStock?: number; // low-stock threshold
  isActive?: boolean;
}

export interface Vendor {
  id: ID;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive?: boolean;
}

export interface StockMovement {
  id: ID;
  itemId: ID;
  vendorId?: ID;            // optional for adjustments without vendor
  type: 'IN' | 'OUT' | 'ADJUST';
  quantity: number;
  unitCost?: number;        // optional cost tracking
  timestamp: string;        // ISO
  note?: string;
}

export interface AuditEntry {
  id: ID;
  action:
    | 'CREATE_ITEM' | 'UPDATE_ITEM' | 'DELETE_ITEM'
    | 'CREATE_VENDOR' | 'UPDATE_VENDOR' | 'DELETE_VENDOR'
    | 'STOCK_IN' | 'STOCK_OUT' | 'STOCK_ADJUST';
  refId?: ID;               // points to item/vendor/stock movement id
  meta?: Record<string, unknown>;
  timestamp: string;        // ISO
  actor?: string;           // email/uid if you add auth later
}
