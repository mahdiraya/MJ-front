import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

/* ========= Types ========= */
export type ItemCategory = 'internet' | 'solar' | 'camera' | 'satellite';
export type StockUnit = 'm' | null;
export type PriceTier = 'retail' | 'wholesale';
export type CashboxCode = 'A' | 'B' | 'C';
export type PayMethod = 'cash' | 'card' | 'transfer' | 'other';

export interface StatsOverview {
  generatedAt: string;
  cashboxes: Array<{
    id: number;
    code: string;
    label: string;
    isActive: boolean;
    balance: number;
    totalIn: number;
    totalOut: number;
    lastMovementAt: string | null;
  }>;
  supplierDebt: {
    totalOutstanding: number;
    suppliers: Array<{
      supplierId: number | null;
      total: number;
      paid: number;
      outstanding: number;
    }>;
  };
  sales: {
    today: number;
    last7Days: number;
    daily: Array<{ date: string; total: number }>;
  };
  restocks: {
    today: number;
    last7Days: number;
    daily: Array<{ date: string; total: number }>;
  };
  profitSeries: {
    weekly: Array<{ date: string; total: number }>;
    monthly: Array<{ date: string; total: number }>;
    yearly: Array<{ period: string; total: number }>;
  };
  cashReceivedSeries: {
    weekly: Array<{ date: string; total: number }>;
    monthly: Array<{ date: string; total: number }>;
    yearly: Array<{ period: string; total: number }>;
  };
  cashFlowSeries: {
    weekly: Array<{ date: string; in: number; out: number }>;
    monthly: Array<{ date: string; in: number; out: number }>;
    yearly: Array<{ period: string; in: number; out: number }>;
  };
  bookedFlowSeries: {
    weekly: Array<{ date: string; in: number; out: number }>;
    monthly: Array<{ date: string; in: number; out: number }>;
    yearly: Array<{ period: string; in: number; out: number }>;
  };
  cashboxTotals: {
    totalIn: number;
    totalOut: number;
    balance: number;
  };
  monthly: {
    sales: number;
    collected: number;
    purchases: number;
    net: number;
  };
}

export interface Customer {
  id: number;
  name: string;
  customer_type: 'regular' | 'special';
  contact_info?: string | null;
  notes?: string | null;
}

export interface CustomerSalesSummary {
  id: number;
  name: string;
  receiptCount: number;
  totalSpent: number;
  lastPurchase: string | null;
}

export interface Supplier {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface SupplierDebtSummaryRow {
  supplierId: number | null;
  supplierName: string;
  restockCount: number;
  total: number;
  paid: number;
  outstanding: number;
}

export interface SupplierDebtOverview {
  suppliers: SupplierDebtSummaryRow[];
  totalOutstanding: number;
}

export interface SupplierDebtRestockRow {
  id: number;
  date: string | null;
  total: number;
  paid: number;
  outstanding: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  statusManualEnabled: boolean;
  statusManualValue: 'PAID' | 'PARTIAL' | 'UNPAID' | null;
}

export interface SupplierDebtPaymentRow {
  id: number;
  restockId: number;
  amount: number;
  note: string | null;
  cashboxCode: string | null;
  createdAt: string | null;
}

export interface SupplierDebtDetail {
  supplier: {
    id: number;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };
  summary: {
    total: number;
    paid: number;
    outstanding: number;
  };
  restocks: SupplierDebtRestockRow[];
  payments: SupplierDebtPaymentRow[];
}

export interface RecordSupplierPaymentPayload {
  amount: number;
  cashboxId?: number;
  cashboxCode?: CashboxCode;
  paymentDate?: string;
  note?: string;
  payMethod?: PayMethod;
  allocations?: Array<{ restockId: number; amount: number }>;
}

export interface RestockMovementRow {
  id: number;
  date: string | null;
  supplierId: number | null;
  supplierName: string | null;
  total: number;
  tax: number | null;
  paid: number;
  outstanding: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  cashboxes: string[];
  user: { id: number; name?: string | null; username?: string | null } | null;
}

export interface TransactionMovementRow {
  id: number;
  date: string | null;
  customerId: number | null;
  customerName: string | null;
  total: number;
  paid: number;
  outstanding: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  cashboxes: string[];
  user: { id: number; name?: string | null; username?: string | null } | null;
  note?: string | null;
}

export interface RestockMovementsParams {
  supplierId?: number;
  status?: 'PAID' | 'PARTIAL' | 'UNPAID';
  cashboxCode?: CashboxCode;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface TransactionMovementsParams {
  customerId?: number;
  status?: 'PAID' | 'PARTIAL' | 'UNPAID';
  cashboxCode?: CashboxCode;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface LowStockItem {
  id: number;
  name: string;
  sku: string | null;
  category: ItemCategory | null;
  stockUnit: StockUnit;
  stock: number;
}

export interface LowStockParams {
  eachThreshold?: number;
  meterThreshold?: number;
}

export interface CashboxSummary {
  id: number;
  code: string;
  label: string;
  isActive: boolean;
}

export interface CashboxManualEntryRow {
  id: number;
  kind: 'income' | 'expense';
  direction: 'in' | 'out';
  amount: number;
  note: string | null;
  occurredAt: string | null;
  cashbox: {
    id: number;
    code: string;
    label: string;
  } | null;
}

export interface CashboxManualEntryParams {
  kind?: 'income' | 'expense';
  cashboxId?: number;
  cashboxCode?: CashboxCode;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface CreateCashboxManualEntryPayload {
  amount: number;
  kind: 'income' | 'expense';
  cashboxId?: number;
  cashboxCode?: CashboxCode;
  note?: string;
  occurredAt?: string;
}

export interface InventoryUnit {
  id: number;
  barcode: string | null;
  isPlaceholder: boolean;
  status: 'available' | 'reserved' | 'sold' | 'returned' | 'defective';
  costEach?: number | null;
  item?: Item;
  restockItem?: { id: number };
  roll?: { id: number; length_m?: number | null };
  createdAt?: string;
  updatedAt?: string;
  latestReturn?: {
    id: number;
    status: 'pending' | 'restocked' | 'trashed' | 'returned_to_supplier';
    requestedOutcome: 'restock' | 'defective';
    note?: string | null;
    createdAt?: string;
    resolvedAt?: string | null;
  } | null;
}

export interface InventoryUnitHistory {
  unit: InventoryUnit;
  restock: Restock | null;
  sales: Array<{
    transactionId: number;
    transactionDate: string;
    customer: Customer | null;
    quantity: number;
    length_m: number | null;
    price_each: number;
    cost_each: number | null;
  }>;
}

export interface InventoryReturnRecord {
  id: number;
  status: 'pending' | 'restocked' | 'trashed' | 'returned_to_supplier';
  requestedOutcome: 'restock' | 'defective';
  note?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  supplier?: { id: number; name: string } | null;
  supplierNote?: string | null;
  inventoryUnit: {
    id: number;
    barcode: string | null;
    status: string;
    item: { id: number; name: string; sku?: string | null } | null;
  };
  transaction?: {
    id: number;
    date: string;
    lineId: number | null;
    unitPrice: number | null;
  } | null;
}

export type CreateInventoryReturnPayload = {
  requestedOutcome: 'restock' | 'defective';
  note?: string | null;
};

export type ResolveInventoryReturnPayload = {
  action: 'restock' | 'trash' | 'returnToSupplier';
  note?: string | null;
  supplierId?: number | null;
  supplierNote?: string | null;
};
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
  | {
      itemId: number;
      mode: 'EACH';
      quantity: number;
      unitCost?: number;
      serials?: string[];
      autoSerial?: boolean;
    }
  | { itemId: number; mode: 'METER'; newRolls: number[]; unitCost?: number }
  | {
      newItem: NewItemPayload;
      mode: 'EACH';
      quantity: number;
      unitCost?: number;
      serials?: string[];
      autoSerial?: boolean;
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
  paid?: number;
  status?: 'paid' | 'partial' | 'unpaid';
  statusCode?: 'PAID' | 'PARTIAL' | 'UNPAID';
};

export interface RestockReceipt {
  id: number;
  date: string;
  created_at: string;
  supplierId: number | null;
  supplierName: string | null;
  note: string | null;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  status: 'paid' | 'partial' | 'unpaid';
  statusCode: 'PAID' | 'PARTIAL' | 'UNPAID';
  statusManualEnabled?: boolean;
  statusManualValue?: 'PAID' | 'PARTIAL' | 'UNPAID' | null;
  statusManualNote?: string | null;
  statusManualSetAt?: string | null;
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
  /** For serialised inventory: explicit unit ids sold on this line */
  inventoryUnitIds?: number[];
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
  customerName?: string | null;
  customerPhone?: string | null;
  receipt_type: ReceiptType;
  items: TxLine[];
  note?: string;
  paid?: number;
  cashboxId?: number;
  cashboxCode?: CashboxCode;
  paymentDate?: string;
  paymentNote?: string;
  statusOverride?: 'PAID' | 'PARTIAL' | 'UNPAID';
  statusOverrideNote?: string;
  payMethod?: PayMethod;
}

export interface UpdateTransactionPayload extends CreateTransactionDto {
  editNote: string;
}

export interface CreateRestockDto {
  supplier?: number;
  supplierName?: string;
  date?: string;
  note?: string;
  tax?: number;
  items: CreateRestockLine[];
  paid?: number;
  cashboxId?: number;
  cashboxCode?: CashboxCode;
  paymentDate?: string;
  paymentNote?: string;
  statusOverride?: 'PAID' | 'PARTIAL' | 'UNPAID';
  statusOverrideNote?: string;
  payMethod?: PayMethod;
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
  cost_each?: number | null;
  item: { id: number; name: string; stockUnit: StockUnit; sku?: string | null };
  roll?: { id: number; label?: string | null } | null;
  inventoryUnitLinks?: Array<{
    inventoryUnit: Pick<InventoryUnit, 'id' | 'barcode' | 'status'>;
  }>;
}

export interface Transaction {
  id: number;
  date: string;
  total: number;
  receipt_type: ReceiptType;
  note?: string | null;
  user: { id: number; name?: string };
  customer?: { id: number; name?: string; contact_info?: string | null } | null;
  transactionItems: TransactionItem[];
  paid?: number;
  status?: 'paid' | 'partial' | 'unpaid';
  statusCode?: 'PAID' | 'PARTIAL' | 'UNPAID';
  statusManualEnabled?: boolean;
  statusManualValue?: 'PAID' | 'PARTIAL' | 'UNPAID' | null;
  statusManualNote?: string | null;
  statusManualSetAt?: string | null;
  lastEditNote?: string | null;
  lastEditAt?: string | null;
  lastEditUser?: { id: number; name?: string | null; username?: string | null } | null;
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
  supplierId?: number | null;
  supplierName?: string | null;
  note?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  total?: number | null;
  paid?: number | null;
  status?: 'paid' | 'partial' | 'unpaid';
  statusCode?: 'PAID' | 'PARTIAL' | 'UNPAID';
  statusManualEnabled?: boolean;
  statusManualValue?: 'PAID' | 'PARTIAL' | 'UNPAID' | null;
  statusManualNote?: string | null;
  statusManualSetAt?: string | null;
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
    item: Partial<Item> & {
      initialRolls?: number[];
      initialSerials?: string[];
      autoSerial?: boolean;
      stock?: number;
    }
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

  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.BASE_URL}/customers`);
  }

  getCustomer(id: number): Observable<Customer> {
    return this.http.get<Customer>(`${this.BASE_URL}/customers/${id}`);
  }

  getCustomersWithSales(): Observable<CustomerSalesSummary[]> {
    return this.http.get<CustomerSalesSummary[]>(
      `${this.BASE_URL}/customers/with-sales`
    );
  }

  getCustomerReceipts(
    customerId: number
  ): Observable<TransactionMovementRow[]> {
    return this.http.get<TransactionMovementRow[]>(
      `${this.BASE_URL}/customers/${customerId}/receipts`
    );
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

  updateTransaction(id: number, payload: UpdateTransactionPayload) {
    return this.http.patch<Transaction>(
      `${this.BASE_URL}/transactions/${id}`,
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

  getRestockMovements(params: RestockMovementsParams = {}) {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      httpParams = httpParams.set(key, String(value));
    });
    return this.http.get<RestockMovementRow[]>(
      `${this.BASE_URL}/restocks/movements`,
      { params: httpParams }
    );
  }

  getSalesMovements(params: TransactionMovementsParams = {}) {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      httpParams = httpParams.set(key, String(value));
    });
    return this.http.get<TransactionMovementRow[]>(
      `${this.BASE_URL}/transactions/movements`,
      { params: httpParams }
    );
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

  getStatsOverview() {
    return this.http.get<StatsOverview>(`${this.BASE_URL}/stats/overview`);
  }

  getSuppliers() {
    return this.http.get<Supplier[]>(`${this.BASE_URL}/suppliers`);
  }

  getSupplierDebtOverview() {
    return this.http.get<SupplierDebtOverview>(
      `${this.BASE_URL}/suppliers/debt/overview`
    );
  }

  getSupplierDebtDetail(id: number) {
    return this.http.get<SupplierDebtDetail>(
      `${this.BASE_URL}/suppliers/debt/${id}`
    );
  }

  recordSupplierPayment(
    supplierId: number,
    payload: RecordSupplierPaymentPayload
  ) {
    return this.http.post(
      `${this.BASE_URL}/suppliers/debt/${supplierId}/payments`,
      payload
    );
  }

  getLowStockItems(params: LowStockParams = {}) {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      httpParams = httpParams.set(key, String(value));
    });
    return this.http.get<LowStockItem[]>(`${this.BASE_URL}/items/low-stock`, {
      params: httpParams,
    });
  }

  getCashboxes() {
    return this.http.get<CashboxSummary[]>(`${this.BASE_URL}/cashboxes`);
  }

  getCashboxManualEntries(params: CashboxManualEntryParams = {}) {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      httpParams = httpParams.set(key, String(value));
    });
    return this.http.get<CashboxManualEntryRow[]>(
      `${this.BASE_URL}/cashboxes/manual`,
      { params: httpParams }
    );
  }

  createCashboxManualEntry(payload: CreateCashboxManualEntryPayload) {
    return this.http.post<CashboxManualEntryRow>(
      `${this.BASE_URL}/cashboxes/manual`,
      payload
    );
  }

  getInventoryUnits(
    itemId: number,
    params: { includePlaceholders?: boolean; status?: string; limit?: number } = {}
  ) {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      httpParams = httpParams.set(key, String(value));
    });
    return this.http.get<InventoryUnit[]>(
      `${this.BASE_URL}/inventory/items/${itemId}/units`,
      { params: httpParams }
    );
  }

  assignInventoryBarcode(unitId: number, barcode?: string | null) {
    return this.http.patch<InventoryUnit>(
      `${this.BASE_URL}/inventory/units/${unitId}/barcode`,
      { barcode: barcode ?? null }
    );
  }

  returnInventoryUnit(
    unitId: number,
    outcome: 'restock' | 'defective',
    note?: string | null
  ) {
    return this.requestInventoryReturn(unitId, {
      requestedOutcome: outcome,
      note: note ?? undefined,
    });
  }

  getInventoryUnitHistory(unitId: number) {
    return this.http.get<InventoryUnitHistory>(
      `${this.BASE_URL}/inventory/units/${unitId}/history`
    );
  }

  lookupInventoryByBarcode(barcode: string) {
    return this.http.get<InventoryUnit>(
      `${this.BASE_URL}/inventory/barcodes/${encodeURIComponent(barcode)}`
    );
  }

  listInventoryReturns() {
    return this.http.get<InventoryReturnRecord[]>(`${this.BASE_URL}/returns`);
  }

  requestInventoryReturn(
    unitId: number,
    payload: CreateInventoryReturnPayload
  ) {
    const body: Record<string, unknown> = {
      requestedOutcome: payload.requestedOutcome,
    };
    if (payload.note !== undefined) {
      body['note'] = payload.note;
    }
    return this.http.post<InventoryReturnRecord>(
      `${this.BASE_URL}/returns/${unitId}`,
      body
    );
  }

  resolveInventoryReturn(
    id: number,
    payload: ResolveInventoryReturnPayload
  ) {
    const body: Record<string, unknown> = {
      action: payload.action,
    };
    if (payload.note !== undefined) {
      body['note'] = payload.note;
    }
    if (payload.supplierId !== undefined) {
      body['supplierId'] = payload.supplierId;
    }
    if (payload.supplierNote !== undefined) {
      body['supplierNote'] = payload.supplierNote;
    }
    return this.http.patch<InventoryReturnRecord>(
      `${this.BASE_URL}/returns/${id}`,
      body
    );
  }
}
