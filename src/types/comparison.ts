export type ComparisonDifferenceType = 'added' | 'removed' | 'modified' | 'type_changed';

export interface JsonDiffEntry {
  path: string;
  type: ComparisonDifferenceType;
  leftValue?: unknown;
  rightValue?: unknown;
  leftType?: string;
  rightType?: string;
}

export interface TextDiffLine {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
  lineNumberLeft?: number;
  lineNumberRight?: number;
}

export type HeaderDiffStatus = 'identical' | 'only_left' | 'only_right' | 'modified';

export interface HeaderDiffEntry {
  key: string;
  status: HeaderDiffStatus;
  leftValue?: string;
  rightValue?: string;
  isSensitive: boolean;
}

export interface ComparisonSource {
  label: string;
  sourceType: 'history' | 'manual';
  historyId?: string;
  method?: string;
  url?: string;
  status?: number;
  statusText?: string;
  timeMs?: number;
  headers: Record<string, string>;
  body: string;
}

export interface ComparisonSummary {
  totalDifferences: number;
  additions: number;
  removals: number;
  modifications: number;
  typeChanges: number;
  headerDifferences: number;
  statusMatch: boolean;
  timeDeltaMs: number | null;
  sensitiveHeadersDetected: string[];
}

export interface ComparisonResult {
  isJsonComparable: boolean;
  jsonDiffs: JsonDiffEntry[];
  textDiffLines: TextDiffLine[];
  headerDiffs: HeaderDiffEntry[];
  summary: ComparisonSummary;
  warnings: string[];
}

export interface ComparisonSession {
  id: string;
  name: string;
  left: ComparisonSource;
  right: ComparisonSource;
  maskSensitiveHeaders: boolean;
  createdAt: number;
  updatedAt: number;
}
