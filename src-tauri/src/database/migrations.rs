use crate::models::AppError;
use rusqlite::Connection;

pub const LATEST_SCHEMA_VERSION: i64 = 3;

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

const MIGRATION_V2_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    workspace_type TEXT NOT NULL DEFAULT 'personal',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);

CREATE TABLE IF NOT EXISTS api_specifications (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    workspace_id TEXT,
    name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0',
    format TEXT NOT NULL DEFAULT 'yaml',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_specs_project ON api_specifications(project_id);

CREATE TABLE IF NOT EXISTS api_versions (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL,
    version_label TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_versions_spec ON api_versions(spec_id);

CREATE TABLE IF NOT EXISTS documentation_configurations (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL,
    title TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mock_servers (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    name TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 4010,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mock_endpoints (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mock_endpoints_server ON mock_endpoints(server_id);

CREATE TABLE IF NOT EXISTS mock_request_logs (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    response_status INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mock_logs_server_ts ON mock_request_logs(server_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS contract_test_configurations (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL,
    name TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contract_test_reports (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contract_reports_spec ON contract_test_reports(spec_id);

CREATE TABLE IF NOT EXISTS git_repository_configs (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    repo_path TEXT NOT NULL,
    current_branch TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS git_activity_metadata (
    id TEXT PRIMARY KEY,
    repo_id TEXT,
    action TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Viewer',
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memberships_workspace ON workspace_memberships(workspace_id);

CREATE TABLE IF NOT EXISTS collaboration_comments (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_workspace ON collaboration_comments(workspace_id);

CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    project_id TEXT,
    timestamp INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_workspace_ts ON activity_logs(workspace_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS sync_metadata (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL
);
"#;

const MIGRATION_V3_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS performance_test_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'load',
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS performance_test_runs (
    id TEXT PRIMARY KEY,
    config_id TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_perf_runs_config ON performance_test_runs(config_id);
CREATE INDEX IF NOT EXISTS idx_perf_runs_started ON performance_test_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS performance_metrics (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_run ON performance_metrics(run_id, timestamp);

CREATE TABLE IF NOT EXISTS security_audit_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS security_findings (
    id TEXT PRIMARY KEY,
    audit_id TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    detected_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sec_findings_audit ON security_findings(audit_id);
CREATE INDEX IF NOT EXISTS idx_sec_findings_severity ON security_findings(severity);

CREATE TABLE IF NOT EXISTS monitoring_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    protocol TEXT NOT NULL DEFAULT 'http',
    enabled INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS monitoring_results (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mon_results_monitor_ts ON monitoring_results(monitor_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS alert_configs (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL,
    name TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alert_configs_monitor ON alert_configs(monitor_id);

CREATE TABLE IF NOT EXISTS database_connection_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    engine TEXT NOT NULL,
    credential_ref TEXT,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS query_history (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    executed_at INTEGER NOT NULL,
    success INTEGER NOT NULL DEFAULT 1,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_query_history_profile_ts ON query_history(profile_id, executed_at DESC);

CREATE TABLE IF NOT EXISTS environment_validation_results (
    id TEXT PRIMARY KEY,
    environment_id TEXT NOT NULL,
    checked_at INTEGER NOT NULL,
    valid INTEGER NOT NULL DEFAULT 1,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_env_validation_env ON environment_validation_results(environment_id);

CREATE TABLE IF NOT EXISTS dependency_graph_data (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    generated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_executions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_wf ON workflow_executions(workflow_id, started_at DESC);

CREATE TABLE IF NOT EXISTS cli_configurations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subcommand TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id TEXT PRIMARY KEY,
    generated_at INTEGER NOT NULL,
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

    if current_version < 2 {
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_V2_SQL)?;
        let now = chrono::Utc::now().timestamp_millis();
        tx.execute(
            "INSERT OR REPLACE INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, ?3)",
            rusqlite::params![2i64, "v2_phase8_lifecycle_mock_git_collab_schema", now],
        )?;
        tx.commit()?;
    }

    if current_version < 3 {
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_V3_SQL)?;
        let now = chrono::Utc::now().timestamp_millis();
        tx.execute(
            "INSERT OR REPLACE INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, ?3)",
            rusqlite::params![3i64, "v3_phase9_devops_perf_security_monitoring_db_workflows", now],
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
            "workspaces",
            "projects",
            "api_specifications",
            "api_versions",
            "documentation_configurations",
            "mock_servers",
            "mock_endpoints",
            "mock_request_logs",
            "contract_test_configurations",
            "contract_test_reports",
            "git_repository_configs",
            "git_activity_metadata",
            "workspace_memberships",
            "collaboration_comments",
            "activity_logs",
            "sync_metadata",
            "performance_test_configs",
            "performance_test_runs",
            "performance_metrics",
            "security_audit_configs",
            "security_findings",
            "monitoring_configs",
            "monitoring_results",
            "alert_configs",
            "database_connection_profiles",
            "query_history",
            "environment_validation_results",
            "dependency_graph_data",
            "automation_workflows",
            "workflow_executions",
            "cli_configurations",
            "analytics_snapshots",
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
