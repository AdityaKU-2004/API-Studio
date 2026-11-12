import { ApiResponse, TestResult } from '../../types';

/**
 * Executes post-response test scripts in a safe context and returns test results.
 */
export function executeTestScripts(
  scriptContent: string,
  response: ApiResponse,
  variables: Record<string, string>
): { testResults: TestResult[]; updatedVariables: Record<string, string> } {
  const testResults: TestResult[] = [];
  const updatedVariables: Record<string, string> = { ...variables };

  if (!scriptContent || !scriptContent.trim()) {
    return { testResults, updatedVariables };
  }

  try {
    // Postman-compatible pm sandbox API
    const pm = {
      test: (name: string, fn: () => void) => {
        try {
          fn();
          testResults.push({ name, passed: true });
        } catch (err) {
          testResults.push({
            name,
            passed: false,
            message: (err as Error).message || String(err),
          });
        }
      },
      expect: (actual: unknown) => ({
        to: {
          equal: (expected: unknown) => {
            if (actual !== expected) {
              throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
            }
          },
          be: {
            oneOf: (expectedList: unknown[]) => {
              if (!expectedList.includes(actual)) {
                throw new Error(`Expected ${JSON.stringify(actual)} to be one of ${JSON.stringify(expectedList)}`);
              }
            },
            true: () => {
              if (actual !== true) throw new Error(`Expected ${JSON.stringify(actual)} to be true`);
            },
            below: (num: number) => {
              if (typeof actual !== 'number' || actual >= num) {
                throw new Error(`Expected ${actual} to be below ${num}`);
              }
            },
          },
        },
      }),
      response: {
        code: response.status,
        status: response.statusText,
        responseTime: response.timeMs,
        headers: response.headers,
        text: () => response.body,
        json: () => {
          if (response.parsedBody) return response.parsedBody;
          return JSON.parse(response.body);
        },
        to: {
          have: {
            status: (expectedCode: number) => {
              if (response.status !== expectedCode) {
                throw new Error(
                  `Expected response status ${expectedCode} but received ${response.status} ${response.statusText}`
                );
              }
            },
            header: (headerName: string) => {
              const lower = headerName.toLowerCase();
              const found = Object.keys(response.headers).some((k) => k.toLowerCase() === lower);
              if (!found) {
                throw new Error(`Expected response to have header "${headerName}"`);
              }
            },
          },
        },
      },
      environment: {
        set: (key: string, value: unknown) => {
          updatedVariables[key] = String(value);
        },
        get: (key: string) => updatedVariables[key],
      },
      variables: {
        set: (key: string, value: unknown) => {
          updatedVariables[key] = String(value);
        },
        get: (key: string) => updatedVariables[key],
      },
    };

    // Execute within Function sandbox
    const scriptRunner = new Function('pm', scriptContent);
    scriptRunner(pm);
  } catch (globalErr) {
    testResults.push({
      name: 'Script Execution',
      passed: false,
      message: `Script error: ${(globalErr as Error).message}`,
    });
  }

  return { testResults, updatedVariables };
}
