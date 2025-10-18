import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-items-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2>Items</h2>
    <ul>
      <li *ngFor="let item of items">
        {{ item.name }} (Stock: {{ item.stock }})
      </li>
    </ul>
  `,
})
export class ItemsListComponent implements OnInit {
  items: any[] = [];

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getItems().subscribe((data) => {
      console.log('Data received:', data);
      this.items = data;
    });
  }
}
