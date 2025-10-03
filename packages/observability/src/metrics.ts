/**
 * Simple metrics collection
 */

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface CounterMetric extends Metric {
  type: 'counter';
}

export interface GaugeMetric extends Metric {
  type: 'gauge';
}

export interface HistogramMetric extends Metric {
  type: 'histogram';
}

export type AnyMetric = CounterMetric | GaugeMetric | HistogramMetric;

/**
 * Simple in-memory metrics collector
 */
export class MetricsCollector {
  private metrics: AnyMetric[] = [];
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  /**
   * Increment a counter
   */
  increment(name: string, value = 1, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + value);

    this.recordMetric({
      type: 'counter',
      name,
      value: current + value,
      timestamp: new Date(),
      labels,
    });
  }

  /**
   * Set a gauge value
   */
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);

    this.recordMetric({
      type: 'gauge',
      name,
      value,
      timestamp: new Date(),
      labels,
    });
  }

  /**
   * Record a histogram value
   */
  histogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    const values = this.histograms.get(key) ?? [];
    values.push(value);
    this.histograms.set(key, values);

    this.recordMetric({
      type: 'histogram',
      name,
      value,
      timestamp: new Date(),
      labels,
    });
  }

  /**
   * Get counter value
   */
  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.getKey(name, labels);
    return this.counters.get(key) ?? 0;
  }

  /**
   * Get gauge value
   */
  getGauge(name: string, labels?: Record<string, string>): number | undefined {
    const key = this.getKey(name, labels);
    return this.gauges.get(key);
  }

  /**
   * Get histogram statistics
   */
  getHistogramStats(name: string, labels?: Record<string, string>): {
    count: number;
    sum: number;
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  } | undefined {
    const key = this.getKey(name, labels);
    const values = this.histograms.get(key);
    if (!values || values.length === 0) return undefined;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const count = sorted.length;

    return {
      count,
      sum,
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
      mean: sum / count,
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
    };
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(limit?: number): AnyMetric[] {
    const metrics = [...this.metrics].reverse();
    return limit ? metrics.slice(0, limit) : metrics;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = [];
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  private recordMetric(metric: AnyMetric): void {
    this.metrics.push(metric);
    // Keep only last 10000 metrics
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000);
    }
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)]!;
  }
}

/**
 * Default metrics collector
 */
export const defaultMetrics = new MetricsCollector();
