import { ApiRequest, ApiResponse, ScriptVariableUpdates, TestResult } from '../../types';
import { scriptExecutor } from '../scripting/scriptExecutor';
import { buildScriptExecutionContext } from '../scripting/scriptContext';

/**
 * Executes post-response test scripts inside the isolated QuickJS WASM sandbox.
 */
export async function executeTestScripts(
  scriptContent: string,
  response: ApiResponse,
  variables: Record<string, string>,
  request?: ApiRequest
): Promise<{
  testResults: TestResult[];
  updatedVariables: Record<string, string>;
  variableUpdates: ScriptVariableUpdates;
}> {
  const updatedVariables: Record<string, string> = { ...variables };

  if (!scriptContent || !scriptContent.trim()) {
    return {
      testResults: [],
      updatedVariables,
      variableUpdates: { environment: {}, collectionVariables: {}, globals: {}, variables: {} },
    };
  }

  const fallbackRequest: ApiRequest = request || {
    id: response.requestId,
    name: 'Request',
    method: (response.method as ApiRequest['method']) || 'GET',
    url: response.url,
    params: [],
    headers: [],
    auth: { type: 'none' },
    bodyType: 'none',
    rawBody: '',
    formData: [],
    urlEncoded: [],
    body: { mode: 'none', rawContent: {}, formData: [], urlEncoded: [], binary: {} },
    scripts: {
      preRequest: { script: '', enabled: false },
      postResponse: { script: scriptContent, enabled: true },
    },
    preRequestScript: '',
    testScript: scriptContent,
    settings: {
      timeout: 10000,
      followRedirects: true,
      maxRedirects: 5,
      autoEncodeUrl: true,
      sslVerification: true,
      allowInsecureCertificates: false,
      httpVersion: 'auto',
      connectionTimeout: 5000,
      keepAlive: true,
      disableCache: false,
      followAuthRedirects: true,
      customUserAgent: 'API Studio/2.0',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const ctx = buildScriptExecutionContext({
    stage: 'post-response',
    request: fallbackRequest,
    response,
    environmentVariables: variables,
  });

  const result = await scriptExecutor.execute(scriptContent, ctx);

  for (const [k, v] of Object.entries(result.variableUpdates.environment)) {
    if (v === null) delete updatedVariables[k];
    else updatedVariables[k] = v;
  }
  for (const [k, v] of Object.entries(result.variableUpdates.variables)) {
    if (v === null) delete updatedVariables[k];
    else updatedVariables[k] = v;
  }

  const testResults: TestResult[] = result.tests.map((t) => ({
    id: t.id,
    name: t.name,
    passed: t.passed,
    status: t.status,
    message: t.error,
    error: t.error,
    expected: t.expected,
    actual: t.actual,
    durationMs: t.durationMs,
    source: 'script',
  }));

  if (result.error) {
    testResults.push({
      id: `script-err-${Date.now()}`,
      name: 'Post-Response Script Execution',
      passed: false,
      status: 'failed',
      message: result.error.message,
      error: result.error.line
        ? `Line ${result.error.line}: ${result.error.message}`
        : result.error.message,
      durationMs: result.durationMs,
      source: 'script',
    });
  }

  return {
    testResults,
    updatedVariables,
    variableUpdates: result.variableUpdates,
  };
}
