import { StepTraceItem } from '../models/PipelineResult';

export class StepTraceCollector {
  private traces: StepTraceItem[] = [];

  log(trace: Omit<StepTraceItem, 'timestamp'>): void {
    this.traces.push({
      ...trace,
      timestamp: Date.now(),
    });
  }

  getTraces(): StepTraceItem[] {
    return [...this.traces];
  }

  clear(): void {
    this.traces = [];
  }
}
