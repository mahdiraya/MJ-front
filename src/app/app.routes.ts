import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login/login.component').then(
        (m) => m.LoginComponent
      ),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'items',
        loadComponent: () =>
          import('./components/items-crud/items-crud.component').then(
            (m) => m.ItemsCrudComponent
          ),
      },
      {
        path: 'sell',
        loadComponent: () =>
          import('./components/sell/sell.component').then(
            (m) => m.SellComponent
          ),
      },
      {
        path: 'receipt/:id', // OUT (sales) receipt
        loadComponent: () =>
          import('./components/receipt/receipt.component').then(
            (m) => m.ReceiptComponent
          ),
      },
      {
        path: 'restock-receipt/:id', // ✅ IN (restock) receipt
        loadComponent: () =>
          import('./components/restock-receipt/restock-receipt.component').then(
            (m) => m.RestockReceiptComponent
          ),
      },
      {
        path: 'receipts', // unified history list (OUT + IN)
        loadComponent: () =>
          import(
            './components/receipts-history/receipts-history.component'
          ).then((m) => m.ReceiptsHistoryComponent),
      },
      {
        path: 'stock-in', // create a new restock (goods receipt)
        loadComponent: () =>
          import('./components/stock-in/stock-in.component').then(
            (m) => m.StockInComponent
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'items' },
    ],
  },
  { path: '**', redirectTo: '' },
];
