import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import {
  ApiService,
  RestockMovementRow,
  RestockMovementsParams,
  CashboxCode,
} from '../../services/api.service';

@Component({
  selector: 'app-purchase-movements',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './purchase-movements.component.html',
  styleUrls: ['./purchase-movements.component.css'],
})
export class PurchaseMovementsComponent implements OnInit {
  loading = false;
  rows: RestockMovementRow[] = [];
  error = '';

  filters: {
    startDate: string;
    endDate: string;
    supplierId: string;
    status: '' | 'PAID' | 'PARTIAL' | 'UNPAID';
    cashboxCode: '' | CashboxCode;
    search: string;
  } = {
    startDate: '',
    endDate: '',
    supplierId: '',
    status: '',
    cashboxCode: '',
    search: '',
  };

  statuses: Array<{ value: 'PAID' | 'PARTIAL' | 'UNPAID'; label: string }> = [
    { value: 'PAID', label: 'Paid' },
    { value: 'PARTIAL', label: 'Partial' },
    { value: 'UNPAID', label: 'Unpaid' },
  ];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
    const params: RestockMovementsParams = {};
    if (this.filters.startDate) params.startDate = this.filters.startDate;
    if (this.filters.endDate) params.endDate = this.filters.endDate;
    if (this.filters.status)
      params.status = this.filters.status as 'PAID' | 'PARTIAL' | 'UNPAID';
    if (this.filters.cashboxCode)
      params.cashboxCode = this.filters.cashboxCode as CashboxCode;
    if (this.filters.search) params.search = this.filters.search;
    if (this.filters.supplierId)
      params.supplierId = Number(this.filters.supplierId);

    this.loading = true;
    this.error = '';
    this.api.getRestockMovements(params).subscribe({
      next: (rows) => {
        this.rows = rows || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load purchase movements', err);
        this.error =
          err?.error?.message || err?.message || 'Failed to load movements';
        this.loading = false;
      },
    });
  }

  resetFilters() {
    this.filters = {
      startDate: '',
      endDate: '',
      supplierId: '',
      status: '',
      cashboxCode: '',
      search: '',
    };
    this.load();
  }

  formatCashboxes(row: RestockMovementRow) {
    return row.cashboxes.length ? row.cashboxes.join(', ') : '—';
  }
}
