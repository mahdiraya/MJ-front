import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import {
  ApiService,
  TransactionMovementRow,
  TransactionMovementsParams,
  CashboxCode,
} from '../../services/api.service';

@Component({
  selector: 'app-sales-movements',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sales-movements.component.html',
  styleUrls: ['./sales-movements.component.css'],
})
export class SalesMovementsComponent implements OnInit {
  loading = false;
  rows: TransactionMovementRow[] = [];
  error = '';

  filters: {
    startDate: string;
    endDate: string;
    customerId: string;
    status: '' | 'PAID' | 'PARTIAL' | 'UNPAID';
    cashboxCode: '' | CashboxCode;
    search: string;
  } = {
    startDate: '',
    endDate: '',
    customerId: '',
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
    const params: TransactionMovementsParams = {};
    if (this.filters.startDate) params.startDate = this.filters.startDate;
    if (this.filters.endDate) params.endDate = this.filters.endDate;
    if (this.filters.status)
      params.status = this.filters.status as 'PAID' | 'PARTIAL' | 'UNPAID';
    if (this.filters.cashboxCode)
      params.cashboxCode = this.filters.cashboxCode as CashboxCode;
    if (this.filters.search) params.search = this.filters.search;
    if (this.filters.customerId)
      params.customerId = Number(this.filters.customerId);

    this.loading = true;
    this.error = '';
    this.api.getSalesMovements(params).subscribe({
      next: (rows) => {
        this.rows = rows || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load sales movements', err);
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
      customerId: '',
      status: '',
      cashboxCode: '',
      search: '',
    };
    this.load();
  }

  formatCashboxes(row: TransactionMovementRow) {
    return row.cashboxes.length ? row.cashboxes.join(', ') : '—';
  }
}
