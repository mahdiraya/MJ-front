import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ApiService,
  InventoryReturnRecord,
  ResolveInventoryReturnPayload,
  Supplier,
} from '../../services/api.service';

type StatusFilter = 'all' | InventoryReturnRecord['status'];
type OutcomeFilter = 'all' | 'restock' | 'defective';

@Component({
  selector: 'app-returns',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './returns.component.html',
  styleUrls: ['./returns.component.css'],
})
export class ReturnsComponent implements OnInit {
  returns: InventoryReturnRecord[] = [];
  filtered: InventoryReturnRecord[] = [];
  loading = false;
  error: string | null = null;
  infoMessage: string | null = null;

  statusFilter: StatusFilter = 'pending';
  outcomeFilter: OutcomeFilter = 'all';
  searchTerm = '';

  resolving:
    | {
        record: InventoryReturnRecord;
        action: 'restock' | 'trash' | 'returnToSupplier';
        note: string;
        supplierId?: number | null;
        supplierNote?: string | null;
      }
    | null = null;
  resolvingBusy = false;
  resolveError: string | null = null;

  suppliers: Supplier[] = [];
  suppliersLoaded = false;
  suppliersLoading = false;

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.loadReturns();
  }

  get pendingCount() {
    return this.returns.filter((entry) => entry.status === 'pending').length;
  }

  loadReturns() {
    this.loading = true;
    this.error = null;
    this.api.listInventoryReturns().subscribe({
      next: (rows) => {
        this.returns = rows || [];
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error =
          err?.error?.message || err?.message || 'Failed to load returns.';
        this.loading = false;
      },
    });
  }

  refresh() {
    this.loadReturns();
  }

  applyFilters() {
    const q = this.searchTerm.trim().toLowerCase();
    let rows = [...this.returns];

    if (this.statusFilter !== 'all') {
      rows = rows.filter((entry) => entry.status === this.statusFilter);
    }
    if (this.outcomeFilter !== 'all') {
      rows = rows.filter(
        (entry) => entry.requestedOutcome === this.outcomeFilter
      );
    }
    if (q) {
      rows = rows.filter((entry) => {
        const itemName = entry.inventoryUnit.item?.name?.toLowerCase() || '';
        const sku = entry.inventoryUnit.item?.sku?.toLowerCase() || '';
        const barcode = entry.inventoryUnit.barcode?.toLowerCase() || '';
        return (
          itemName.includes(q) || sku.includes(q) || barcode.includes(q) || `${entry.id}`.includes(q)
        );
      });
    }
    this.filtered = rows;
  }

  onFiltersChanged() {
    this.applyFilters();
  }

  statusLabel(status: InventoryReturnRecord['status']) {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'restocked':
        return 'Restocked';
      case 'trashed':
        return 'Trashed';
      case 'returned_to_supplier':
        return 'Returned to supplier';
      default:
        return status;
    }
  }

  statusClass(status: InventoryReturnRecord['status']) {
    return `status-chip status-${status}`;
  }

  requestedOutcomeLabel(outcome: 'restock' | 'defective') {
    return outcome === 'restock' ? 'Restock' : 'Defective';
  }

  formatDate(value?: string | null) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  openResolve(
    record: InventoryReturnRecord,
    action: 'restock' | 'trash' | 'returnToSupplier'
  ) {
    this.resolveError = null;
    this.resolving = {
      record,
      action,
      note: '',
      supplierId: record.supplier?.id ?? null,
      supplierNote: record.supplierNote ?? '',
    };
    if (action === 'returnToSupplier') {
      this.ensureSuppliersLoaded();
    }
  }

  cancelResolve() {
    if (this.resolvingBusy) return;
    this.resolving = null;
    this.resolveError = null;
  }

  private ensureSuppliersLoaded() {
    if (this.suppliersLoaded || this.suppliersLoading) return;
    this.suppliersLoading = true;
    this.api.getSuppliers().subscribe({
      next: (rows) => {
        this.suppliers = rows || [];
        this.suppliersLoaded = true;
        this.suppliersLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.resolveError =
          err?.error?.message || err?.message || 'Failed to load suppliers.';
        this.suppliersLoading = false;
      },
    });
  }

  confirmResolve() {
    if (!this.resolving) return;
    const payload: ResolveInventoryReturnPayload = {
      action: this.resolving.action,
    };
    const trimmedNote = this.resolving.note?.trim();
    if (trimmedNote) {
      payload.note = trimmedNote;
    }

    if (this.resolving.action === 'returnToSupplier') {
      if (!this.resolving.supplierId) {
        this.resolveError = 'Select the supplier receiving the defective item.';
        return;
      }
      payload.supplierId = this.resolving.supplierId;
      const supplierNote = this.resolving.supplierNote?.trim();
      if (supplierNote) {
        payload.supplierNote = supplierNote;
      }
    }

    this.resolveError = null;
    this.resolvingBusy = true;
    this.api.resolveInventoryReturn(this.resolving.record.id, payload).subscribe({
      next: () => {
        this.resolvingBusy = false;
        this.resolving = null;
        this.infoMessage = 'Return updated successfully.';
        this.loadReturns();
      },
      error: (err) => {
        console.error(err);
        this.resolveError =
          err?.error?.message || err?.message || 'Failed to resolve return.';
        this.resolvingBusy = false;
      },
    });
  }
}
