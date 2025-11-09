import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  ApiService,
  CustomerSalesSummary,
} from '../../services/api.service';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.css'],
})
export class CustomersComponent implements OnInit {
  loading = false;
  error = '';
  customers: CustomerSalesSummary[] = [];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.getCustomersWithSales().subscribe({
      next: (customers) => {
        this.customers = customers ?? [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load customers', err);
        this.error = err?.error?.message || 'Failed to load customers';
        this.loading = false;
      },
    });
  }

  trackById(_index: number, customer: CustomerSalesSummary) {
    return customer.id;
  }
}
