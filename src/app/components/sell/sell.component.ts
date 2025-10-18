import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ApiService,
  Item,
  Roll,
  CreateTransactionDto,
  TxLine,
  PriceTier,
} from '../../services/api.service';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

type PriceMode = 'retail' | 'wholesale' | 'custom';

type CartLine = {
  itemId: number;
  name: string;
  price: number; // unit price (per piece or per meter)
  priceMode: PriceMode; // retail | wholesale | custom
  stockUnit: 'm' | null; // drives UI
  sku?: string;

  // EACH
  quantity?: number;

  // METER
  lengthMeters?: number;
  rollId?: number;
  rolls?: Roll[]; // available rolls for selection
};

@Component({
  selector: 'app-sell',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sell.component.html',
  styleUrls: ['./sell.component.css'],
})
export class SellComponent implements OnInit {
  items: Item[] = [];
  filteredItems: Item[] = [];
  categories: string[] = ['internet', 'solar', 'camera', 'satellite'];
  selectedCategory = '';
  search = '';
  inStockOnly = true;
  amountPaidNow: number | '' = '';
  cashbox: 'A' | 'B' | 'C' = 'A';
  payMethod: 'cash' | 'card' | 'transfer' | 'other' = 'cash';

  cart: CartLine[] = [];
  note = '';

  // default tier used when adding new lines (per-line can override)
  defaultTier: PriceTier = 'retail';

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadItems();
  }

  loadItems() {
    this.api.getItems().subscribe({
      next: (data) => {
        this.items = data ?? [];
        this.applyFilters();
      },
      error: (e) => console.error('Failed to load items', e),
    });
  }

  private itemById(id: number): Item | undefined {
    return this.items.find((x) => x.id === id);
  }

  private unitPriceFor(it: Item, tier: PriceTier): number {
    if (tier === 'wholesale') {
      return Number(it.priceWholesale ?? it.priceRetail ?? it.price ?? 0);
    }
    return Number(it.priceRetail ?? it.price ?? it.priceWholesale ?? 0);
  }

  /** How much of this item is already reserved in the cart */
  private reservedInCart(itemId: number): number {
    const it = this.itemById(itemId);
    if (!it) return 0;
    if (it.stockUnit === 'm') {
      return this.cart
        .filter((l) => l.itemId === itemId)
        .reduce((s, l) => s + Number(l.lengthMeters || 0), 0);
    }
    return this.cart
      .filter((l) => l.itemId === itemId)
      .reduce((s, l) => s + Number(l.quantity || 0), 0);
  }

  getItemStock(itemId: number) {
    return Number(this.itemById(itemId)?.stock ?? 0);
  }

  remainingStock(it: Item) {
    const reserved = this.reservedInCart(it.id);
    return Math.max(0, Number(it.stock ?? 0) - reserved);
  }

  applyFilters() {
    const q = this.search.trim().toLowerCase();
    const cat = this.selectedCategory;
    this.filteredItems = this.items.filter((it) => {
      const byCat = !cat || it.category === cat;
      const byText =
        !q ||
        it.name?.toLowerCase().includes(q) ||
        it.sku?.toLowerCase().includes(q);
      const byStock = !this.inStockOnly || Number(it.stock ?? 0) > 0;
      return byCat && byText && byStock;
    });
  }

  /** Price mode changed for a line */
  onLinePriceModeChange(line: CartLine) {
    const it = this.itemById(line.itemId);
    if (!it) return;
    if (line.priceMode === 'retail') {
      line.price = this.unitPriceFor(it, 'retail');
    } else if (line.priceMode === 'wholesale') {
      line.price = this.unitPriceFor(it, 'wholesale');
    } else {
      // custom: keep existing price but clamp to >= 0
      line.price = Math.max(0, Number(line.price || 0));
    }
  }

  onCustomPriceChange(line: CartLine, val: number) {
    if (line.priceMode !== 'custom') return;
    const n = Number(val);
    line.price = Math.max(0, isFinite(n) ? +n.toFixed(2) : 0);
  }

  addToCart(it: Item) {
    const remaining = this.remainingStock(it);
    if (remaining <= 0) {
      alert('Out of stock');
      return;
    }

    // ---------- EACH (pieces) ----------
    if (it.stockUnit !== 'm') {
      const idx = this.cart.findIndex(
        (l) => l.itemId === it.id && l.stockUnit !== 'm'
      );
      if (idx >= 0) {
        const line = this.cart[idx];
        const currentQty = Number(line.quantity || 0);

        const maxForLine =
          this.getItemStock(it.id) - (this.reservedInCart(it.id) - currentQty);

        const nextQty = currentQty + 1;
        if (nextQty > maxForLine) {
          alert('Quantity exceeds available stock');
          return;
        }
        this.cart[idx].quantity = nextQty;
        return;
      }

      const price = this.unitPriceFor(it, this.defaultTier);
      this.cart.push({
        itemId: it.id,
        name: it.name,
        price,
        priceMode: this.defaultTier, // default per-line mode
        stockUnit: null,
        sku: it.sku || undefined,
        quantity: 1,
      });
      return;
    }

    // ---------- METER ----------
    const idx = this.cart.findIndex(
      (l) => l.itemId === it.id && l.stockUnit === 'm'
    );
    if (idx >= 0) {
      const added = this.addMetersToExistingLine(this.cart[idx], 1);
      if (!added) {
        alert(
          'No more meters available for this item (check selected roll or total stock).'
        );
      }
      return;
    }

    const price = this.unitPriceFor(it, this.defaultTier);
    const line: CartLine = {
      itemId: it.id,
      name: it.name,
      price,
      priceMode: this.defaultTier, // default per-line mode
      stockUnit: 'm',
      sku: it.sku || undefined,
      lengthMeters: Math.min(1, remaining) || 1,
    };
    this.cart.push(line);

    this.api.listRollsByItem(it.id).subscribe({
      next: (rolls) => (line.rolls = rolls),
      error: () => (line.rolls = []),
    });
  }

  updateQty(i: number, qty: number) {
    const line = this.cart[i];
    if (!line) return;
    if (line.stockUnit === 'm') return; // handled by updateMeters
    const max =
      this.getItemStock(line.itemId) -
      (this.reservedInCart(line.itemId) - (line.quantity || 0));
    const q = Math.min(Math.max(1, Number(qty || 1)), max > 0 ? max : 1);
    this.cart[i].quantity = q;
  }

  updateMeters(i: number, meters: number) {
    const line = this.cart[i];
    if (!line) return;
    if (line.stockUnit !== 'm') return;

    const totalStock = this.getItemStock(line.itemId);
    const reservedExceptThis =
      this.reservedInCart(line.itemId) - (line.lengthMeters || 0);
    const max = Math.max(0, totalStock - reservedExceptThis);

    const val = Number(meters || 0);
    const clamped = Math.min(Math.max(0.001, +val.toFixed(3)), +max.toFixed(3));
    this.cart[i].lengthMeters = clamped;

    if (line.rollId && line.rolls?.length) {
      const r = line.rolls.find((rr) => rr.id === line.rollId);
      if (r && this.cart[i].lengthMeters! > r.remaining_m) {
        this.cart[i].lengthMeters = +r.remaining_m.toFixed(3);
      }
    }
  }

  removeLine(i: number) {
    this.cart.splice(i, 1);
  }

  lineTotal(l: CartLine): number {
    if (l.stockUnit === 'm') return (l.lengthMeters || 0) * l.price;
    return (l.quantity || 0) * l.price;
  }

  subtotal() {
    return this.cart.reduce((sum, l) => sum + this.lineTotal(l), 0);
  }

  checkout() {
    if (!this.cart.length) return;

    const items: TxLine[] = this.cart.map((l) => {
      const unitPrice = Math.max(0, Number((l.price ?? 0).toFixed(2)));

      if (l.stockUnit === 'm') {
        return {
          itemId: l.itemId,
          mode: 'METER',
          lengthMeters: Number((l.lengthMeters || 0).toFixed(3)),
          rollId: l.rollId != null ? Number(l.rollId) : undefined,
          priceTier: l.priceMode === 'custom' ? undefined : l.priceMode,
          unitPrice,
        };
      }
      return {
        itemId: l.itemId,
        mode: 'EACH',
        quantity: Number(l.quantity || 1),
        priceTier: l.priceMode === 'custom' ? undefined : l.priceMode,
        unitPrice,
      };
    });

    const payload: CreateTransactionDto = {
      receipt_type: 'simple',
      items,
      note: this.note || undefined,
      amountPaidNow:
        this.amountPaidNow !== ''
          ? +Number(this.amountPaidNow).toFixed(2)
          : undefined,
      cashbox: this.amountPaidNow ? this.cashbox : undefined,
      payMethod: this.amountPaidNow ? this.payMethod : undefined,
    };

    this.api.createTransaction(payload).subscribe({
      next: (tx) => {
        this.cart = [];
        this.router.navigate(['/receipt', tx.id]);
      },
      error: (err) => {
        console.error('Checkout failed', err);
        const raw = err?.error?.message;
        const msg = Array.isArray(raw)
          ? raw.join('\n')
          : raw || 'Checkout failed';
        alert(msg);
      },
    });
  }

  /** Increment meters on an existing meter line by `inc` (default 1m) */
  private addMetersToExistingLine(line: CartLine, inc: number = 1): boolean {
    if (line.stockUnit !== 'm') return false;

    const item = this.itemById(line.itemId);
    if (!item) return false;

    const totalStock = this.getItemStock(line.itemId);
    const current = Number(line.lengthMeters || 0);

    const reservedExceptThis = this.reservedInCart(line.itemId) - current;
    const remainingGlobal = Math.max(0, totalStock - reservedExceptThis);

    let remainingForRoll = Infinity;
    if (line.rollId && line.rolls?.length) {
      const r = line.rolls.find((rr) => rr.id === line.rollId);
      if (r) remainingForRoll = Math.max(0, Number(r.remaining_m) - current);
    }

    const allowedToAdd = Math.min(inc, remainingGlobal, remainingForRoll);
    if (allowedToAdd <= 0) return false;

    line.lengthMeters = +(current + allowedToAdd).toFixed(3);
    return true;
  }
}
