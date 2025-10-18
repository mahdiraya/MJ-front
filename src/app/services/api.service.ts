import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/* ========= Types ========= */
export type ItemCategory = 'internet' | 'solar' | 'camera' | 'satellite';
export type StockUnit = 'm' | null;
export type PriceTier = 'retail' | 'wholesale';
export type Cashbox = 'A' | 'B' | 'C';
export type PayMethod = 'cash' | 'card' | 'transfer' | 'other';

export interface CreateTransactionDto {
  customer?: number | null;
  receipt_type: 'simple' | 'detailed';
  items: TxLine[];
  note?: string;

  // NEW (optional immediate payment):
  amountPaidNow?: number;
  cashbox?: Cashbox;
  payMethod?: PayMethod;
}

export interface CreateRestockDto {
  supplier?: number;
  date?: string;
  note?: string;
  tax?: number;
  items: CreateRestockLine[];

  // NEW
  amountPaidNow?: number;
  cashbox?: Cashbox;
  payMethod?: PayMethod;
}

export type NewItemPayload = {
  name: string;
  sku?: string | null;
  category?: ItemCategory | null;
  stockUnit?: StockUnit; // 'm' for meter, null for each
  rollLength?: number | null;
  priceRetail?: number | null;
  priceWholesale?: number | null;
  description?: string | null;
};

export type CreateRestockLine =
  | { itemId: number; mode: 'EACH'; quantity: number; unitCost?: number }
  | { itemId: number; mode: 'METER'; newRolls: number[]; unitCost?: number }
  | {
      newItem: NewItemPayload;
      mode: 'EACH';
      quantity: number;
      unitCost?: number;
    }
  | {
      newItem: NewItemPayload;
      mode: 'METER';
      newRolls: number[];
      unitCost?: number;
    };

export type UnifiedReceiptRow = {
  id: string;
  rawId: number;
  mode: 'IN' | 'OUT';
  date: string; // ISO
  total: number;
  type: string;
  user?: { id: number; name?: string } | null;
  party?: { id: number; name?: string } | null;
};

export interface RestockReceipt {
  id: number;
  date: string;
  created_at: string;
  supplierId: number | null;
  note: string | null;
  subtotal: number;
  tax: number;
  total: number;
  user: { id: number; name?: string } | null;
  items: Array<{
    id: number;
    mode: 'EACH' | 'METER';
    item: {
      id: number;
      name: string;
      sku: string | null;
      stockUnit: 'm' | null;
    };
    quantity: number | null;
    length_m: number | null;
    price_each: number;
    line_total: number;
  }>;
}

export interface CreateRestockDto {
  supplier?: number;
  date?: string; // ISO
  note?: string;
  tax?: number;
  items: CreateRestockLine[];
}

export type UnifiedReceipt = {
  id: string; // "IN-5" or "OUT-12"
  mode: 'IN' | 'OUT';
  date: string | null;
  total: number;
  user?: any | null;
  party?: any | null; // customer object for OUT, {id: supplierId} for IN (for now)
  rawId: number;
  type: string; // 'restock' | 'simple' | 'detailed'
};

export interface Roll {
  id: number;
  item?: { id: number };
  length_m: number;
  remaining_m: number;
  created_at?: string;
}

export interface Item {
  id: number;
  name: string;
  sku?: string | null;
  category?: ItemCategory | null;
  stock: number; // pieces or meters
  stockUnit: StockUnit; // null => EACH, 'm' => METER
  rollLength?: number | null;
  priceRetail?: number | null;
  priceWholesale?: number | null;
  price?: number; // legacy fallback
  description?: string | null;
  rolls?: Roll[];

  // NEW: photo url served by backend, e.g. "/uploads/items/xxx.jpg"
  photoUrl?: string | null;
}

/* --- Transactions --- */
export type ReceiptType = 'simple' | 'detailed';
export type LineMode = 'EACH' | 'METER';

export type TxLineEach = {
  itemId?: number;
  item?: number;
  mode?: 'EACH';
  quantity: number;
  /** Optional per-line tier hint; server may ignore if unitPrice provided */
  priceTier?: PriceTier;
  /** Optional unitPrice override (per piece). If provided, server will store it in price_each. */
  unitPrice?: number;
};

export type TxLineMeter = {
  itemId?: number;
  item?: number;
  mode: 'METER';
  lengthMeters: number;
  rollId?: number;
  priceTier?: PriceTier;
  /** Optional unitPrice override (per meter). */
  unitPrice?: number;
};

export type TxLine = TxLineEach | TxLineMeter;

export interface CreateTransactionDto {
  customer?: number | null;
  receipt_type: ReceiptType;
  items: TxLine[];
  note?: string;
}

export interface LegacyCreateTransactionPayload {
  customer?: number | null;
  receipt_type?: ReceiptType;
  items: { item: number; quantity: number }[];
  note?: string;
}

export interface TransactionItem {
  id: number;
  mode: LineMode;
  quantity: number;
  length_m?: number | null;
  price_each: number;
  item: { id: number; name: string; price: number; stockUnit: StockUnit };
  roll?: { id: number } | null;
}

export interface Transaction {
  id: number;
  date: string;
  total: number;
  receipt_type: ReceiptType;
  user: { id: number; name?: string };
  customer?: { id: number; name?: string } | null;
  transactionItems: TransactionItem[];
}

export interface RestockRollLink {
  id: number;
  length_m: number;
  roll: Roll;
}
export interface RestockItem {
  id: number;
  mode: 'EACH' | 'METER';
  item: Item;
  quantity?: number | null;
  unit_cost?: number | null;
  line_total?: number | null;
  rolls?: RestockRollLink[];
}
export interface Restock {
  id: number;
  date: string;
  user: { id: number; name?: string };
  supplier_id?: number | null;
  note?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  total?: number | null;
  items: RestockItem[];
}

// export type CreateRestockLine =
//   | { itemId: number; mode: 'EACH'; quantity: number; unitCost?: number }
//   | { itemId: number; mode: 'METER'; newRolls: number[]; unitCost?: number };

// export interface CreateRestockDto {
//   supplier?: number;
//   date?: string; // ISO date string
//   note?: string;
//   tax?: number;
//   items: CreateRestockLine[];
// }

/* ========= Service ========= */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private BASE_URL = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  /** Turn a relative file path like "/uploads/items/xyz.jpg" into a full URL for <img [src]> */
  fileUrl(path?: string | null): string | null {
    if (!path) return null;
    // already absolute? return as-is
    if (/^https?:\/\//i.test(path)) return path;
    // ensure single slash join
    if (path.startsWith('/')) return `${this.BASE_URL}${path}`;
    return `${this.BASE_URL}/${path}`;
  }

  /* ----- Items ----- */
  getItems(): Observable<Item[]> {
    return this.http.get<Item[]>(`${this.BASE_URL}/items`);
  }

  getItem(id: number): Observable<Item> {
    return this.http.get<Item>(`${this.BASE_URL}/items/${id}`);
  }

  addItem(
    item: Partial<Item> & { initialRolls?: number[]; stock?: number }
  ): Observable<Item> {
    return this.http.post<Item>(`${this.BASE_URL}/items`, item);
  }

  updateItem(id: number, item: Partial<Item>): Observable<Item> {
    return this.http.put<Item>(`${this.BASE_URL}/items/${id}`, item);
  }

  deleteItem(id: number): Observable<{ affected?: number } & any> {
    return this.http.delete<any>(`${this.BASE_URL}/items/${id}`);
  }

  // NEW: upload photo
  uploadItemPhoto(id: number, file: File): Observable<Item> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<Item>(`${this.BASE_URL}/items/${id}/photo`, form);
    // JwtInterceptor will attach token automatically
  }

  // NEW: remove photo (clears column)
  removeItemPhoto(id: number): Observable<Item> {
    return this.http.put<Item>(`${this.BASE_URL}/items/${id}`, {
      photoUrl: null,
    });
  }

  /* ----- Rolls (for meter items) ----- */
  listRollsByItem(itemId: number): Observable<Roll[]> {
    return this.http.get<Roll[]>(`${this.BASE_URL}/rolls/item/${itemId}`);
  }

  addRoll(itemId: number, length_m: number): Observable<Roll> {
    return this.http.post<Roll>(`${this.BASE_URL}/rolls`, { itemId, length_m });
  }

  deleteRoll(rollId: number): Observable<{ success: true }> {
    return this.http.delete<{ success: true }>(
      `${this.BASE_URL}/rolls/${rollId}`
    );
  }

  /* ----- Users / Customers ----- */
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.BASE_URL}/users`);
  }

  getCustomers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.BASE_URL}/customers`);
  }

  /* ----- Transactions ----- */
  /** Full list (be careful: could be heavy). */
  getTransactions(): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${this.BASE_URL}/transactions`);
  }

  /** Lightweight recent list for receipts history page (joins only user & customer). */
  getRecentTransactions(limit = 200): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(
      `${this.BASE_URL}/transactions/recent`,
      { params: { limit: String(limit) } }
    );
  }

  createTransaction(
    payload: CreateTransactionDto | LegacyCreateTransactionPayload
  ): Observable<Transaction> {
    return this.http.post<Transaction>(
      `${this.BASE_URL}/transactions`,
      payload
    );
  }

  getTransactionReceipt(id: number): Observable<Transaction> {
    return this.http.get<Transaction>(
      `${this.BASE_URL}/transactions/${id}/receipt`
    );
  }
  getRestocksHistory(limit = 200): Observable<Restock[]> {
    return this.http.get<Restock[]>(`${this.BASE_URL}/restocks/history`, {
      params: { limit: String(limit) },
    });
  }

  getRestock(id: number): Observable<Restock> {
    return this.http.get<Restock>(`${this.BASE_URL}/restocks/${id}`);
  }

  createRestock(payload: CreateRestockDto) {
    return this.http.post<any>(`${this.BASE_URL}/restocks`, payload);
  }

  getUnifiedReceipts(limit = 200) {
    return this.http.get<UnifiedReceipt[]>(
      `${this.BASE_URL}/receipts/history`,
      { params: { limit: String(limit) } }
    );
  }

  getReceiptsHistory(limit = 200) {
    return this.http.get<UnifiedReceiptRow[]>(
      `${this.BASE_URL}/receipts/history`,
      { params: { limit: String(limit) } }
    );
  }

  getRestockReceipt(id: number) {
    return this.http.get<RestockReceipt>(
      `${this.BASE_URL}/restocks/${id}/receipt`
    );
  }
}
