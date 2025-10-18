import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  Item,
  CreateRestockDto,
  CreateRestockLine,
} from '../../services/api.service';
import { Router } from '@angular/router';

type LineUiEach = {
  itemId?: number;
  item?: Item;
  mode: 'EACH';
  quantity: number;
  unitCost?: number;
};

type LineUiMeter = {
  itemId?: number;
  item?: Item;
  mode: 'METER';
  newRoll: string;
  newRolls: number[];
  unitCost?: number;
};

type LineUi = LineUiEach | LineUiMeter;

type NewItemForm = {
  name: string;
  sku: string;
  category: '' | 'internet' | 'solar' | 'camera' | 'satellite';
  // UI-facing unit selector
  stockUnit: 'EACH' | 'METER';
  // only for METER in UI; keep always defined for strict templates
  rollLength: number | '';
  priceRetail: number | '';
  priceWholesale: number | '';
  description: string;
};

@Component({
  selector: 'app-stock-in',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-in.component.html',
  styleUrls: ['./stock-in.component.css'],
})
export class StockInComponent implements OnInit {
  items: Item[] = [];
  filtered: Item[] = [];
  q = '';
  inStockOnly = false;
  category = '';
  categories: Array<'internet' | 'solar' | 'camera' | 'satellite'> = [
    'internet',
    'solar',
    'camera',
    'satellite',
  ];

  // Header
  supplierId: number | '' = '';
  date = new Date().toISOString().slice(0, 10);
  note = '';
  tax: number | '' = '';

  lines: LineUi[] = [];
  submitting = false;

  // New item modal state
  newItemOpen = false;
  newItemSubmitting = false;
  newItemForm: NewItemForm = this.blankNewItem();

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.api.getItems().subscribe({
      next: (data) => {
        this.items = data || [];
        this.applyFilters();
      },
      error: (e) => console.error(e),
    });
  }

  private blankNewItem(): NewItemForm {
    return {
      name: '',
      sku: '',
      category: '',
      stockUnit: 'EACH',
      rollLength: '',
      priceRetail: '',
      priceWholesale: '',
      description: '',
    };
  }

  applyFilters() {
    const q = (this.q || '').toLowerCase().trim();
    const cat = (this.category || '').toLowerCase();
    this.filtered = this.items.filter((it) => {
      const byQ =
        !q ||
        it.name?.toLowerCase().includes(q) ||
        (it.sku || '').toLowerCase().includes(q);
      const byCat = !cat || (it.category || '').toLowerCase() === cat;
      const byStock = !this.inStockOnly || Number(it.stock ?? 0) > 0;
      return byQ && byCat && byStock;
    });
  }

  addEach(it: Item) {
    if (it.stockUnit === 'm') {
      alert('This item is metered. Use “Add METER” instead.');
      return;
    }
    this.lines.push({
      itemId: it.id,
      item: it,
      mode: 'EACH',
      quantity: 1,
    });
  }

  addMeter(it: Item) {
    if (it.stockUnit !== 'm') {
      alert('This item is not metered. Use “Add EACH” instead.');
      return;
    }
    this.lines.push({
      itemId: it.id,
      item: it,
      mode: 'METER',
      newRoll: '',
      newRolls: [],
    });
  }

  removeLine(i: number) {
    this.lines.splice(i, 1);
  }

  // ---------- Helpers (no casts in template) ----------
  isEach(l: LineUi): l is LineUiEach {
    return l.mode === 'EACH';
  }
  isMeter(l: LineUi): l is LineUiMeter {
    return l.mode === 'METER';
  }

  getQty(l: LineUi): number {
    return this.isEach(l) ? l.quantity ?? 1 : 1;
  }
  onQtyChange(l: LineUi, val: any) {
    if (!this.isEach(l)) return;
    const n = Math.max(1, Math.floor(Number(val || 1)));
    l.quantity = n;
  }

  getNewRollInput(l: LineUi): string {
    return this.isMeter(l) ? l.newRoll ?? '' : '';
  }
  onNewRollInput(l: LineUi, val: string) {
    if (!this.isMeter(l)) return;
    (l as LineUiMeter).newRoll = val;
    this.parseNewRolls(l as LineUiMeter);
  }

  getNewRolls(l: LineUi): number[] {
    return this.isMeter(l) ? (l as LineUiMeter).newRolls || [] : [];
  }

  getUnitCost(l: LineUi): number | '' {
    const v = (l as any).unitCost;
    return v == null ? '' : v;
    // keep as '' when empty so number input doesn't show "0"
  }
  onUnitCostChange(l: LineUi, val: any) {
    const n = Math.max(0, Number(val || 0));
    (l as any).unitCost = +n.toFixed(2);
  }
  // ---------------------------------------------------

  parseNewRolls(line: LineUiMeter) {
    const raw = line.newRoll || '';
    const parts = raw.split(/[,;\s]+/).map((s) => Number(s));
    line.newRolls = parts
      .filter((n) => Number.isFinite(n) && n > 0)
      .map((n) => +n.toFixed(3));
  }

  lineTotal(l: LineUi): number {
    if (this.isEach(l)) {
      const qty = Math.max(0, Number(l.quantity || 0));
      const cost = Math.max(0, Number((l as any).unitCost || 0));
      return +(qty * cost).toFixed(2);
    } else {
      const sum = (l as LineUiMeter).newRolls.reduce(
        (s, v) => s + Number(v || 0),
        0
      );
      const cost = Math.max(0, Number((l as any).unitCost || 0));
      return +(sum * cost).toFixed(2);
    }
  }

  subtotal(): number {
    return this.lines.reduce((s, l) => s + this.lineTotal(l), 0);
  }

  total(): number {
    const sub = this.subtotal();
    const t = Number(this.tax || 0);
    return +(sub + (Number.isFinite(t) ? t : 0)).toFixed(2);
  }

  submit() {
    if (!this.lines.length) return;

    const items: CreateRestockLine[] = this.lines.map((l) => {
      if (this.isEach(l)) {
        return {
          itemId: l.itemId!,
          mode: 'EACH',
          quantity: Math.max(1, Math.floor(Number(l.quantity || 1))),
          unitCost:
            (l as any).unitCost != null
              ? +Number((l as any).unitCost).toFixed(2)
              : undefined,
        };
      }
      return {
        itemId: l.itemId!,
        mode: 'METER',
        newRolls: (l as LineUiMeter).newRolls.map((n) => +Number(n).toFixed(3)),
        unitCost:
          (l as any).unitCost != null
            ? +Number((l as any).unitCost).toFixed(2)
            : undefined,
      };
    });

    const payload: CreateRestockDto = {
      supplier: this.supplierId ? Number(this.supplierId) : undefined,
      date: this.date ? new Date(this.date).toISOString() : undefined,
      note: this.note || undefined,
      tax: this.tax !== '' ? +Number(this.tax).toFixed(2) : undefined,
      items,
    };

    this.submitting = true;
    this.api.createRestock(payload).subscribe({
      next: () => {
        this.submitting = false;
        alert('Restock saved.');
        this.lines = [];
      },
      error: (e) => {
        this.submitting = false;
        console.error(e);
        alert(e?.error?.message || 'Failed to save restock');
      },
    });
  }

  // ===== New Item modal actions =====
  openNewItem() {
    this.newItemForm = this.blankNewItem(); // ensure defined
    this.newItemOpen = true;
  }
  closeNewItem() {
    this.newItemOpen = false;
  }
  createNewItem() {
    if (!this.newItemForm.name.trim()) {
      alert('Name is required.');
      return;
    }
    // Push a temp line using this new item; backend will create it via `newItem`
    const stockUnitApi = this.newItemForm.stockUnit === 'METER' ? 'm' : null;

    const tempItem: Item = {
      id: -Date.now(), // temp negative id for UI only
      name: this.newItemForm.name.trim(),
      sku: this.newItemForm.sku || null,
      category: (this.newItemForm.category || null) as any,
      stock: 0,
      stockUnit: stockUnitApi as any,
      rollLength:
        this.newItemForm.stockUnit === 'METER' &&
        this.newItemForm.rollLength !== ''
          ? Number(this.newItemForm.rollLength)
          : null,
      priceRetail:
        this.newItemForm.priceRetail !== ''
          ? Number(this.newItemForm.priceRetail)
          : null,
      priceWholesale:
        this.newItemForm.priceWholesale !== ''
          ? Number(this.newItemForm.priceWholesale)
          : null,
      description: this.newItemForm.description || null,
      price:
        this.newItemForm.priceRetail !== ''
          ? Number(this.newItemForm.priceRetail)
          : this.newItemForm.priceWholesale !== ''
          ? Number(this.newItemForm.priceWholesale)
          : 0,
      photoUrl: null,
      rolls: [],
    };

    // Add a line for this new item (user can then fill in qty/rolls)
    if (stockUnitApi === 'm') {
      this.lines.push({
        itemId: undefined, // will be set by backend when creating new item
        item: tempItem,
        mode: 'METER',
        newRoll: '',
        newRolls: [],
      });
    } else {
      this.lines.push({
        itemId: undefined,
        item: tempItem,
        mode: 'EACH',
        quantity: 1,
      });
    }

    this.newItemOpen = false;
  }
}
