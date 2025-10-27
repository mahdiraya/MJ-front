import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart, { ChartConfiguration } from 'chart.js/auto';

import { ApiService, StatsOverview } from '../../services/api.service';

const CURRENCY_FORMAT = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  loading = false;
  error = '';
  stats: StatsOverview | null = null;

  private salesChartCanvas?: ElementRef<HTMLCanvasElement>;
  private netCashChartCanvas?: ElementRef<HTMLCanvasElement>;
  private cashboxChartCanvas?: ElementRef<HTMLCanvasElement>;

  @ViewChild('salesChartCanvas')
  set salesChartCanvasRef(
    value: ElementRef<HTMLCanvasElement> | undefined,
  ) {
    this.salesChartCanvas = value;
    this.scheduleRenderCharts();
  }

  @ViewChild('netCashChartCanvas')
  set netCashChartCanvasRef(
    value: ElementRef<HTMLCanvasElement> | undefined,
  ) {
    this.netCashChartCanvas = value;
    this.scheduleRenderCharts();
  }

  @ViewChild('cashboxChartCanvas')
  set cashboxChartCanvasRef(
    value: ElementRef<HTMLCanvasElement> | undefined,
  ) {
    this.cashboxChartCanvas = value;
    this.scheduleRenderCharts();
  }

  private salesChart?: Chart;
  private netCashChart?: Chart;
  private cashboxChart?: Chart;
  private renderTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  ngAfterViewInit(): void {
    if (this.stats) {
      this.scheduleRenderCharts();
    }
  }

  ngOnDestroy(): void {
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
      this.renderTimeout = null;
    }
    this.destroyCharts();
  }

  load() {
    this.loading = true;
    this.error = '';
    this.api.getStatsOverview().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
        this.scheduleRenderCharts();
      },
      error: (err) => {
        console.error('Failed to load stats overview', err);
        this.error = err?.error?.message || 'Failed to load stats overview';
        this.loading = false;
      },
    });
  }

  supplierLabel(id: number | null) {
    if (id == null) return 'Unassigned supplier';
    return `Supplier #${id}`;
  }

  trackCashbox(_index: number, item: StatsOverview['cashboxes'][number]) {
    return item.id;
  }

  trackDaily(_index: number, item: { date: string }) {
    return item.date;
  }

  get hasSalesData() {
    return !!this.stats?.sales.daily.length;
  }

  get hasNetCashData() {
    return !!this.stats?.netCashDaily.length;
  }

  get hasCashboxData() {
    return !!this.stats?.cashboxes.length;
  }

  private scheduleRenderCharts() {
    if (!this.stats) return;
    if (
      !this.salesChartCanvas &&
      !this.netCashChartCanvas &&
      !this.cashboxChartCanvas
    ) {
      return;
    }
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }
    this.renderTimeout = setTimeout(() => {
      this.renderTimeout = null;
      this.renderCharts();
    });
  }

  private renderCharts() {
    if (!this.stats) return;

    this.destroyCharts();

    if (this.salesChartCanvas && this.stats.sales.daily.length) {
      this.salesChart = new Chart(
        this.salesChartCanvas.nativeElement,
        this.buildSalesChartConfig(),
      );
    }

    if (this.netCashChartCanvas && this.stats.netCashDaily.length) {
      this.netCashChart = new Chart(
        this.netCashChartCanvas.nativeElement,
        this.buildNetCashChartConfig(),
      );
    }

    if (this.cashboxChartCanvas && this.stats.cashboxes.length) {
      this.cashboxChart = new Chart(
        this.cashboxChartCanvas.nativeElement,
        this.buildCashboxChartConfig(),
      );
    }
  }

  private destroyCharts() {
    this.salesChart?.destroy();
    this.salesChart = undefined;
    this.netCashChart?.destroy();
    this.netCashChart = undefined;
    this.cashboxChart?.destroy();
    this.cashboxChart = undefined;
  }

  private buildSalesChartConfig(): ChartConfiguration<'line'> {
    const labels = this.stats!.sales.daily.map((d) =>
      this.formatDateLabel(d.date),
    );
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Sales',
            data: this.stats!.sales.daily.map((d) => +d.total.toFixed(2)),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.25)',
            fill: true,
            tension: 0.25,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: 'Restocks',
            data: this.stats!.restocks.daily.map((d) => +d.total.toFixed(2)),
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.25)',
            fill: true,
            tension: 0.25,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ${CURRENCY_FORMAT.format(
                  ctx.parsed.y,
                )}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => CURRENCY_FORMAT.format(Number(value)),
            },
          },
        },
      },
    };
  }

  private buildNetCashChartConfig(): ChartConfiguration<'bar'> {
    const labels = this.stats!.netCashDaily.map((d) =>
      this.formatDateLabel(d.date),
    );
    const data = this.stats!.netCashDaily.map((d) => +d.total.toFixed(2));

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Net cash',
            data,
            backgroundColor: data.map((value) =>
              value >= 0 ? 'rgba(34, 197, 94, 0.75)' : 'rgba(239, 68, 68, 0.75)',
            ),
            borderColor: data.map((value) =>
              value >= 0 ? '#22c55e' : '#ef4444',
            ),
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `Net: ${CURRENCY_FORMAT.format(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => CURRENCY_FORMAT.format(Number(value)),
            },
          },
        },
      },
    };
  }

  private buildCashboxChartConfig(): ChartConfiguration<'doughnut'> {
    const labels = this.stats!.cashboxes.map(
      (c) => `${c.code} - ${c.label}`,
    );
    const data = this.stats!.cashboxes.map((c) => +c.balance.toFixed(2));

    return {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: [
              '#2563eb',
              '#f97316',
              '#22c55e',
              '#9333ea',
              '#ef4444',
              '#0ea5e9',
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
          },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.label || ''}: ${CURRENCY_FORMAT.format(ctx.parsed)}`,
            },
          },
        },
      },
    };
  }

  private formatDateLabel(value: string | Date) {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  }
}


