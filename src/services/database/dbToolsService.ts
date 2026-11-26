import {
  DatabaseConnectionProfile,
  DatabaseSchemaSnapshot,
  SqlQueryResult,
} from '../../types';
import { isTauriRuntime } from '../runtime/capabilities';
import { invokeDesktop } from '../desktop/tauriBridge';
import { desktopSecurityService } from '../desktop/securityService';

export function isReadOnlySql(sql: string): boolean {
  const cleaned = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
  const firstWord = cleaned.split(/\s+/)[0]?.toUpperCase() || '';
  return ['SELECT', 'WITH', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'PRAGMA'].includes(
    firstWord
  );
}

export function isDestructiveSql(sql: string): boolean {
  const cleaned = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim()
    .toUpperCase();
  if (/^(DROP|TRUNCATE|ALTER)\b/.test(cleaned)) return true;
  if (/^DELETE\b/.test(cleaned) && !/\bWHERE\b/.test(cleaned)) return true;
  if (/^UPDATE\b/.test(cleaned) && !/\bWHERE\b/.test(cleaned)) return true;
  return false;
}

export function formatSqlKeywords(sql: string): string {
  const keywords = [
    'SELECT',
    'FROM',
    'WHERE',
    'JOIN',
    'LEFT JOIN',
    'INNER JOIN',
    'ORDER BY',
    'GROUP BY',
    'HAVING',
    'LIMIT',
    'INSERT INTO',
    'VALUES',
    'UPDATE',
    'SET',
    'DELETE FROM',
  ];
  let out = sql.trim();
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
    out = out.replace(regex, `\n${kw}`);
  }
  return out.replace(/^\n+/, '').replace(/\n{2,}/g, '\n');
}

export async function saveProfileSecretToKeyring(
  profileName: string,
  secretPassword: string
): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error(
      'Database credentials require the OS Credential Store inside API Studio Desktop and cannot be stored in browser storage.'
    );
  }
  const ref = await desktopSecurityService.generateCredentialRef(`db_${profileName}`);
  await desktopSecurityService.storeSecret(ref, secretPassword);
  return ref;
}

export async function testDatabaseProfileConnection(
  profile: DatabaseConnectionProfile
): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error(
      'Direct SQLite/PostgreSQL/MySQL connections require the native API Studio Desktop runtime.'
    );
  }
  return invokeDesktop<string>('db_tools_test_connection', { profile });
}

export async function inspectDatabaseProfileSchema(
  profile: DatabaseConnectionProfile
): Promise<DatabaseSchemaSnapshot> {
  if (!isTauriRuntime()) {
    throw new Error(
      'Native database schema inspection requires the API Studio Desktop runtime.'
    );
  }
  return invokeDesktop<DatabaseSchemaSnapshot>('db_tools_inspect_schema', { profile });
}

export async function executeDatabaseSqlQuery(params: {
  queryId: string;
  profile: DatabaseConnectionProfile;
  sql: string;
  readOnly: boolean;
  confirmDestructive: boolean;
  maxRows: number;
  timeoutMs: number;
}): Promise<SqlQueryResult> {
  if (!params.sql.trim()) {
    throw new Error('SQL query cannot be empty.');
  }
  if (params.readOnly && !isReadOnlySql(params.sql)) {
    throw new Error(
      'Write or schema-modifying query blocked because Read-Only mode is active.'
    );
  }
  if (isDestructiveSql(params.sql) && !params.confirmDestructive) {
    throw new Error(
      'Destructive SQL operation requires explicit user confirmation.'
    );
  }
  if (!isTauriRuntime()) {
    throw new Error(
      'Direct SQL database execution requires the native API Studio Desktop runtime.'
    );
  }

  return invokeDesktop<SqlQueryResult>('db_tools_execute_query', {
    request: {
      queryId: params.queryId,
      profile: params.profile,
      sql: params.sql,
      readOnly: params.readOnly,
      confirmDestructive: params.confirmDestructive,
      maxRows: params.maxRows,
      timeoutMs: params.timeoutMs,
    },
  });
}

export async function cancelDatabaseQuery(queryId: string): Promise<void> {
  if (isTauriRuntime()) {
    await invokeDesktop<boolean>('db_tools_cancel_query', { queryId });
  }
}

export function exportQueryResultAsCsv(result: SqlQueryResult): string {
  const esc = (val: unknown): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const header = result.columns.map(esc).join(',');
  const lines = result.rows.map((row) =>
    result.columns.map((col) => esc(row[col])).join(',')
  );
  return [header, ...lines].join('\n');
}
