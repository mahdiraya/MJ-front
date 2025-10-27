import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import {
  ApiService,
  LowStockItem,
  LowStockParams,
} from '../../services/api.service';

@Component({
  selector: 'app-low-stock',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './low-stock.component.html',
  styleUrls: ['./low-stock.component.css'],
})
export class LowStockComponent implements OnInit {
  loading = false;
  error = '';
  items: LowStockItem[] = [];

  filters: LowStockParams = {
    eachThreshold: 5,
    meterThreshold: 10,
  };

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
    const params: LowStockParams = {
      eachThreshold: this.filters.eachThreshold,
      meterThreshold: this.filters.meterThreshold,
    };
    this.loading = true;
    this.error = '';
    this.api.getLowStockItems(params).subscribe({
      next: (items) => {
        this.items = items || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load low stock items', err);
        this.error =
          err?.error?.message || err?.message || 'Failed to load low stock.';
        this.loading = false;
      },
    });
  }

  resetFilters() {
    this.filters = {
      eachThreshold: 5,
      meterThreshold: 10,
    };
    this.load();
  }

  formatStock(item: LowStockItem) {
    return item.stockUnit === 'm'
      ? item.stock.toFixed(3) + ' m'
      : item.stock.toFixed(0);
  }
}
