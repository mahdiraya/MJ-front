import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  ApiService,
  Customer,
  TransactionMovementRow,
} from '../../services/api.service';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './customer-detail.component.html',
  styleUrls: ['./customer-detail.component.css'],
})
export class CustomerDetailComponent implements OnInit {
  loading = false;
  error = '';
  customer: Customer | null = null;
  receipts: TransactionMovementRow[] = [];

  constructor(
    private readonly api: ApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
      this.router.navigate(['/customers']);
      return;
    }
    this.load(id);
  }

  load(id: number): void {
    this.loading = true;
    this.error = '';
    forkJoin({
      customer: this.api.getCustomer(id),
      receipts: this.api.getCustomerReceipts(id),
    }).subscribe({
      next: ({ customer, receipts }) => {
        this.customer = customer;
        this.receipts = receipts ?? [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load customer detail', err);
        this.error = err?.error?.message || 'Failed to load customer detail';
        this.loading = false;
      },
    });
  }

  get totalSpent(): number {
    return this.receipts.reduce((sum, r) => sum + (r.total ?? 0), 0);
  }

  get lastPurchase(): string | null {
    if (!this.receipts.length) return null;
    const sorted = [...this.receipts].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
    return sorted[0]?.date ?? null;
  }

  trackReceipt(_index: number, receipt: TransactionMovementRow) {
    return receipt.id;
  }
}
