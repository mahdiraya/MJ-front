import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';
import type { ChartConfiguration, Plugin } from 'chart.js';

import { ApiService, StatsOverview } from '../../services/api.service';

const CURRENCY_FORMAT = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const cashboxGlowPlugin: Plugin<'doughnut'> = {
  id: 'cashboxGlow',
  afterDatasetsDraw(chart, _args, rawOptions) {
    const options = (rawOptions ?? {}) as {
      phaseProvider?: () => number;
      datasetIndices?: number[];
      color?: string;
      lineWidth?: number;
      blurBase?: number;
      blurRange?: number;
      glowSpread?: number;
      innerScale?: number;
    };
    const phase =
      typeof options.phaseProvider === 'function' ? options.phaseProvider() : 0;
    const datasetIndices = options.datasetIndices ?? [0];
    const color = options.color ?? 'rgba(239, 68, 68, 0.75)';
    const lineWidth = options.lineWidth ?? 6;
    const blurBase = options.blurBase ?? 12;
    const blurRange = options.blurRange ?? 6;
    const glowSpread = options.glowSpread ?? 24;
    const innerScale = options.innerScale ?? 0.65;

    const ctx = chart.ctx;
    datasetIndices.forEach((datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.type !== 'doughnut') return;
      const dataValues = chart.data.datasets?.[datasetIndex]?.data ?? [];
      meta.data.forEach((arc, idx) => {
        const raw = Number((dataValues as any)[idx] ?? 0);
        if (!Number.isFinite(raw) || raw >= 0) return;
        const wave = Math.sin(phase + idx * 0.4);
        const normalized = (wave + 1) / 2;
        const {
          startAngle,
          endAngle,
          innerRadius,
          outerRadius,
          x,
          y,
        } = arc.getProps(
          ['startAngle', 'endAngle', 'innerRadius', 'outerRadius', 'x', 'y'],
          true
        ) as any;

        const effectiveInner = Number.isFinite(innerRadius)
          ? innerRadius
          : outerRadius * 0.55;
        const scaledInner = Math.max(effectiveInner * innerScale, 0.5);
        const auraInnerAlpha = 0.12 + normalized * 0.2;
        const auraOuterAlpha = 0.3 + normalized * 0.35;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gradient = ctx.createRadialGradient(
          x,
          y,
          Math.max(scaledInner * 0.92, 0.5),
          x,
          y,
          outerRadius + glowSpread
        );
        gradient.addColorStop(0, 'rgba(249, 115, 22, 0)');
        gradient.addColorStop(
          0.45,
          `rgba(249, 115, 22, ${auraInnerAlpha.toFixed(3)})`
        );
        gradient.addColorStop(
          0.78,
          `rgba(239, 68, 68, ${auraOuterAlpha.toFixed(3)})`
        );
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, outerRadius + glowSpread, startAngle, endAngle);
        ctx.arc(x, y, scaledInner, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = 0.75 + normalized * 0.25;
        ctx.shadowColor = color;
        ctx.shadowBlur = blurBase + blurRange * wave;
        ctx.beginPath();
        ctx.arc(x, y, outerRadius + glowSpread * 0.15, startAngle, endAngle);
        ctx.stroke();
        ctx.restore();
      });
    });
  },
};

Chart.register(cashboxGlowPlugin);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  loading = false;
  error = '';
  stats: StatsOverview | null = null;
  flowMode: 'cash' | 'booked' = 'cash';
  profitMode: 'weekly' | 'monthly' | 'yearly' = 'weekly';

  private profitChartCanvas?: ElementRef<HTMLCanvasElement>;
  private flowChartCanvas?: ElementRef<HTMLCanvasElement>;
  private cashboxChartCanvas?: ElementRef<HTMLCanvasElement>;

  @ViewChild('profitChartCanvas')
  set profitChartCanvasRef(value: ElementRef<HTMLCanvasElement> | undefined) {
    this.profitChartCanvas = value;
    this.scheduleRenderCharts();
  }

  @ViewChild('flowChartCanvas')
  set flowChartCanvasRef(value: ElementRef<HTMLCanvasElement> | undefined) {
    this.flowChartCanvas = value;
    this.scheduleRenderCharts();
  }

  @ViewChild('cashboxChartCanvas')
  set cashboxChartCanvasRef(value: ElementRef<HTMLCanvasElement> | undefined) {
    this.cashboxChartCanvas = value;
    this.scheduleRenderCharts();
  }

  private profitChart?: Chart;
  private flowChart?: Chart;
  private cashboxChart?: Chart;
  private renderTimeout: ReturnType<typeof setTimeout> | null = null;
  private glowPhase = 0;
  private glowAnimationFrame: number | null = null;

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

  get hasProfitData() {
    return this.getProfitSeriesForMode().length > 0;
  }

  get hasFlowData() {
    const series = this.getFlowSeriesForMode();
    return series.some((point) => point.in !== 0 || point.out !== 0);
  }

  get hasCashboxData() {
    return !!this.stats?.cashboxes.length;
  }

  setFlowMode(mode: 'cash' | 'booked') {
    if (this.flowMode === mode) return;
    this.flowMode = mode;
    this.scheduleRenderCharts();
  }

  setProfitMode(mode: 'weekly' | 'monthly' | 'yearly') {
    if (this.profitMode === mode) return;
    this.profitMode = mode;
    this.scheduleRenderCharts();
  }

  private scheduleRenderCharts() {
    if (!this.stats) return;
    if (
      !this.profitChartCanvas &&
      !this.flowChartCanvas &&
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

    if (this.profitChartCanvas && this.hasProfitData) {
      this.profitChart = new Chart(
        this.profitChartCanvas.nativeElement,
        this.buildProfitChartConfig()
      );
    }

    if (this.flowChartCanvas && this.hasFlowData) {
      this.flowChart = new Chart(
        this.flowChartCanvas.nativeElement,
        this.buildFlowChartConfig()
      );
    }

    if (this.cashboxChartCanvas && this.stats.cashboxes.length) {
      this.cashboxChart = new Chart(
        this.cashboxChartCanvas.nativeElement,
        this.buildCashboxChartConfig()
      );
      if (this.stats.cashboxes.some((c) => c.balance < 0)) {
        this.startGlowAnimation();
      } else {
        this.stopGlowAnimation();
      }
    } else {
      this.stopGlowAnimation();
    }
  }

  private destroyCharts() {
    this.stopGlowAnimation();
    this.profitChart?.destroy();
    this.profitChart = undefined;
    this.flowChart?.destroy();
    this.flowChart = undefined;
    this.cashboxChart?.destroy();
    this.cashboxChart = undefined;
  }

  private buildProfitChartConfig(): ChartConfiguration<'line'> {
    const series = this.getProfitSeriesForMode();
    if (!series.length) {
      return { type: 'line', data: { labels: [], datasets: [] } };
    }

    const labels = series.map((point) => {
      if (point.type === 'period') {
        return this.formatPeriodLabel(point.key);
      }
      if (this.profitMode === 'weekly') {
        return this.formatWeeklyLabel(point.key);
      }
      return this.formatMonthlyLabel(point.key);
    });
    const data = series.map((point) => +point.total.toFixed(2));

    const datasetLabel =
      this.profitMode === 'yearly' ? 'Monthly profit' : 'Daily profit';

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: datasetLabel,
            data,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.2)',
            fill: true,
            tension: 0.25,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: this.sharedLineOptions(),
    };
  }

  private sharedLineOptions(): ChartConfiguration<'line'>['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${CURRENCY_FORMAT.format(ctx.parsed.y)}`,
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
    };
  }

  private buildFlowChartConfig(): ChartConfiguration<'bar'> {
    const series = this.getFlowSeriesForMode();
    if (!series.length) {
      return { type: 'bar', data: { labels: [], datasets: [] } };
    }

    const isCash = this.flowMode === 'cash';
    const labels = series.map((point) => {
      if (point.type === 'period') {
        return this.formatPeriodLabel(point.key);
      }
      if (this.profitMode === 'weekly') {
        return this.formatWeeklyLabel(point.key);
      }
      return this.formatMonthlyLabel(point.key);
    });

    const inflow = series.map((point) => +point.in.toFixed(2));
    const outflow = series.map(
      (point) => -Math.abs(+point.out.toFixed(2)),
    );

    const inLabel = isCash ? 'Cash in' : 'Booked in';
    const outLabel = isCash ? 'Cash out' : 'Booked out';

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: inLabel,
            data: inflow,
            backgroundColor: 'rgba(34, 197, 94, 0.75)',
            borderColor: '#22c55e',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: outLabel,
            data: outflow,
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 4,
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
                  Math.abs(ctx.parsed.y),
                )}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => CURRENCY_FORMAT.format(Math.abs(Number(value))),
            },
          },
        },
      },
    };
  }

  private getProfitSeriesForMode(): Array<{
    key: string;
    total: number;
    type: 'date' | 'period';
  }> {
    if (!this.stats) return [];
    switch (this.profitMode) {
      case 'weekly':
        return this.stats.profitSeries.weekly.map((point) => ({
          key: point.date,
          total: point.total,
          type: 'date' as const,
        }));
      case 'monthly':
        return this.stats.profitSeries.monthly.map((point) => ({
          key: point.date,
          total: point.total,
          type: 'date' as const,
        }));
      case 'yearly':
        return this.stats.profitSeries.yearly.map((point) => ({
          key: point.period,
          total: point.total,
          type: 'period' as const,
        }));
      default:
        return [];
    }
  }

  private getFlowSeriesForMode(): Array<{
    key: string;
    in: number;
    out: number;
    type: 'date' | 'period';
  }> {
    if (!this.stats) return [];
    const source =
      this.flowMode === 'cash'
        ? this.stats.cashFlowSeries
        : this.stats.bookedFlowSeries;
    if (!source) return [];

    switch (this.profitMode) {
      case 'weekly':
        return source.weekly.map((point) => ({
          key: point.date,
          in: point.in,
          out: point.out,
          type: 'date' as const,
        }));
      case 'monthly':
        return source.monthly.map((point) => ({
          key: point.date,
          in: point.in,
          out: point.out,
          type: 'date' as const,
        }));
      case 'yearly':
        return source.yearly.map((point) => ({
          key: point.period,
          in: point.in,
          out: point.out,
          type: 'period' as const,
        }));
      default:
        return [];
    }
  }

  private startGlowAnimation() {
    this.stopGlowAnimation();
    if (!this.cashboxChart) return;
    const hasNegative = this.cashboxChart.data.datasets?.some((dataset) =>
      (dataset.data ?? []).some((value) => Number(value) < 0)
    );
    if (!hasNegative) return;

    const animate = () => {
      this.glowPhase += 0.08;
      if (this.glowPhase > Math.PI * 2) {
        this.glowPhase -= Math.PI * 2;
      }
      this.cashboxChart?.update('none');
      this.glowAnimationFrame = requestAnimationFrame(animate);
    };

    this.glowAnimationFrame = requestAnimationFrame(animate);
  }

  private stopGlowAnimation() {
    if (this.glowAnimationFrame != null) {
      cancelAnimationFrame(this.glowAnimationFrame);
      this.glowAnimationFrame = null;
    }
  }

  private formatWeeklyLabel(dateStr: string) {
    return new Intl.DateTimeFormat('en', {
      weekday: 'short',
      day: 'numeric',
    }).format(new Date(dateStr));
  }

  private formatMonthlyLabel(dateStr: string) {
    return new Intl.DateTimeFormat('en', {
      day: 'numeric',
    }).format(new Date(dateStr));
  }

  private formatPeriodLabel(period: string) {
    const [year, month] = period.split('-').map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return period;
    }
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      year: 'numeric',
    }).format(new Date(year!, (month || 1) - 1, 1));
  }

  private buildCashboxChartConfig(): ChartConfiguration<'doughnut'> {
    if (!this.stats) {
      return { type: 'doughnut', data: { labels: [], datasets: [] } };
    }
    const labels = this.stats.cashboxes.map((c) => `${c.code} - ${c.label}`);
    const data = this.stats.cashboxes.map((c) => +c.balance.toFixed(2));
    const fillPalette = [
      '#2563eb',
      '#22c55e',
      '#0ea5e9',
      '#9333ea',
      '#38bdf8',
      '#14b8a6',
      '#f59e0b',
      '#ec4899',
    ];
    const strokePalette = [
      '#1d4ed8',
      '#15803d',
      '#0369a1',
      '#7c3aed',
      '#0891b2',
      '#0d9488',
      '#d97706',
      '#db2777',
    ];
    const hoverPalette = [
      '#3b82f6',
      '#16a34a',
      '#0284c7',
      '#a855f7',
      '#22d3ee',
      '#2dd4bf',
      '#f97316',
      '#f472b6',
    ];
    const backgroundColor = data.map((value, idx) =>
      value < 0 ? 'rgba(248, 113, 113, 0.9)' : fillPalette[idx % fillPalette.length]
    );
    const borderColor = data.map((value, idx) =>
      value < 0 ? '#b91c1c' : strokePalette[idx % strokePalette.length]
    );
    const hoverBackgroundColor = data.map((value, idx) =>
      value < 0 ? 'rgba(239, 68, 68, 0.95)' : hoverPalette[idx % hoverPalette.length]
    );
    const hoverBorderColor = data.map((value, idx) =>
      value < 0 ? '#dc2626' : strokePalette[idx % strokePalette.length]
    );

    return {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor,
            borderColor,
            hoverBackgroundColor,
            hoverBorderColor,
            borderAlign: 'inner',
            borderWidth: data.map((value) => (value < 0 ? 2 : 1)),
            offset: data.map((value) => (value < 0 ? 18 : 0)),
            hoverOffset: data.map((value) => (value < 0 ? 26 : 10)),
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
          cashboxGlow: {
            phaseProvider: () => this.glowPhase,
            datasetIndices: [0],
            color: 'rgba(239, 68, 68, 0.85)',
            lineWidth: 9,
            blurBase: 18,
            blurRange: 8,
            glowSpread: 28,
            innerScale: 0.6,
          } as any,
        },
      } as ChartConfiguration<'doughnut'>['options'],
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
