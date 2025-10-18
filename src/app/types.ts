// Items & rolls
export type ItemCategory = 'internet' | 'solar' | 'camera' | 'satellite';
export type StockUnit = 'm' | null;

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
  price: number; // per piece or per meter
  description?: string | null;
  rolls?: Roll[];
}

// Transactions
export type ReceiptType = 'simple' | 'detailed';
export type LineMode = 'EACH' | 'METER';

export type TxLineEach = {
  itemId: number;
  mode: 'EACH';
  quantity: number;
};

export type TxLineMeter = {
  itemId: number;
  mode: 'METER';
  lengthMeters: number;
  rollId?: number;
};

export type TxLine = TxLineEach | TxLineMeter;

export interface CreateTransactionDto {
  receipt_type: ReceiptType;
  customer?: number;
  items: TxLine[];
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
