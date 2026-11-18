import Ajv from 'ajv';
import { ApiResponse, SchemaValidationError, SchemaValidationResult } from '../../types';

const ajvInstance = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false,
});

export class SchemaValidator {
  /**
   * Validates a JSON Schema string syntax before saving or executing.
   */
  public parseSchema(schemaText: string): {
    valid: boolean;
    schema?: Record<string, unknown>;
    error?: string;
  } {
    if (!schemaText || !schemaText.trim()) {
      return { valid: false, error: 'JSON Schema cannot be empty.' };
    }

    try {
      const parsed = JSON.parse(schemaText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { valid: false, error: 'JSON Schema must be a valid JSON object.' };
      }
      // Compile to catch invalid schema keywords early
      ajvInstance.compile(parsed);
      return { valid: true, schema: parsed as Record<string, unknown> };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : 'Invalid JSON Schema syntax',
      };
    }
  }

  /**
   * Validates an API response body against a JSON Schema string or object using Ajv.
   */
  public validateResponse(
    response: ApiResponse,
    schemaInput: string | Record<string, unknown>,
    schemaName?: string
  ): SchemaValidationResult {
    const start = performance.now();

    let schemaObj: Record<string, unknown>;
    if (typeof schemaInput === 'string') {
      const parsedSchema = this.parseSchema(schemaInput);
      if (!parsedSchema.valid || !parsedSchema.schema) {
        return {
          valid: false,
          schemaName,
          errorCount: 1,
          schemaSyntaxError: parsedSchema.error,
          errors: [
            {
              path: '$schema',
              keyword: 'schema',
              message: parsedSchema.error || 'Invalid JSON Schema',
            },
          ],
          durationMs: Math.round((performance.now() - start) * 100) / 100,
        };
      }
      schemaObj = parsedSchema.schema;
    } else {
      schemaObj = schemaInput;
    }

    // Parse response payload
    let payload: unknown;
    if (response.parsedBody !== undefined) {
      payload = response.parsedBody;
    } else {
      try {
        payload = JSON.parse(response.body || '');
      } catch {
        return {
          valid: false,
          schemaName,
          errorCount: 1,
          errors: [
            {
              path: '$',
              keyword: 'parse',
              message: 'Response body is not valid JSON and cannot be validated against a JSON Schema.',
            },
          ],
          durationMs: Math.round((performance.now() - start) * 100) / 100,
        };
      }
    }

    try {
      const validate = ajvInstance.compile(schemaObj);
      const valid = Boolean(validate(payload));

      if (valid) {
        return {
          valid: true,
          schemaName,
          errorCount: 0,
          errors: [],
          durationMs: Math.round((performance.now() - start) * 100) / 100,
        };
      }

      const errors: SchemaValidationError[] = (validate.errors || []).map((err) => {
        const instancePath = err.instancePath ? `$${err.instancePath.replace(/\//g, '.')}` : '$';
        return {
          path: instancePath,
          keyword: err.keyword,
          message: err.message || 'Schema validation failed',
          params: err.params as Record<string, unknown>,
        };
      });

      return {
        valid: false,
        schemaName,
        errorCount: errors.length,
        errors,
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      };
    } catch (err) {
      return {
        valid: false,
        schemaName,
        errorCount: 1,
        schemaSyntaxError: err instanceof Error ? err.message : String(err),
        errors: [
          {
            path: '$schema',
            keyword: 'compile',
            message: err instanceof Error ? err.message : 'Schema compilation failed',
          },
        ],
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      };
    }
  }
}

export const schemaValidator = new SchemaValidator();
