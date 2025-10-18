// ...imports unchanged...
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Item } from '../../services/api.service';
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

  // Photo modal state
  photoModalOpen = false;
  photoItem: Item | null = null;
  photoPreviewUrl: string | null = null;
  selectedFile: File | null = null;
  uploading = false;

  currentPage = 1;
  totalPages = 1;
  readonly PAGE_SIZE = PAGE_SIZE;

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

    return payload;
  }

  saveItem() {
    const payload = this.buildPayloadForSave();

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

  cancelForm() {
    this.showForm = false;
    this.itemForm = this.createEmptyForm();
    this.rollCreateCount = 0;
    this.rollCreateLength = 0;
    this.rollAddCount = 0;
    this.rollAddLength = 0;
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
}
