import { HttpMethod } from './request';
import { RunnerRequestExecutionResult } from './runner';

export interface ReportSummaryMetrics {
  totalRequests: number;
  passedRequests: number;
  failedRequests: number;
  totalAssertions: number;
  passedAssertions: number;
  failedAssertions: number;
  skippedAssertions: number;
  passRate: number;
  averageResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  totalDurationMs: number;
  iterations: number;
}

export interface StatusCodeDistributionItem {
  bucket: string; // e.g. '2xx', '4xx', '5xx', 'Error'
  count: number;
}

export interface RequestPerformanceItem {
  name: string;
  method: HttpMethod;
  responseTimeMs: number;
  status: number;
  passed: boolean;
  iteration: number;
}

export interface TestReport {
  id: string;
  name: string;
  sourceType: 'collection' | 'suite' | 'folder' | 'custom';
  sourceId?: string;
  sourceName: string;
  environmentId: string | null;
  environmentName: string;
  status: 'passed' | 'failed' | 'stopped';
  startedAt: number;
  finishedAt: number;
  summary: ReportSummaryMetrics;
  statusDistribution: StatusCodeDistributionItem[];
  results: RunnerRequestExecutionResult[];
  createdAt: number;
}
