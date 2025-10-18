import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-receipt',
  standalone: true,
  imports: [CommonModule],
  providers: [CurrencyPipe, DatePipe],
  templateUrl: './receipt.component.html',
  styleUrls: ['./receipt.component.css'],
})
export class ReceiptComponent implements OnInit {
  @ViewChild('printArea') printArea!: ElementRef<HTMLDivElement>;

  tx: any | null = null;
  loading = false;
  error = '';
  currencyCode: string = 'USD';

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = Number(idParam);
    if (!id) {
      this.error = 'Invalid receipt id';
      return;
    }
    this.loading = true;
    this.api.getTransactionReceipt(id).subscribe({
      next: (data) => {
        this.tx = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load receipt', err);
        this.error = err?.error?.message || 'Failed to load receipt';
        this.loading = false;
      },
    });
  }

  lineTotal(it: any): number {
    const p = Number(it.price_each) || 0;
    // For METER lines, quantity is 1 and length_m is the cut length
    if (it.mode === 'METER' && it.length_m != null) {
      return p * Number(it.length_m || 0);
    }
    return p * (Number(it.quantity) || 0);
  }

  total(): number {
    if (!this.tx?.transactionItems) return 0;
    return this.tx.transactionItems.reduce(
      (s: number, it: any) => s + this.lineTotal(it),
      0
    );
  }

  private buildPrintHtml(receiptHTML: string): string {
    const baseCss = `
      .receipt-page { display: grid; place-items: start center; padding: 0; background: #fff; }
      .ticket { width: 80mm; background: #fff; color: #111;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 12px; line-height: 1.35; border: none; border-radius: 0; padding: 10px 10px 12px;
      }
      .header .brand { display: flex; align-items: center; gap: 8px; }
      .logo { width: 28px; height: 28px; border-radius: 6px; display: grid; place-items: center; background: #eef2ff; }
      .brand-text h2 { margin: 0; font-size: 14px; }
      .brand-text small { color: #64748b; }
      .meta { display: grid; grid-template-columns: 1fr; gap: 2px; }
      .meta strong { font-weight: 700; }
      .meta div { display: flex; justify-content: space-between; }
      hr { border: 0; border-top: 1px dashed #cbd5e1; margin: 8px 0; }
      .lines { width: 100%; border-collapse: collapse; }
      .lines th, .lines td { padding: 4px 0; }
      .left { text-align: left; } .center { text-align: center; } .right { text-align: right; }
      .totals { display: grid; gap: 4px; margin-top: 6px; }
      .totals > div { display: flex; justify-content: space-between; }
      .totals .grand { font-weight: 800; border-top: 1px dashed #cbd5e1; padding-top: 4px; }
      .foot { text-align: center; margin-top: 8px; }
      .foot p { margin: 2px 0; }
    `;

    const printCss = `
      @page { size: 80mm auto; margin: 0; }
      html, body {
        padding: 0; margin: 0; width: 80mm; background: #fff;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      .receipt-print { width: 80mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
      .ticket { width: 80mm !important; box-shadow: none !important; border-radius: 0 !important; border: none !important; margin: 0 !important; }
      .ticket, .ticket .lines, .ticket .lines tr, .ticket .lines td, .ticket .lines th { page-break-inside: avoid; }
    `;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${baseCss}</style>
  <style>${printCss}</style>
</head>
<body>
  ${receiptHTML}
</body>
</html>`;
  }

  print() {
    if (!this.printArea?.nativeElement) return;

    const receiptHTML = this.printArea.nativeElement.outerHTML;
    const fullHtml = this.buildPrintHtml(receiptHTML);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.visibility = 'hidden';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    let printed = false;
    const doPrint = () => {
      if (printed) return;
      printed = true;
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
        }, 500);
      }
    };

    doc.open();
    doc.write(fullHtml);
    doc.close();

    const anyDoc = doc as any;
    if (anyDoc.fonts && anyDoc.fonts.ready) {
      anyDoc.fonts.ready.then(doPrint).catch(doPrint);
    } else {
      iframe.onload = doPrint;
      setTimeout(doPrint, 150);
    }
  }

  back() {
    this.router.navigate(['/sell']);
  }
}
