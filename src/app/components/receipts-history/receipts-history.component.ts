import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, UnifiedReceiptRow } from '../../services/api.service';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-receipts-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './receipts-history.component.html',
  styleUrls: ['./receipts-history.component.css'],
  providers: [DatePipe],
})
export class ReceiptsHistoryComponent implements OnInit {
  loading = false;
  error = '';
  rows: UnifiedReceiptRow[] = [];
  filtered: UnifiedReceiptRow[] = [];
  paged: UnifiedReceiptRow[] = [];

  filters = {
    q: '',
    mode: '' as '' | 'IN' | 'OUT',
  };

  page = 1;
  pageSize = PAGE_SIZE;
  totalPages = 1;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.reload();
  }

  reload() {
    this.loading = true;
    this.api.getReceiptsHistory().subscribe({
      next: (rows) => {
        this.rows = (rows || []).map((r) => {
          const normalizedCode = (() => {
            const candidate = r.statusCode ?? r.status?.toUpperCase();
            if (!candidate) return undefined;
            if (candidate === 'PAID' || candidate === 'PARTIAL' || candidate === 'UNPAID') {
              return candidate as 'PAID' | 'PARTIAL' | 'UNPAID';
            }
            return undefined;
          })();
          const normalizedStatus = normalizedCode
            ? (normalizedCode.toLowerCase() as UnifiedReceiptRow['status'])
            : undefined;
          return {
            ...r,
            date: r.date || new Date(0).toISOString(),
            statusCode: normalizedCode,
            status: normalizedStatus,
            paid: typeof r.paid === 'number' ? r.paid : undefined,
          };
        });
        this.page = 1;
        this.applyFilters();
        this.loading = false;
      },
      error: (e) => {
        this.error = e?.error?.message || 'Failed to load receipts';
        this.loading = false;
      },
    });
  }

  applyFilters() {
    const q = this.filters.q.trim().toLowerCase();
    const mode = this.filters.mode;

    this.filtered = this.rows.filter((r) => {
      const byMode = !mode || r.mode === mode;
      const byQ =
        !q ||
        r.id.toLowerCase().includes(q) ||
        (r.user?.name || '').toLowerCase().includes(q) ||
        (r.party?.name || String(r.party?.id || '')).toLowerCase().includes(q);
      return byMode && byQ;
    });

    this.page = 1;
    this.updatePage();
  }

  updatePage() {
    this.totalPages = Math.max(
      1,
      Math.ceil(this.filtered.length / this.pageSize)
    );
    if (this.page > this.totalPages) this.page = this.totalPages;
    if (this.page < 1) this.page = 1;
    const start = (this.page - 1) * this.pageSize;
    this.paged = this.filtered.slice(start, start + this.pageSize);
  }

  nextPage() {
    if (this.page < this.totalPages) {
      this.page++;
      this.updatePage();
    }
  }
  prevPage() {
    if (this.page > 1) {
      this.page--;
      this.updatePage();
    }
  }

  displayParty(r: UnifiedReceiptRow) {
    if (r.mode === 'OUT')
      return r.party?.name || (r.party ? `#${r.party.id}` : '');
    // IN: supplier
    return r.party ? `Supplier #${r.party.id}` : '';
    // later, when Supplier entity exists, show supplier name here
  }
  displayUser(r: UnifiedReceiptRow) {
    return r.user?.name || (r.user ? `#${r.user.id}` : '');
  }

  view(r: UnifiedReceiptRow) {
    if (r.mode === 'OUT') {
      this.router.navigate(['/receipt', r.rawId]);
    } else {
      this.router.navigate(['/restock-receipt', r.rawId]);
    }
  }

  print(r: UnifiedReceiptRow) {
    if (r.mode === 'OUT') {
      window.open(`/receipt/${r.rawId}?autoprint=1`, '_blank');
    } else {
      window.open(`/restock-receipt/${r.rawId}?autoprint=1`, '_blank');
    }
  }

  reset() {
    this.filters = { q: '', mode: '' };
    this.applyFilters();
  }
}
