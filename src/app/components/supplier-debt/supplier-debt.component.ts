import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  ApiService,
  SupplierDebtOverview,
  SupplierDebtDetail,
  SupplierDebtSummaryRow,
  RecordSupplierPaymentPayload,
  CashboxCode,
  PayMethod,
} from '../../services/api.service';

@Component({
  selector: 'app-supplier-debt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supplier-debt.component.html',
  styleUrls: ['./supplier-debt.component.css'],
  providers: [CurrencyPipe, DatePipe],
})
export class SupplierDebtComponent implements OnInit {
  overviewLoading = false;
  detailLoading = false;
  submittingPayment = false;

  overview: SupplierDebtOverview | null = null;
  filteredSuppliers: SupplierDebtSummaryRow[] = [];
  selectedSupplierId: number | null = null;
  detail: SupplierDebtDetail | null = null;

  search = '';

  paymentAmount: number | '' = '';
  paymentDate: string | '' = '';
  paymentCashbox: CashboxCode = 'A';
  paymentMethod: PayMethod = 'cash';
  paymentNote = '';

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.loadOverview();
  }

  loadOverview() {
    this.overviewLoading = true;
    this.api.getSupplierDebtOverview().subscribe({
      next: (data) => {
        this.overview = data;
        this.applyFilters();
        this.overviewLoading = false;

        if (this.filteredSuppliers.length) {
          const preferredRow =
            this.filteredSuppliers.find(
              (s) => s.supplierId != null && s.outstanding > 0.01,
            ) ??
            this.filteredSuppliers.find((s) => s.supplierId != null);
          if (preferredRow?.supplierId != null) {
            this.selectSupplier(preferredRow.supplierId);
          } else {
            this.selectedSupplierId = null;
            this.detail = null;
          }
        } else {
          this.detail = null;
          this.selectedSupplierId = null;
        }
      },
      error: (err) => {
        console.error('Failed to load supplier debt overview', err);
        this.overviewLoading = false;
      },
    });
  }

  applyFilters() {
    if (!this.overview) {
      this.filteredSuppliers = [];
      return;
    }
    const q = this.search.trim().toLowerCase();
    this.filteredSuppliers = this.overview.suppliers.filter((row) => {
      if (!q) return true;
      return (
        row.supplierName.toLowerCase().includes(q) ||
        (row.supplierId != null &&
          `#${row.supplierId}`.toLowerCase().includes(q))
      );
    });
  }

  selectSupplier(supplierId: number) {
    if (this.selectedSupplierId === supplierId) return;
    this.selectedSupplierId = supplierId;
    this.loadDetail(supplierId);
  }

  refreshDetail() {
    if (this.selectedSupplierId != null) {
      this.loadDetail(this.selectedSupplierId);
    }
  }

  private loadDetail(supplierId: number) {
    if (supplierId == null) {
      this.detail = null;
      return;
    }
    this.detailLoading = true;
    this.api.getSupplierDebtDetail(supplierId).subscribe({
      next: (data) => {
        this.detail = data;
        this.detailLoading = false;
      },
      error: (err) => {
        console.error('Failed to load supplier detail', err);
        this.detailLoading = false;
      },
    });
  }

  outstandingStyle(row: SupplierDebtSummaryRow) {
    if (row.outstanding <= 0.01) return 'paid';
    return row.outstanding > 0 ? 'due' : '';
  }

  submitPayment() {
    if (this.selectedSupplierId == null || !this.detail) return;
    const amount =
      this.paymentAmount !== ''
        ? +Number(this.paymentAmount).toFixed(2)
        : NaN;
    if (!(amount > 0)) {
      alert('Enter a payment amount greater than 0.');
      return;
    }

    this.submittingPayment = true;
    const payload: RecordSupplierPaymentPayload = {
      amount,
      cashboxCode: this.paymentCashbox,
      note: this.paymentNote || undefined,
      payMethod: this.paymentMethod,
    };
    if (this.paymentDate) {
      payload.paymentDate = new Date(this.paymentDate).toISOString();
    }

    this.api
      .recordSupplierPayment(this.selectedSupplierId, payload)
      .subscribe({
        next: () => {
          this.submittingPayment = false;
          this.paymentAmount = '';
          this.paymentDate = '';
          this.paymentNote = '';
          this.paymentMethod = 'cash';
          this.loadOverview();
          this.loadDetail(this.selectedSupplierId!);
        },
        error: (err) => {
          console.error('Failed to record supplier payment', err);
          const msg =
            err?.error?.message ||
            err?.message ||
            'Failed to record payment';
          alert(msg);
          this.submittingPayment = false;
        },
      });
  }
}
