// ...imports unchanged...
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ApiService,
  Item,
  InventoryUnit,
  InventoryUnitHistory,
} from '../../services/api.service';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-items-crud',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './items-crud.component.html',
  styleUrls: ['./items-crud.component.css'],
})
export class ItemsCrudComponent implements OnInit {
  items: Item[] = [];
  filteredItems: Item[] = [];
  pagedItems: Item[] = [];

  categories: string[] = ['Internet', 'Solar', 'Camera', 'Satellite'];
  selectedCategory: string = 'Internet';

  showForm = false;
  itemForm: any = this.createEmptyForm();

  rollCreateCount = 0;
  rollCreateLength = 0;
  rollAddCount = 0;
  rollAddLength = 0;
  serialInput = '';
  autoSerialInitial = false;

  // Photo modal state
  photoModalOpen = false;
  photoItem: Item | null = null;
  photoPreviewUrl: string | null = null;
  selectedFile: File | null = null;
  uploading = false;

  currentPage = 1;
  totalPages = 1;
  readonly PAGE_SIZE = PAGE_SIZE;
  expandedItemId: number | null = null;
  unitsByItem: Partial<Record<number, InventoryUnit[]>> = {};
  unitsLoading = false;
  unitsError = '';
  // Barcode backfill modal
  barcodeModalOpen = false;
  barcodeItemId: number | null = null;
  barcodeUnits: InventoryUnit[] = [];
  barcodeLoading = false;
  barcodeAssigning = false;
  barcodeError = '';
  barcodeMessage = '';
  barcodeInput = '';

  // If your backend origin differs, update here or move to environments
  private readonly BACKEND_BASE = 'http://localhost:3000';

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadItems();
  }

  // Convert relative "/uploads/..." to absolute "http://localhost:3000/uploads/..."
  fileUrl(path: string | null): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.BACKEND_BASE}${path}`;
  }

  private normalizeToMeters(item: Item): Item {
    const unit = (item.stockUnit || '').toLowerCase();
    if (unit === 'cm') {
      const stockNum = Number(item.stock ?? 0);
      return {
        ...item,
        stock: isNaN(stockNum) ? 0 : +(stockNum / 100).toFixed(3),
        stockUnit: 'm',
      };
    }
    return item;
  }

  loadItems() {
    this.api.getItems().subscribe((data) => {
      this.items = (data || []).map((it: any) => this.normalizeToMeters(it));
      this.filterItems();
    });
  }

  filterItems() {
    if (this.selectedCategory === 'all') {
      this.filteredItems = this.items;
    } else if (this.selectedCategory) {
      this.filteredItems = this.items.filter(
        (item) =>
          (item.category || '').toLowerCase() ===
          (this.selectedCategory || '').toLowerCase()
      );
    } else {
      this.filteredItems = [];
    }
    this.currentPage = 1;
    this.setPagination();
  }

  setPagination() {
    this.totalPages = Math.max(
      1,
      Math.ceil(this.filteredItems.length / this.PAGE_SIZE)
    );
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    if (this.currentPage < 1) this.currentPage = 1;
    const start = (this.currentPage - 1) * this.PAGE_SIZE;
    this.pagedItems = this.filteredItems.slice(start, start + this.PAGE_SIZE);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.setPagination();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.setPagination();
    }
  }

  openAdd() {
    this.itemForm = this.createEmptyForm();
    this.rollCreateCount = 0;
    this.rollCreateLength = 0;
    this.serialInput = '';
    this.autoSerialInitial = false;
    this.showForm = true;
  }

  openEdit(item: Item) {
    const normalized = this.normalizeToMeters(item);
    this.itemForm = { ...normalized };
    this.itemForm.stock = Number(this.itemForm.stock ?? 0);
    this.itemForm.priceRetail = Number(
      this.itemForm.priceRetail ?? this.itemForm.price ?? 0
    );
    this.itemForm.priceWholesale =
      this.itemForm.priceWholesale != null
        ? Number(this.itemForm.priceWholesale)
        : undefined;

    this.rollAddCount = 0;
    this.rollAddLength = 0;
    this.serialInput = '';
    this.autoSerialInitial = false;
    this.showForm = true;
  }

  private isMeter(): boolean {
    return (this.itemForm?.stockUnit || '').toLowerCase() === 'm';
  }

  private buildPayloadForSave() {
    const payload: any = { ...this.itemForm };
    payload.priceRetail = Number(payload.priceRetail ?? 0);
    if (
      payload.priceWholesale !== undefined &&
      payload.priceWholesale !== null &&
      payload.priceWholesale !== ''
    ) {
      payload.priceWholesale = Number(payload.priceWholesale);
    } else {
      delete payload.priceWholesale;
    }
    delete payload.price;

    if (payload.stock != null) payload.stock = Number(payload.stock);
    const unit = (payload.stockUnit || '').toLowerCase();

    if (!payload.id) {
      if (unit === 'm') {
        const count = Math.max(0, Math.floor(this.rollCreateCount || 0));
        const length = Number(this.rollCreateLength || 0);

        payload.stockUnit = 'm';
        payload.stock = 0;
        if (count > 0 && length > 0) {
          const len = +Number(length).toFixed(3);
          payload.initialRolls = Array.from({ length: count }, () => len);
        } else {
          delete payload.initialRolls;
        }
      } else if (unit === 'cm') {
        payload.stock = +(Number(payload.stock || 0) / 100).toFixed(3);
        payload.stockUnit = 'm';
      } else {
        payload.stockUnit = null;
        delete payload.initialRolls;
      }
    } else {
      if (unit === 'm') {
        delete payload.stock;
        delete payload.initialRolls;
      } else if (unit === 'cm') {
        payload.stock = +(Number(payload.stock || 0) / 100).toFixed(3);
        payload.stockUnit = 'm';
      } else {
        payload.stockUnit = null;
        delete payload.initialRolls;
      }
    }

    if (!payload.id && payload.stockUnit !== 'm') {
      const serials = this.collectSerials();
      if (this.autoSerialInitial) {
        if (serials.length) {
          alert('Remove manual serial numbers or disable auto-generation.');
          return null;
        }
        payload.autoSerial = true;
        payload.stock = Math.max(0, Math.floor(Number(payload.stock || 0)));
      } else {
        if (!serials.length) {
          alert('Enter serial numbers or enable auto-generation.');
          return null;
        }
        payload.initialSerials = serials;
        payload.stock = serials.length;
      }
    }

    return payload;
  }

  saveItem() {
    const payload = this.buildPayloadForSave();
    if (!payload) return;

    if (payload.id) {
      this.api.updateItem(payload.id, payload).subscribe(() => {
        this.loadItems();
        this.cancelForm();
      });
    } else {
      this.api.addItem(payload).subscribe(() => {
        this.loadItems();
        this.cancelForm();
      });
    }
  }

  addExtraRolls() {
    if (!this.itemForm?.id || !this.isMeter()) return;
    const count = Math.max(0, Math.floor(this.rollAddCount || 0));
    const length = Number(this.rollAddLength || 0);
    if (!(count > 0 && length > 0)) {
      alert('Enter a positive roll count and length.');
      return;
    }

    const calls = Array.from({ length: count }, () =>
      this.api.addRoll(this.itemForm.id, +length.toFixed(3))
    );
    forkJoin(calls).subscribe({
      next: () => {
        this.loadItems();
        this.rollAddCount = 0;
        this.rollAddLength = 0;
        alert('Rolls added.');
      },
      error: (e) => {
        console.error(e);
        alert(e?.error?.message || 'Failed to add rolls');
      },
    });
  }

  deleteItem(id: number) {
    if (confirm('Are you sure you want to delete this item?')) {
      this.api.deleteItem(id).subscribe(() => this.loadItems());
    }
  }

  toggleUnits(item: Item) {
    if (this.expandedItemId === item.id) {
      this.expandedItemId = null;
      return;
    }
    this.expandedItemId = item.id;
    if (!this.unitsByItem[item.id]) {
      this.fetchUnits(item.id);
    }
  }

  fetchUnits(itemId: number) {
    this.unitsLoading = true;
    this.unitsError = '';
    this.api
      .getInventoryUnits(itemId, { includePlaceholders: true })
      .subscribe({
        next: (units) => {
          this.unitsByItem[itemId] = units || [];
          this.unitsLoading = false;
        },
        error: (err) => {
          console.error(err);
          this.unitsError =
            err?.error?.message || err?.message || 'Failed to load inventory units.';
          this.unitsLoading = false;
        },
      });
  }

  assignBarcode(unit: InventoryUnit) {
    const current = unit.barcode || '';
    const value = prompt('Enter barcode (leave blank to clear):', current);
    if (value === null) return;
    const next = value.trim();
    this.api.assignInventoryBarcode(unit.id, next || null).subscribe({
      next: (updated) => this.updateUnitCache(updated),
      error: (err) => {
        console.error(err);
        alert(err?.error?.message || 'Failed to update barcode.');
      },
    });
  }

  markUnit(unit: InventoryUnit, outcome: 'restock' | 'defective') {
    const actionText =
      outcome === 'restock'
        ? 'mark this unit as returned to stock'
        : 'mark this unit as defective';
    if (!confirm(`Are you sure you want to ${actionText}?`)) return;
    this.api.returnInventoryUnit(unit.id, outcome).subscribe({
      next: () => {
        const updatedUnit = { ...unit, status: 'returned' as const };
        this.updateUnitCache(updatedUnit);
        if (outcome === 'restock') {
          this.loadItems();
        }
      },
      error: (err) => {
        console.error(err);
        alert(err?.error?.message || 'Failed to update unit status.');
      },
    });
  }

  private updateUnitCache(updated: InventoryUnit) {
    Object.keys(this.unitsByItem).forEach((key) => {
      const list = this.unitsByItem[Number(key)];
      if (!list) return;
      const idx = list.findIndex((u) => u.id === updated.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...updated };
      }
    });
  }

  private collectSerials(): string[] {
    return (this.serialInput || '')
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  showUnitHistory(unit: InventoryUnit) {
    this.api.getInventoryUnitHistory(unit.id).subscribe({
      next: (history) => this.displayHistory(history),
      error: (err) => {
        console.error(err);
        alert(err?.error?.message || 'Failed to load history.');
      },
    });
  }

  private displayHistory(history: InventoryUnitHistory) {
    const parts: string[] = [];
    parts.push(`Unit #${history.unit.id}`);
    if (history.unit.barcode) {
      parts.push(`Barcode: ${history.unit.barcode}`);
    }
    if (history.restock?.date) {
      parts.push(`Restocked on ${new Date(history.restock.date).toLocaleString()}`);
    }
    if (history.sales.length) {
      parts.push('Sales:');
      history.sales.forEach((sale) => {
        parts.push(
          `• Tx ${sale.transactionId} on ${new Date(sale.transactionDate).toLocaleString()} (${
            sale.customer?.name || 'Walk-in'
          })`
        );
      });
    } else {
      parts.push('No sales recorded for this unit yet.');
    }
    alert(parts.join('\n'));
  }

  cancelForm() {
    this.showForm = false;
    this.itemForm = this.createEmptyForm();
    this.rollCreateCount = 0;
    this.rollCreateLength = 0;
    this.rollAddCount = 0;
    this.rollAddLength = 0;
    this.serialInput = '';
    this.autoSerialInitial = false;
  }

  onAutoSerialInitialToggle() {
    if (this.autoSerialInitial) {
      this.serialInput = '';
    }
  }

  createEmptyForm() {
    return {
      id: undefined,
      name: '',
      sku: '',
      category: '',
      stock: 0,
      stockUnit: undefined as 'm' | 'cm' | undefined,
      priceRetail: 0,
      priceWholesale: undefined as number | undefined,
      description: '',
    };
  }

  // ====== Photo modal logic ======
  openPhotoModal(item: Item) {
    this.photoItem = item;
    this.photoPreviewUrl = null;
    this.selectedFile = null;
    this.photoModalOpen = true;
  }

  closePhotoModal() {
    if (this.photoPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.photoPreviewUrl);
    }
    this.photoPreviewUrl = null;
    this.selectedFile = null;
    this.photoItem = null;
    this.photoModalOpen = false;
  }

  onPhotoFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    this.selectedFile = file;

    if (this.photoPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.photoPreviewUrl);
    }
    this.photoPreviewUrl = URL.createObjectURL(file);
  }

  uploadPhoto() {
    if (!this.photoItem?.id || !this.selectedFile) return;
    this.uploading = true;
    this.api.uploadItemPhoto(this.photoItem.id, this.selectedFile).subscribe({
      next: (updated) => {
        const upd = (arr: Item[]) => {
          const idx = arr.findIndex((i) => i.id === updated.id);
          if (idx >= 0) arr[idx] = { ...arr[idx], ...updated };
        };
        upd(this.items);
        upd(this.filteredItems);
        upd(this.pagedItems);

        this.uploading = false;
        this.closePhotoModal();
      },
      error: (err) => {
        console.error(err);
        alert(err?.error?.message || 'Upload failed');
        this.uploading = false;
      },
    });
  }

  removePhoto() {
    if (!this.photoItem?.id) return;
    if (!confirm('Remove this photo?')) return;

    this.uploading = true;
    this.api.removeItemPhoto(this.photoItem.id).subscribe({
      next: (updated) => {
        const upd = (arr: Item[]) => {
          const idx = arr.findIndex((i) => i.id === updated.id);
          if (idx >= 0) arr[idx] = { ...arr[idx], ...updated };
        };
        upd(this.items);
        upd(this.filteredItems);
        upd(this.pagedItems);

        this.uploading = false;
        this.closePhotoModal();
      },
      error: (err) => {
        console.error(err);
        alert(err?.error?.message || 'Failed to remove photo');
        this.uploading = false;
      },
    });
  }

  // ===== Barcode backfill modal logic =====
  get nextBarcodeUnit(): InventoryUnit | null {
    return this.barcodeUnits.length ? this.barcodeUnits[0] : null;
  }

  openBarcodeModal(item?: Item) {
    this.barcodeModalOpen = true;
    this.barcodeError = '';
    this.barcodeMessage = '';
    this.barcodeInput = '';
    this.barcodeUnits = [];
    this.barcodeItemId = item?.id ?? this.items[0]?.id ?? null;
    if (this.barcodeItemId) {
      this.loadBarcodeUnits(this.barcodeItemId);
    }
  }

  closeBarcodeModal() {
    if (this.barcodeAssigning) return;
    this.barcodeModalOpen = false;
    this.barcodeItemId = null;
    this.barcodeUnits = [];
    this.barcodeError = '';
    this.barcodeMessage = '';
    this.barcodeInput = '';
  }

  onBarcodeItemChange() {
    if (!this.barcodeItemId) {
      this.barcodeUnits = [];
      return;
    }
    this.loadBarcodeUnits(this.barcodeItemId);
  }

  private loadBarcodeUnits(itemId: number) {
    this.barcodeLoading = true;
    this.barcodeError = '';
    this.barcodeMessage = '';
    this.api
      .getInventoryUnits(itemId, {
        includePlaceholders: true,
        status: 'available',
        limit: 200,
      })
      .subscribe({
        next: (units) => {
          const pending =
            units?.filter((unit) => !unit.barcode || unit.isPlaceholder) ?? [];
          pending.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return aTime - bTime;
          });
          this.barcodeUnits = pending;
          this.barcodeLoading = false;
          if (!pending.length) {
            this.barcodeMessage = 'This item has no pending units without barcodes.';
          }
        },
        error: (err) => {
          console.error(err);
          this.barcodeLoading = false;
          this.barcodeError =
            err?.error?.message || err?.message || 'Failed to load inventory units.';
        },
      });
  }

  submitBarcode() {
    const code = this.barcodeInput.trim();
    if (!code || this.barcodeAssigning) return;
    this.assignBarcodeToNext(code);
  }

  autoGenerateBarcode() {
    if (this.barcodeAssigning || !this.barcodeItemId) return;
    const item = this.items.find((it) => it.id === this.barcodeItemId);
    const base =
      (item?.sku || item?.name || 'ITEM').replace(/[^A-Za-z0-9]/g, '').toUpperCase() ||
      'ITEM';
    const suffix = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    const code = `${base}-${suffix}-${random}`;
    this.assignBarcodeToNext(code);
  }

  skipBarcodeUnit() {
    if (this.barcodeUnits.length > 1) {
      const first = this.barcodeUnits.shift();
      if (first) {
        this.barcodeUnits = [...this.barcodeUnits, first];
      }
    }
    this.barcodeInput = '';
    this.barcodeMessage = '';
  }

  private assignBarcodeToNext(code: string) {
    const target = this.nextBarcodeUnit;
    if (!target) return;
    this.barcodeAssigning = true;
    this.barcodeError = '';
    this.barcodeMessage = '';
    this.api.assignInventoryBarcode(target.id, code).subscribe({
      next: () => {
        this.barcodeAssigning = false;
        this.barcodeInput = '';
        this.barcodeUnits = this.barcodeUnits.slice(1);
        this.barcodeMessage = `Assigned ${code} to unit #${target.id}.`;
        if (!this.barcodeUnits.length && this.barcodeItemId) {
          this.loadBarcodeUnits(this.barcodeItemId);
        }
      },
      error: (err) => {
        console.error(err);
        this.barcodeAssigning = false;
        this.barcodeError =
          err?.error?.message ||
          err?.message ||
          'Failed to assign barcode. Please try again.';
      },
    });
  }
}
