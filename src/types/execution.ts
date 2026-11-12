export type ExecutionStatus =
  | 'idle'
  | 'preparing'
  | 'sending'
  | 'receiving'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export interface TabExecutionState {
  tabId: string;
  requestId: string;
  status: ExecutionStatus;
  executionId: string | null;
  progressMessage?: string;
  startTime?: number;
  abortController?: AbortController;
  error?: string;
}

export type ConsoleLogLevel = 'info' | 'warn' | 'error' | 'success';

export interface ConsoleLogEntry {
  id: string;
  timestamp: number;
  level: ConsoleLogLevel;
  tabId?: string;
  requestId?: string;
  method?: string;
  url?: string;
  title: string;
  message: string;
  details?: string;
  durationMs?: number;
}
