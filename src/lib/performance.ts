/**
 * Performance monitoring utility
 * Tracks frontend performance metrics
 */

export interface PerformanceMetrics {
  wsConnected: boolean;
  wsLatency: number;
  apiLatency: number;
  renderTime: number;
  memoryUsage?: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    wsConnected: false,
    wsLatency: 0,
    apiLatency: 0,
    renderTime: 0,
  };

  private measurements: { [key: string]: number } = {};

  startMeasure(label: string): void {
    this.measurements[label] = performance.now();
  }

  endMeasure(label: string): number {
    const start = this.measurements[label];
    if (!start) return 0;

    const duration = performance.now() - start;
    delete this.measurements[label];
    return duration;
  }

  setWsConnected(connected: boolean): void {
    this.metrics.wsConnected = connected;
  }

  setWsLatency(latency: number): void {
    this.metrics.wsLatency = latency;
  }

  setApiLatency(latency: number): void {
    this.metrics.apiLatency = latency;
  }

  setRenderTime(renderTime: number): void {
    this.metrics.renderTime = renderTime;
  }

  getMetrics(): PerformanceMetrics {
    if (typeof window !== "undefined" && "memory" in performance) {
      (this.metrics as any).memoryUsage = (performance as any).memory.usedJSHeapSize / 1048576; // Convert to MB
    }
    return this.metrics;
  }

  logMetrics(): void {
    const metrics = this.getMetrics();
    console.log(
      `[PERF] WS: ${metrics.wsConnected ? "✓" : "✗"} | WS Latency: ${metrics.wsLatency.toFixed(2)}ms | API Latency: ${metrics.apiLatency.toFixed(2)}ms | Render: ${metrics.renderTime.toFixed(2)}ms`,
      metrics.memoryUsage ? `| Memory: ${metrics.memoryUsage.toFixed(2)}MB` : ""
    );
  }
}

export const performanceMonitor = new PerformanceMonitor();
