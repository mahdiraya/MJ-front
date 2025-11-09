import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  Item,
  Supplier,
  CreateRestockDto,
  CreateRestockLine,
  NewItemPayload,
  CashboxCode,
  PayMethod,
} from '../../services/api.service';
import { ActivatedRoute } from '@angular/router';

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
  suppliers: Supplier[] = [];
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
  supplierInput = '';
  supplierTouched = false;
  supplierError = '';
  date = new Date().toISOString().slice(0, 10);
  note = '';
  tax: number | '' = '';
  paidNow: number | '' = '';
  cashbox: CashboxCode = 'A';
  payMethod: PayMethod = 'cash';
  paymentNote = '';
  statusOverride: '' | 'PAID' | 'PARTIAL' | 'UNPAID' = '';
  statusOverrideNote = '';

  lines: LineUi[] = [];
  submitting = false;

  // New item modal state
  newItemOpen = false;
  newItemSubmitting = false;
  newItemForm: NewItemForm = this.blankNewItem();
  private preselectItemId: number | null = null;

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const itemParam = this.route.snapshot.queryParamMap.get('itemId');
    if (itemParam) {
      const parsed = Number(itemParam);
      if (!Number.isNaN(parsed) && parsed > 0) {
        this.preselectItemId = parsed;
      }
    }

    this.api.getItems().subscribe({
      next: (data) => {
        this.items = data || [];
        if (this.preselectItemId) {
          const target = this.items.find(
            (it) => it.id === this.preselectItemId,
          );
          if (target) {
            this.q = target.name;
          }
          this.preselectItemId = null;
        }
        this.applyFilters();
      },
      error: (e) => console.error(e),
    });

    this.api.getSuppliers().subscribe({
      next: (data) => {
        this.suppliers = (data ?? []).sort((a, b) =>
          (a.name || '').localeCompare(b.name || ''),
        );
      },
      error: (e) => console.error('Failed to load suppliers', e),
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

  onSupplierInput() {
    if (this.supplierError) {
      this.validateSupplier();
    }
  }

  onSupplierBlur() {
    this.supplierTouched = true;
    this.validateSupplier();
  }

  private validateSupplier(): boolean {
    const valid = !!this.supplierInput.trim();
    this.supplierError = valid ? '' : 'Supplier is required.';
    return valid;
  }

  private rememberSupplier(supplier: Supplier | null | undefined) {
    if (!supplier || !supplier.id) return;
    const existingIndex = this.suppliers.findIndex((s) => s.id === supplier.id);
    if (existingIndex >= 0) {
      const next = [...this.suppliers];
      next[existingIndex] = {
        ...next[existingIndex],
        ...supplier,
      };
      this.suppliers = next.sort((a, b) =>
        (a.name || '').localeCompare(b.name || ''),
      );
      return;
    }
    this.suppliers = [...this.suppliers, supplier].sort((a, b) =>
      (a.name || '').localeCompare(b.name || ''),
    );
  }

  get selectedSupplier() {
    const name = this.supplierInput.trim().toLowerCase();
    if (!name) return null;
    return (
      this.suppliers.find(
        (s) => (s.name || '').toLowerCase() === name,
      ) ?? null
    );
  }

  addEach(it: Item) {
    if (it.stockUnit === 'm') {
      alert('This item is metered. Use "Add METER" instead.');
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
      alert('This item is not metered. Use "Add EACH" instead.');
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

    const supplierName = this.supplierInput.trim();
    if (!supplierName) {
      this.supplierTouched = true;
      this.validateSupplier();
      alert('Supplier name is required.');
      return;
    }
    const matchingSupplier = this.suppliers.find(
      (s) => (s.name || '').toLowerCase() === supplierName.toLowerCase(),
    );

    const items: CreateRestockLine[] = [];
    for (const l of this.lines) {
      const unitCost =
        (l as any).unitCost != null
          ? +Number((l as any).unitCost).toFixed(2)
          : undefined;

      const hasExistingItem = l.itemId != null && l.itemId > 0;
      if (hasExistingItem) {
        if (this.isEach(l)) {
          items.push({
            itemId: l.itemId!,
            mode: 'EACH',
            quantity: Math.max(1, Math.floor(Number(l.quantity || 1))),
            unitCost,
          });
        } else {
          items.push({
            itemId: l.itemId!,
            mode: 'METER',
            newRolls: (l as LineUiMeter).newRolls.map((n) =>
              +Number(n).toFixed(3),
            ),
            unitCost,
          });
        }
        continue;
      }

      const tempItem = l.item;
      if (!tempItem) {
        alert('Each line must include an existing item or new item details.');
        return;
      }
      const name = tempItem.name?.trim() ?? '';
      if (!name) {
        alert('New items require a name.');
        return;
      }
      const newItem: NewItemPayload = {
        name,
      };
      if (tempItem.sku != null) newItem.sku = tempItem.sku;
      if (tempItem.category != null) newItem.category = tempItem.category;
      if (tempItem.stockUnit != null) newItem.stockUnit = tempItem.stockUnit;
      if (tempItem.rollLength != null) newItem.rollLength = tempItem.rollLength;
      if (tempItem.priceRetail != null)
        newItem.priceRetail = tempItem.priceRetail;
      if (tempItem.priceWholesale != null)
        newItem.priceWholesale = tempItem.priceWholesale;
      if (tempItem.description != null)
        newItem.description = tempItem.description;

      if (this.isEach(l)) {
        items.push({
          newItem,
          mode: 'EACH',
          quantity: Math.max(1, Math.floor(Number(l.quantity || 1))),
          unitCost,
        });
      } else {
        items.push({
          newItem,
          mode: 'METER',
          newRolls: (l as LineUiMeter).newRolls.map((n) =>
            +Number(n).toFixed(3),
          ),
          unitCost,
        });
      }
    }

    const payload: CreateRestockDto = {
      supplier: matchingSupplier?.id,
      supplierName,
      date: this.date ? new Date(this.date).toISOString() : undefined,
      note: this.note || undefined,
      tax: this.tax !== '' ? +Number(this.tax).toFixed(2) : undefined,
      items,
    };

    const paidValue =
      this.paidNow !== '' ? +Number(this.paidNow).toFixed(2) : undefined;
    if (paidValue && paidValue > 0) {
      payload.paid = paidValue;
      payload.cashboxCode = this.cashbox;
      payload.payMethod = this.payMethod;
      payload.paymentNote = this.paymentNote || undefined;
      payload.paymentDate = this.date
        ? new Date(this.date).toISOString()
        : new Date().toISOString();
    }

    if (this.statusOverride) {
      payload.statusOverride = this.statusOverride;
      payload.statusOverrideNote =
        this.statusOverrideNote?.trim().length
          ? this.statusOverrideNote.trim()
          : undefined;
    }

    this.submitting = true;
    this.api.createRestock(payload).subscribe({
      next: (restock) => {
        this.submitting = false;
        alert('Restock saved.');
        const createdSupplierId =
          (restock as any)?.supplierId ??
          (restock as any)?.supplier_id ??
          matchingSupplier?.id ??
          null;
        const createdSupplierName =
          (restock as any)?.supplierName ?? supplierName;
        if (createdSupplierId) {
          this.rememberSupplier({
            id: createdSupplierId,
            name: createdSupplierName,
            phone: null,
            email: null,
            address: null,
            notes: null,
          });
        }
        this.supplierInput = createdSupplierName;
        this.supplierTouched = false;
        this.supplierError = '';
        this.lines = [];
        this.paidNow = '';
        this.paymentNote = '';
        this.statusOverride = '';
        this.statusOverrideNote = '';
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

