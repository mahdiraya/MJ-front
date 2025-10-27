import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  ApiService,
  CashboxSummary,
  CashboxManualEntryRow,
  CashboxManualEntryParams,
  CreateCashboxManualEntryPayload,
  CashboxCode,
} from '../../services/api.service';

@Component({
  selector: 'app-cashbox-ledger',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cashbox-ledger.component.html',
  styleUrls: ['./cashbox-ledger.component.css'],
})
export class CashboxLedgerComponent implements OnInit {
  loading = false;
  submitting = false;
  error = '';

  cashboxes: CashboxSummary[] = [];
  entries: CashboxManualEntryRow[] = [];

  filters: CashboxManualEntryParams = {
    kind: undefined,
    cashboxId: undefined,
    cashboxCode: undefined,
    startDate: '',
    endDate: '',
    search: '',
  };

  form: CreateCashboxManualEntryPayload = {
    amount: 0,
    kind: 'expense',
    cashboxCode: 'A',
    note: '',
    occurredAt: '',
  };

  kinds = [
    { value: 'income' as const, label: 'Income' },
    { value: 'expense' as const, label: 'Expense' },
  ];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.loadCashboxes();
    this.loadEntries();
  }

  loadCashboxes() {
    this.api.getCashboxes().subscribe({
      next: (list) => {
        this.cashboxes = list || [];
        if (!this.form.cashboxCode && this.cashboxes.length) {
          this.form.cashboxCode = this.cashboxes[0].code as CashboxCode;
        }
      },
      error: (err) => {
        console.error('Failed to load cashboxes', err);
      },
    });
  }

  loadEntries() {
    const params: CashboxManualEntryParams = {};
    if (this.filters.kind) params.kind = this.filters.kind;
    if (this.filters.cashboxId)
      params.cashboxId = Number(this.filters.cashboxId);
    if (this.filters.cashboxCode)
      params.cashboxCode = this.filters.cashboxCode as CashboxCode;
    if (this.filters.startDate) params.startDate = this.filters.startDate;
    if (this.filters.endDate) params.endDate = this.filters.endDate;
    if (this.filters.search) params.search = this.filters.search;

    this.loading = true;
    this.error = '';
    this.api.getCashboxManualEntries(params).subscribe({
      next: (rows) => {
        this.entries = rows || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load cashbox entries', err);
        this.error =
          err?.error?.message || err?.message || 'Failed to load entries';
        this.loading = false;
      },
    });
  }

  resetFilters() {
    this.filters = {
      kind: undefined,
      cashboxId: undefined,
      cashboxCode: undefined,
      startDate: '',
      endDate: '',
      search: '',
    };
    this.loadEntries();
  }

  submit() {
    const amount = Number(this.form.amount);
    if (!(amount > 0)) {
      alert('Amount must be greater than zero.');
      return;
    }
    const payload: CreateCashboxManualEntryPayload = {
      amount: +amount.toFixed(2),
      kind: this.form.kind,
      note: this.form.note || undefined,
      occurredAt: this.form.occurredAt
        ? new Date(this.form.occurredAt).toISOString()
        : undefined,
    };
    if (this.form.cashboxId) payload.cashboxId = Number(this.form.cashboxId);
    else if (this.form.cashboxCode)
      payload.cashboxCode = this.form.cashboxCode;

    this.submitting = true;
    this.api.createCashboxManualEntry(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.form = {
          amount: 0,
          kind: this.form.kind,
          cashboxCode: this.form.cashboxCode,
          note: '',
          occurredAt: '',
        };
        this.loadEntries();
      },
      error: (err) => {
        console.error('Failed to create entry', err);
        const msg = err?.error?.message || err?.message || 'Save failed';
        alert(msg);
        this.submitting = false;
      },
    });
  }

  cashboxDisplay(entry: CashboxManualEntryRow) {
    return entry.cashbox
      ? `${entry.cashbox.code} — ${entry.cashbox.label}`
      : '—';
  }
}
