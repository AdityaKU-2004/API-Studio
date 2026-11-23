use crate::models::AppError;
use rusqlite::Connection;

pub const LATEST_SCHEMA_VERSION: i64 = 1;

const MIGRATION_V1_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_folders_collection ON folders(collection_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);

CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    collection_id TEXT,
    folder_id TEXT,
    name TEXT NOT NULL,
    request_type TEXT NOT NULL DEFAULT 'http',
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_requests_collection ON requests(collection_id);
CREATE INDEX IF NOT EXISTS idx_requests_folder ON requests(folder_id);
CREATE INDEX IF NOT EXISTS idx_requests_type ON requests(request_type);

CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS variables (
    id TEXT PRIMARY KEY,
    environment_id TEXT NOT NULL,
    var_key TEXT NOT NULL,
    is_secret INTEGER NOT NULL DEFAULT 0,
    credential_ref TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    payload_json TEXT NOT NULL,
    FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_variables_env ON variables(environment_id);

CREATE TABLE IF NOT EXISTS global_variables (
    id TEXT PRIMARY KEY,
    var_key TEXT NOT NULL,
    is_secret INTEGER NOT NULL DEFAULT 0,
    credential_ref TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS request_history (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    request_type TEXT NOT NULL DEFAULT 'http',
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    status INTEGER NOT NULL,
    time_ms INTEGER NOT NULL DEFAULT 0,
    timestamp INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON request_history(timestamp DESC);

CREATE TABLE IF NOT EXISTS test_suites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    collection_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS test_reports (
    id TEXT PRIMARY KEY,
    suite_id TEXT,
    collection_id TEXT,
    status TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_started ON test_reports(started_at DESC);

CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    request_id TEXT,
    name TEXT NOT NULL,
    passed INTEGER NOT NULL,
    duration_ms INTEGER,
    payload_json TEXT NOT NULL,
    FOREIGN KEY (report_id) REFERENCES test_reports(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_test_results_report ON test_results(report_id);

CREATE TABLE IF NOT EXISTS script_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    stage TEXT,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS json_schemas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assertion_configurations (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS websocket_configurations (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    record_kind TEXT NOT NULL DEFAULT 'config',
    name TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sse_configurations (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    record_kind TEXT NOT NULL DEFAULT 'config',
    name TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS graphql_configurations (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    name TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comparison_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS developer_tool_preferences (
    id TEXT PRIMARY KEY,
    last_active_tool TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS application_settings (
    id TEXT PRIMARY KEY,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);
"#;

pub fn run_migrations(conn: &mut Connection) -> Result<i64, AppError> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    let current_version: i64 = {
        let has_table: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations')",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if has_table {
            conn.query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0)
        } else {
            0
        }
    };

    if current_version < 1 {
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_V1_SQL)?;
        let now = chrono::Utc::now().timestamp_millis();
        tx.execute(
            "INSERT OR REPLACE INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, ?3)",
            rusqlite::params![1i64, "v1_initial_api_studio_schema", now],
        )?;
        tx.commit()?;
    }

    let final_version: i64 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )?;
    Ok(final_version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_all_tables_and_is_idempotent() {
        let mut conn = Connection::open_in_memory().unwrap();
        let v1 = run_migrations(&mut conn).unwrap();
        assert_eq!(v1, LATEST_SCHEMA_VERSION);

        let v2 = run_migrations(&mut conn).unwrap();
        assert_eq!(v2, LATEST_SCHEMA_VERSION);

        let expected_tables = [
            "collections",
            "folders",
            "requests",
            "environments",
            "variables",
            "global_variables",
            "request_history",
            "test_suites",
            "test_reports",
            "test_results",
            "script_templates",
            "json_schemas",
            "assertion_configurations",
            "websocket_configurations",
            "sse_configurations",
            "graphql_configurations",
            "comparison_sessions",
            "developer_tool_preferences",
            "application_settings",
        ];

        for table in expected_tables {
            let exists: bool = conn
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
                    [table],
                    |row| row.get(0),
                )
                .unwrap();
            assert!(exists, "Expected SQLite table '{}' to exist", table);
        }
    }
}
