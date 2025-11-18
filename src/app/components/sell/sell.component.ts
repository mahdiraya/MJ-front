import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ApiService,
  Item,
  Roll,
  CreateTransactionDto,
  UpdateTransactionPayload,
  TxLine,
  PriceTier,
  PayMethod,
  CashboxCode,
  Customer,
  InventoryUnit,
  InventoryReturnRecord,
  ReceiptType,
  Transaction,
} from '../../services/api.service';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { catchError } from 'rxjs/operators';

type PriceMode = 'retail' | 'wholesale' | 'custom';

type CartLine = {
  itemId: number;
  name: string;
  price: number; // unit price (per piece or per meter)
  priceMode: PriceMode; // retail | wholesale | custom
  stockUnit: 'm' | null; // drives UI
  sku?: string;
  inventoryUnitIds?: number[];
  scannedBarcodes?: string[];
  unitStatuses?: InventoryUnit['status'][];
  unitReturnSnapshots?: Array<
    | {
        id: number;
        status: InventoryReturnRecord['status'];
        requestedOutcome: 'restock' | 'defective';
        resolvedAt?: string | null;
        createdAt?: string | null;
        note?: string | null;
      }
    | null
  >;

  // EACH
  quantity?: number;

  // METER
  lengthMeters?: number;
  rollId?: number;
  rolls?: Roll[]; // available rolls for selection
};

type TransactionLine = Transaction['transactionItems'][number];

@Component({
  selector: 'app-sell',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sell.component.html',
  styleUrls: ['./sell.component.css'],
})
export class SellComponent implements OnInit, OnDestroy {
  items: Item[] = [];
  filteredItems: Item[] = [];
  categories: string[] = ['internet', 'solar', 'camera', 'satellite'];
  selectedCategory = '';
  search = '';
  inStockOnly = true;
  paidNow: number | '' = '';
  cashbox: CashboxCode = 'A';
  payMethod: PayMethod = 'cash';
  paymentNote = '';
  statusOverride: '' | 'PAID' | 'PARTIAL' | 'UNPAID' = '';
  statusOverrideNote = '';

  cart: CartLine[] = [];
  customerName = '';
  customerPhone = '';
  customers: Customer[] = [];
  note = '';
  scanInput = '';
  scanError = '';
  scanLoading = false;
  itemsLoaded = false;
  currentReceiptType: ReceiptType = 'simple';
  editingTxId: number | null = null;
  editLoading = false;
  editError = '';
  pendingEditTx: Transaction | null = null;
  saving = false;
  editNote = '';
  returnSelection = new Set<number>();
  private routeSub?: Subscription;

  // default tier used when adding new lines (per-line can override)
  defaultTier: PriceTier = 'retail';

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.routeSub = this.route.queryParamMap.subscribe((params) => {
      const editParam = params.get('edit');
      const editId = editParam ? Number(editParam) : NaN;
      if (Number.isFinite(editId) && editId > 0) {
        if (this.editingTxId !== editId) {
          this.startEditMode(editId);
        }
      } else if (this.editingTxId) {
        this.resetEditState({ preserveForm: true });
      }
    });
    this.loadItems();
    this.loadCustomers();
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  loadItems() {
    this.itemsLoaded = false;
    this.api.getItems().subscribe({
      next: (data) => {
        this.items = data ?? [];
        this.itemsLoaded = true;
        this.applyFilters();
        if (this.pendingEditTx) {
          this.populateCartFromTransaction(this.pendingEditTx);
        }
      },
      error: (e) => {
        console.error('Failed to load items', e);
        this.itemsLoaded = true;
        this.applyFilters();
        if (this.pendingEditTx) {
          this.populateCartFromTransaction(this.pendingEditTx);
        }
      },
    });
  }

  loadCustomers() {
    this.api.getCustomers().subscribe({
      next: (data) => {
        if (!Array.isArray(data)) {
          this.customers = [];
          return;
        }
        const seen = new Set<string>();
        this.customers = data
          .filter((c) => !!c?.name)
          .filter((c) => {
            const key = c.name.trim().toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
      },
      error: (e) => console.error('Failed to load customers', e),
    });
  }

  private startEditMode(id: number) {
    this.editingTxId = id;
    this.editError = '';
    this.editLoading = true;
    this.pendingEditTx = null;
    this.editNote = '';
    this.resetFormState();
    this.api.getTransactionReceipt(id).subscribe({
      next: (tx) => {
        this.editLoading = false;
        this.currentReceiptType = tx.receipt_type || 'simple';
        this.populateCartFromTransaction(tx);
      },
      error: (err) => {
        console.error('Failed to load receipt for edit', err);
        this.editError =
          err?.error?.message ||
          err?.message ||
          'Failed to load receipt for editing.';
        this.editLoading = false;
      },
    });
  }

  cancelEditMode() {
    if (!this.editingTxId) return;
    this.navigateWithoutEditParam();
    this.resetEditState();
  }

  private navigateWithoutEditParam() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { edit: null },
      queryParamsHandling: 'merge',
    });
  }

  private resetEditState(options: { preserveForm?: boolean } = {}) {
    if (!options.preserveForm) {
      this.resetFormState();
    }
    this.editingTxId = null;
    this.editError = '';
    this.editLoading = false;
    this.pendingEditTx = null;
    this.currentReceiptType = 'simple';
    this.editNote = '';
    this.returnSelection.clear();
  }

  private resetFormState() {
    this.cart = [];
    this.note = '';
    this.paidNow = '';
    this.paymentNote = '';
    this.customerName = '';
    this.customerPhone = '';
    this.statusOverride = '';
    this.statusOverrideNote = '';
    this.scanInput = '';
    this.scanError = '';
    this.editNote = '';
    this.returnSelection.clear();
  }

  private populateCartFromTransaction(tx: Transaction) {
    this.returnSelection.clear();
    this.pendingEditTx = tx;
    if (!this.itemsLoaded || !this.editingTxId) return;
    const hydrated =
      tx.transactionItems?.map((line) => this.buildLineFromTransactionItem(line)) ||
      [];
    this.cart = hydrated.filter((line): line is CartLine => !!line);
    this.note = tx.note || '';
    this.customerName = tx.customer?.name || '';
    this.customerPhone = tx.customer?.contact_info || '';
    this.paidNow = '';
    this.paymentNote = '';
    this.scanInput = '';
    this.scanError = '';
    this.statusOverride = '';
    this.statusOverrideNote = '';
    this.cart
      .filter((line) => line.stockUnit === 'm')
      .forEach((line) => this.fetchRollsForLine(line));
  }

  returnCountForLine(line: CartLine) {
    if (!line.inventoryUnitIds?.length) return 0;
    return line.inventoryUnitIds.filter((id) => this.returnSelection.has(id)).length;
  }

  canToggleReturn(line: CartLine, unitIndex: number) {
    if (!this.editingTxId) return false;
    const status = line.unitStatuses?.[unitIndex];
    const snapshot = line.unitReturnSnapshots?.[unitIndex];
    if (snapshot && snapshot.status === 'pending') {
      return false;
    }
    return status === 'sold';
  }

  isUnitMarkedForReturn(unitId: number) {
    return this.returnSelection.has(unitId);
  }

  toggleReturnUnit(line: CartLine, unitId: number, unitIndex: number) {
    if (!this.editingTxId) return;
    if (!this.canToggleReturn(line, unitIndex)) return;
    if (this.returnSelection.has(unitId)) {
      this.returnSelection.delete(unitId);
    } else {
      this.returnSelection.add(unitId);
    }
  }

  clearReturnsForLine(line: CartLine) {
    if (!line.inventoryUnitIds?.length) return;
    line.inventoryUnitIds.forEach((id) => this.returnSelection.delete(id));
  }

  unitChipLabel(line: CartLine, index: number, unitId: number) {
    const code = line.scannedBarcodes?.[index]?.trim();
    if (code) {
      return code.length > 10 ? `${code.slice(0, 10)}...` : code;
    }
    return `Unit #${unitId}`;
  }

  unitStatusBadge(line: CartLine, index: number) {
    const snapshot = line.unitReturnSnapshots?.[index];
    if (snapshot) {
      switch (snapshot.status) {
        case 'pending':
          return 'Pending return';
        case 'restocked':
          return 'Restocked';
        case 'trashed':
          return 'Trashed';
        case 'returned_to_supplier':
          return 'Returned to supplier';
        default:
          break;
      }
    }
    const status = line.unitStatuses?.[index];
    if (!status || status === 'sold') return '';
    if (status === 'returned') return 'Returned';
    if (status === 'defective') return 'Defective';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  private requestReturnsForUnits(unitIds: number[], editNote?: string | null) {
    const trimmed = editNote?.trim();
    const note = trimmed ? `Receipt edit: ${trimmed}` : undefined;
    return forkJoin(
      unitIds.map((unitId) =>
        this.api.requestInventoryReturn(unitId, {
          requestedOutcome: 'defective',
          note,
        })
      )
    );
  }

  private buildLineFromTransactionItem(line: TransactionLine): CartLine | null {
    const sourceItem = this.itemById(line.item.id) || this.ensureGhostItem(line.item);
    if (!sourceItem) return null;
    const stockUnit = sourceItem.stockUnit ?? null;
    const cartLine: CartLine = {
      itemId: line.item.id,
      name: sourceItem.name || line.item.name || `Item #${line.item.id}`,
      price: Number(line.price_each ?? 0),
      priceMode: 'custom',
      stockUnit,
      sku: sourceItem.sku || line.item.sku || undefined,
    };
    if (stockUnit === 'm') {
      cartLine.lengthMeters = Number(line.length_m ?? 0);
      cartLine.rollId = line.roll?.id ?? undefined;
    } else {
      cartLine.quantity = line.quantity;
      const unitLinks = line.inventoryUnitLinks || [];
      if (unitLinks.length) {
        cartLine.inventoryUnitIds = unitLinks.map(
          (link) => link.inventoryUnit.id
        );
        cartLine.scannedBarcodes = unitLinks.map(
          (link) => link.inventoryUnit.barcode || `#${link.inventoryUnit.id}`
        );
        cartLine.unitStatuses = unitLinks.map(
          (link) => link.inventoryUnit.status,
        );
        cartLine.unitReturnSnapshots = unitLinks.map((link) => {
          const info = (link.inventoryUnit as any)?.latestReturn;
          return info
            ? {
                id: info.id,
                status: info.status,
                requestedOutcome: info.requestedOutcome,
                resolvedAt: info.resolvedAt ?? null,
                createdAt: info.createdAt ?? null,
                note: info.note ?? null,
              }
            : null;
        });
      }
    }
    return cartLine;
  }

  private ensureGhostItem(txItem: TransactionLine['item']): Item {
    let existing = this.itemById(txItem.id);
    if (existing) return existing;
    const ghost: Item = {
      id: txItem.id,
      name: txItem.name || `Item #${txItem.id}`,
      stock: 0,
      stockUnit: (txItem.stockUnit as Item['stockUnit']) ?? null,
      category: null,
      priceRetail: 0,
      priceWholesale: 0,
      price: 0,
      description: null,
    };
    this.items = [...this.items, ghost];
    this.applyFilters();
    return ghost;
  }

  private fetchRollsForLine(line: CartLine) {
    if (line.stockUnit !== 'm') return;
    this.api.listRollsByItem(line.itemId).subscribe({
      next: (rolls) => (line.rolls = rolls),
      error: () => (line.rolls = []),
    });
  }

  handleScanSubmit(event?: Event) {
    event?.preventDefault();
    const code = this.scanInput.trim();
    if (!code) return;
    this.scanLoading = true;
    this.scanError = '';
    this.api.lookupInventoryByBarcode(code).subscribe({
      next: (unit) => {
        this.scanLoading = false;
        this.scanInput = '';
        this.addScannedUnit(unit);
      },
      error: (err) => {
        this.scanLoading = false;
        this.scanError =
          err?.error?.message || err?.message || 'Barcode not found.';
      },
    });
  }

  private addScannedUnit(unit: InventoryUnit) {
    if (unit.status !== 'available') {
      this.scanError = 'This item is not available for sale.';
      return;
    }
    const item =
      this.items.find((it) => it.id === unit.item?.id) || unit.item;
    if (!item) {
      this.scanError = 'Item data unavailable for this barcode.';
      return;
    }
    if (item.stockUnit === 'm') {
      this.scanError = 'Meter-based items must be added manually.';
      return;
    }
    const price = this.unitPriceFor(item, this.defaultTier);
    const displayCode = unit.barcode || `#${unit.id}`;
    const existing = this.cart.find(
      (line) =>
        line.itemId === item.id &&
        line.inventoryUnitIds &&
        line.inventoryUnitIds.length > 0,
    );
    if (existing && existing.inventoryUnitIds) {
      if (existing.inventoryUnitIds.includes(unit.id)) {
        this.scanError = 'This unit is already in the cart.';
        return;
      }
      existing.inventoryUnitIds.push(unit.id);
      existing.scannedBarcodes = [
        ...(existing.scannedBarcodes || []),
        displayCode,
      ];
      existing.quantity = (existing.quantity || 0) + 1;
    } else {
      this.cart.push({
        itemId: item.id,
        name: item.name,
        price,
        priceMode: this.defaultTier,
        stockUnit: null,
        sku: item.sku || undefined,
        quantity: 1,
        inventoryUnitIds: [unit.id],
        scannedBarcodes: [displayCode],
      });
    }
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

    this.fetchRollsForLine(line);
  }

  updateQuantity(i: number, qty: number) {
    const line = this.cart[i];
    if (!line) return;
    if (line.stockUnit === 'm') return; // handled by updateMeters
     if (line.inventoryUnitIds?.length) return;
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
    const line = this.cart[i];
    if (line?.inventoryUnitIds?.length) {
      line.inventoryUnitIds.forEach((id) => this.returnSelection.delete(id));
    }
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
    if (!this.cart.length || this.saving) return;
    let trimmedEditNote: string | null = null;
    const pendingReturns = this.editingTxId ? Array.from(this.returnSelection) : [];
    const trimmedCustomer = this.customerName.trim();
    const trimmedPhone = this.customerPhone.trim();
    const trimmedNoteValue = this.note.trim();

    if (this.editingTxId) {
      trimmedEditNote = this.editNote.trim();
      if (!trimmedEditNote || trimmedEditNote.length < 3) {
        alert('Please describe what changed (at least 3 characters) before updating the receipt.');
        return;
      }
      const confirmMsg =
        'You are about to overwrite this receipt. Continue?\n\nReason: ' +
        trimmedEditNote;
      if (!confirm(confirmMsg)) {
        return;
      }
    }

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
        inventoryUnitIds: l.inventoryUnitIds?.length
          ? [...l.inventoryUnitIds]
          : undefined,
      };
    });

    const payload: CreateTransactionDto = {
      receipt_type: this.editingTxId
        ? this.currentReceiptType
        : 'simple',
      items,
      note: trimmedNoteValue || undefined,
    };

    const name = this.customerName.trim();
    if (name) {
      payload.customerName = name;
    }
    if (trimmedPhone && name) {
      (payload as any).customerPhone = trimmedPhone;
    }

    const paidValue =
      this.paidNow !== '' ? +Number(this.paidNow).toFixed(2) : undefined;
    if (paidValue && paidValue > 0) {
      payload.paid = paidValue;
      payload.cashboxCode = this.cashbox;
      payload.payMethod = this.payMethod;
      payload.paymentNote = this.paymentNote || undefined;
      payload.paymentDate = new Date().toISOString();
    }

    if (this.statusOverride) {
      payload.statusOverride = this.statusOverride;
      payload.statusOverrideNote =
        this.statusOverrideNote?.trim().length
          ? this.statusOverrideNote.trim()
          : undefined;
    }

    this.saving = true;
    const request$ = this.editingTxId
      ? this.api.updateTransaction(this.editingTxId, {
          ...payload,
          editNote: trimmedEditNote!,
        } as UpdateTransactionPayload)
      : this.api.createTransaction(payload);

    request$.subscribe({
      next: (tx) => {
        if (this.editingTxId && pendingReturns.length) {
          this.requestReturnsForUnits(pendingReturns, trimmedEditNote).subscribe({
            next: () => {
              this.saving = false;
              this.afterSaveSuccess(tx, payload.customerName);
            },
            error: (err: unknown) => {
              this.saving = false;
              console.error('Failed to queue returns', err);
              const errMessage =
                (err as { error?: { message?: string } })?.error?.message ||
                (err as Error)?.message ||
                null;
              const finalMessage = errMessage
                ? `Receipt updated, but the selected units were not queued for returns:\n${errMessage}\n\nYou can queue them manually from the Returns workspace.`
                : 'Receipt updated, but the selected units were not queued for returns. Please try again from the Returns page.';
              alert(finalMessage);
              this.afterSaveSuccess(tx, payload.customerName);
            },
          });
          return;
        }
        this.saving = false;
        this.afterSaveSuccess(tx, payload.customerName);
      },
      error: (err) => {
        this.saving = false;
        console.error('Checkout failed', err);
        const raw = err?.error?.message;
        const msg = Array.isArray(raw)
          ? raw.join('\n')
          : raw || 'Checkout failed';
        alert(msg);
      },
    });
  }

  onCustomerNameChange(value: string) {
    const trimmed = value.trim();
    this.customerName = value;
    if (!trimmed) {
      this.customerPhone = '';
      return;
    }
    const match = this.customers.find(
      (c) => c.name?.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (match) {
      this.customerPhone = match.contact_info || '';
    }
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

  private afterSaveSuccess(tx: Transaction, customerName?: string | null) {
    const name = (customerName ?? this.customerName).trim();
    this.rememberCustomerName(name);
    this.loadCustomers();
    this.resetFormState();
    this.loadItems();
    if (this.editingTxId) {
      this.navigateWithoutEditParam();
      this.resetEditState({ preserveForm: true });
    }
    this.router.navigate(['/receipt', tx.id]);
    this.editNote = '';
  }

  private rememberCustomerName(rawName?: string | null) {
    const name = (rawName ?? '').toString().trim();
    if (!name) return;
    const exists = this.customers.some(
      (c) => c.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (!exists) {
      this.customers = [
        ...this.customers,
        {
          id: Date.now(),
          name,
          customer_type: 'regular',
          contact_info: null,
          notes: null,
        },
      ];
    }
  }
}
