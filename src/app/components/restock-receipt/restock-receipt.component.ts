import { Component, OnInit } from '@angular/core';
import {
  CommonModule,
  DatePipe,
  CurrencyPipe,
  DecimalPipe,
} from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService, RestockReceipt } from '../../services/api.service';

@Component({
  selector: 'app-restock-receipt',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './restock-receipt.component.html',
  styleUrls: ['./restock-receipt.component.css'],
  providers: [DatePipe, CurrencyPipe, DecimalPipe],
})
export class RestockReceiptComponent implements OnInit {
  loading = false;
  error = '';
  data: RestockReceipt | null = null;

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const autoprint = this.route.snapshot.queryParamMap.get('autoprint');

    this.loading = true;
    this.api.getRestockReceipt(id).subscribe({
      next: (d) => {
        // ensure date string exists for pipe
        if (!d.date) (d as any).date = d.created_at;
        this.data = d;
        this.loading = false;
        if (autoprint) {
          setTimeout(() => window.print(), 50);
        }
      },
      error: (e) => {
        this.error = e?.error?.message || 'Failed to load restock receipt';
        this.loading = false;
      },
    });
  }

  lineQty(l: RestockReceipt['items'][number]) {
    return l.mode === 'EACH' ? l.quantity : l.length_m;
  }

  lineUnit(l: RestockReceipt['items'][number]) {
    return l.mode === 'EACH' ? 'pcs' : 'm';
  }
}
