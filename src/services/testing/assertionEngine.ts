import { ApiResponse, AssertionResult, AssertionRule } from '../../types';
import { evaluateAssertionRule } from './assertionEvaluator';

export interface AssertionEngineSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  allPassed: boolean;
  results: AssertionResult[];
}

export class AssertionEngine {
  /**
   * Evaluates an ordered list of assertions against an HTTP response.
   */
  public evaluate(rules: AssertionRule[], response: ApiResponse): AssertionEngineSummary {
    const ordered = [...(rules || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const results = ordered.map((rule) => evaluateAssertionRule(rule, response));

    const passed = results.filter((r) => r.status === 'passed').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;

    return {
      total: results.length,
      passed,
      failed,
      skipped,
      allPassed: failed === 0,
      results,
    };
  }
}

export const assertionEngine = new AssertionEngine();
