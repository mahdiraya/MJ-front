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
        path: 'dashboard',
        loadComponent: () =>
          import('./components/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
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
        path: 'customers',
        loadComponent: () =>
          import('./components/customers/customers.component').then(
            (m) => m.CustomersComponent
          ),
      },
      {
        path: 'customers/:id',
        loadComponent: () =>
          import(
            './components/customer-detail/customer-detail.component'
          ).then((m) => m.CustomerDetailComponent),
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
        path: 'returns',
        loadComponent: () =>
          import('./components/returns/returns.component').then(
            (m) => m.ReturnsComponent
          ),
      },
      {
        path: 'stock-in', // create a new restock (goods receipt)
        loadComponent: () =>
          import('./components/stock-in/stock-in.component').then(
            (m) => m.StockInComponent
          ),
      },
      {
        path: 'supplier-debt',
        loadComponent: () =>
          import('./components/supplier-debt/supplier-debt.component').then(
            (m) => m.SupplierDebtComponent
          ),
      },
      {
        path: 'purchase-movements',
        loadComponent: () =>
          import(
            './components/purchase-movements/purchase-movements.component'
          ).then((m) => m.PurchaseMovementsComponent),
      },
      {
        path: 'sales-movements',
        loadComponent: () =>
          import('./components/sales-movements/sales-movements.component').then(
            (m) => m.SalesMovementsComponent
          ),
      },
      {
        path: 'low-stock',
        loadComponent: () =>
          import('./components/low-stock/low-stock.component').then(
            (m) => m.LowStockComponent
          ),
      },
      {
        path: 'cashbox-ledger',
        loadComponent: () =>
          import('./components/cashbox-ledger/cashbox-ledger.component').then(
            (m) => m.CashboxLedgerComponent
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
