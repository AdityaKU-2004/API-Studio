use crate::models::{AppError, DatabaseStatus, IndexedDbMigrationPayload, MigrationReport};
use rusqlite::{params, Connection, Transaction};
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;
use std::time::{Duration, Instant};

const ALL_ENTITY_TABLES: &[&str] = &[
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

fn validate_entity_table(entity: &str) -> Result<&'static str, AppError> {
    ALL_ENTITY_TABLES
        .iter()
        .copied()
        .find(|t| *t == entity)
        .ok_or_else(|| {
            AppError::new(
                "INVALID_ENTITY_TABLE",
                format!("Unsupported entity table '{}'", entity),
                true,
            )
        })
}

fn str_field<'a>(v: &'a Value, keys: &[&str], default: &'a str) -> String {
    for k in keys {
        if let Some(s) = v.get(*k).and_then(|val| val.as_str()) {
            return s.to_string();
        }
    }
    default.to_string()
}

fn opt_str_field(v: &Value, keys: &[&str]) -> Option<String> {
    for k in keys {
        if let Some(s) = v.get(*k).and_then(|val| val.as_str()) {
            return Some(s.to_string());
        }
    }
    None
}

fn i64_field(v: &Value, keys: &[&str], default: i64) -> i64 {
    for k in keys {
        if let Some(n) = v.get(*k).and_then(|val| val.as_i64()) {
            return n;
        }
    }
    default
}

fn bool_field(v: &Value, keys: &[&str], default: bool) -> bool {
    for k in keys {
        if let Some(b) = v.get(*k).and_then(|val| val.as_bool()) {
            return b;
        }
    }
    default
}

fn collect_table_counts(conn: &Connection) -> Result<HashMap<String, usize>, AppError> {
    let mut counts = HashMap::new();
    for table in ALL_ENTITY_TABLES {
        // Table name comes strictly from static allowlist ALL_ENTITY_TABLES
        let sql = format!("SELECT COUNT(*) FROM {}", table);
        let count: i64 = conn.query_row(&sql, [], |r| r.get(0))?;
        counts.insert((*table).to_string(), count.max(0) as usize);
    }
    Ok(counts)
}

pub fn get_database_status(conn: &Connection, db_path: &Path) -> Result<DatabaseStatus, AppError> {
    let schema_version: i64 = conn
        .query_row("SELECT COALESCE(MAX(version), 0) FROM schema_migrations", [], |r| r.get(0))
        .unwrap_or(0);
    let table_counts = collect_table_counts(conn)?;

    Ok(DatabaseStatus {
        initialized: true,
        db_path: db_path.to_string_lossy().to_string(),
        schema_version,
        table_counts,
    })
}

pub fn list_entities_json(conn: &Connection, entity: &str) -> Result<Vec<Value>, AppError> {
    let table = validate_entity_table(entity)?;
    let sql = format!("SELECT payload_json FROM {}", table);
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| {
        let json_str: String = row.get(0)?;
        Ok(json_str)
    })?;

    let mut out = Vec::new();
    for row_res in rows {
        let raw = row_res?;
        if let Ok(parsed) = serde_json::from_str::<Value>(&raw) {
            out.push(parsed);
        }
    }
    Ok(out)
}

pub fn delete_entity_by_id(conn: &Connection, entity: &str, id: &str) -> Result<bool, AppError> {
    let table = validate_entity_table(entity)?;
    let sql = format!("DELETE FROM {} WHERE id = ?1", table);
    let affected = conn.execute(&sql, params![id])?;
    Ok(affected > 0)
}

pub fn clear_entity_table(conn: &Connection, entity: &str) -> Result<(), AppError> {
    let table = validate_entity_table(entity)?;
    let sql = format!("DELETE FROM {}", table);
    conn.execute(&sql, [])?;
    Ok(())
}

pub fn upsert_entity_in_tx(
    tx: &Transaction<'_>,
    entity: &str,
    item: &Value,
    skip_existing: bool,
) -> Result<bool, AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    let id = str_field(item, &["id"], "");
    if id.is_empty() {
        return Err(AppError::new(
            "VALIDATION_ERROR",
            format!("Entity '{}' item is missing required string 'id'", entity),
            true,
        ));
    }
    let payload_json = serde_json::to_string(item)?;

    if skip_existing {
        let table = validate_entity_table(entity)?;
        let exists_sql = format!("SELECT EXISTS(SELECT 1 FROM {} WHERE id = ?1)", table);
        let exists: bool = tx.query_row(&exists_sql, params![id], |r| r.get(0))?;
        if exists {
            return Ok(false);
        }
    }

    match entity {
        "collections" => {
            tx.execute(
                "INSERT INTO collections (id, name, description, sort_order, created_at, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description,
                 sort_order=excluded.sort_order, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["name"], "Untitled Collection"),
                    opt_str_field(item, &["description"]),
                    i64_field(item, &["order", "sortOrder"], 0),
                    i64_field(item, &["createdAt"], now),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "folders" => {
            tx.execute(
                "INSERT INTO folders (id, collection_id, parent_id, name, sort_order, created_at, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                 ON CONFLICT(id) DO UPDATE SET collection_id=excluded.collection_id, parent_id=excluded.parent_id,
                 name=excluded.name, sort_order=excluded.sort_order, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["collectionId"], ""),
                    opt_str_field(item, &["parentId"]),
                    str_field(item, &["name"], "Untitled Folder"),
                    i64_field(item, &["order", "sortOrder"], 0),
                    i64_field(item, &["createdAt"], now),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "requests" => {
            tx.execute(
                "INSERT INTO requests (id, collection_id, folder_id, name, request_type, method, url, sort_order, created_at, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                 ON CONFLICT(id) DO UPDATE SET collection_id=excluded.collection_id, folder_id=excluded.folder_id,
                 name=excluded.name, request_type=excluded.request_type, method=excluded.method, url=excluded.url,
                 sort_order=excluded.sort_order, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    opt_str_field(item, &["collectionId"]),
                    opt_str_field(item, &["folderId"]),
                    str_field(item, &["name"], "Untitled Request"),
                    str_field(item, &["requestType"], "http"),
                    str_field(item, &["method"], "GET"),
                    str_field(item, &["url"], ""),
                    i64_field(item, &["order", "sortOrder"], 0),
                    i64_field(item, &["createdAt"], now),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "environments" => {
            tx.execute(
                "INSERT INTO environments (id, name, is_active, created_at, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, is_active=excluded.is_active,
                 updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["name"], "Untitled Environment"),
                    if bool_field(item, &["isActive"], false) { 1i64 } else { 0i64 },
                    i64_field(item, &["createdAt"], now),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
            // Sync nested environment variables cleanly into relational variables table
            if let Some(vars) = item.get("variables").and_then(|v| v.as_array()) {
                tx.execute("DELETE FROM variables WHERE environment_id = ?1", params![id])?;
                for (idx, var_item) in vars.iter().enumerate() {
                    let var_id = str_field(var_item, &["id"], &format!("{}-var-{}", id, idx));
                    let var_key = str_field(var_item, &["key"], "");
                    let is_sec = bool_field(var_item, &["isSecret", "secret"], false);
                    let cred_ref = opt_str_field(var_item, &["credentialRef"]);
                    let enabled = bool_field(var_item, &["enabled"], true);
                    let var_json = serde_json::to_string(var_item)?;
                    tx.execute(
                        "INSERT INTO variables (id, environment_id, var_key, is_secret, credential_ref, enabled, payload_json)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        params![var_id, id, var_key, is_sec as i64, cred_ref, enabled as i64, var_json],
                    )?;
                }
            }
        }
        "global_variables" => {
            tx.execute(
                "INSERT INTO global_variables (id, var_key, is_secret, credential_ref, enabled, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET var_key=excluded.var_key, is_secret=excluded.is_secret,
                 credential_ref=excluded.credential_ref, enabled=excluded.enabled, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["key"], ""),
                    bool_field(item, &["isSecret", "secret"], false) as i64,
                    opt_str_field(item, &["credentialRef"]),
                    bool_field(item, &["enabled"], true) as i64,
                    payload_json
                ],
            )?;
        }
        "request_history" => {
            tx.execute(
                "INSERT INTO request_history (id, request_id, request_type, method, url, status, time_ms, timestamp, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                 ON CONFLICT(id) DO UPDATE SET status=excluded.status, time_ms=excluded.time_ms,
                 timestamp=excluded.timestamp, payload_json=excluded.payload_json",
                params![
                    id,
                    opt_str_field(item, &["requestId"]),
                    str_field(item, &["requestType"], "http"),
                    str_field(item, &["method"], "GET"),
                    str_field(item, &["url"], ""),
                    i64_field(item, &["status"], 0),
                    i64_field(item, &["timeMs"], 0),
                    i64_field(item, &["timestamp"], now),
                    payload_json
                ],
            )?;
        }
        "test_suites" => {
            tx.execute(
                "INSERT INTO test_suites (id, name, collection_id, created_at, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, collection_id=excluded.collection_id,
                 updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["name"], "Untitled Suite"),
                    opt_str_field(item, &["collectionId"]),
                    i64_field(item, &["createdAt"], now),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "test_reports" => {
            tx.execute(
                "INSERT INTO test_reports (id, suite_id, collection_id, status, started_at, completed_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(id) DO UPDATE SET status=excluded.status, completed_at=excluded.completed_at, payload_json=excluded.payload_json",
                params![
                    id,
                    opt_str_field(item, &["suiteId"]),
                    opt_str_field(item, &["collectionId"]),
                    str_field(item, &["status"], "completed"),
                    i64_field(item, &["startedAt"], now),
                    item.get("completedAt").and_then(|v| v.as_i64()),
                    payload_json
                ],
            )?;
            if let Some(results) = item.get("results").and_then(|v| v.as_array()) {
                tx.execute("DELETE FROM test_results WHERE report_id = ?1", params![id])?;
                for (idx, r) in results.iter().enumerate() {
                    let res_id = str_field(r, &["id"], &format!("{}-res-{}", id, idx));
                    let req_id = opt_str_field(r, &["requestId"]);
                    let r_name = str_field(r, &["requestName", "name"], "Test Result");
                    let passed = bool_field(r, &["passed"], false);
                    let dur = r.get("durationMs").and_then(|v| v.as_i64());
                    let r_json = serde_json::to_string(r)?;
                    tx.execute(
                        "INSERT INTO test_results (id, report_id, request_id, name, passed, duration_ms, payload_json)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        params![res_id, id, req_id, r_name, passed as i64, dur, r_json],
                    )?;
                }
            }
        }
        "script_templates" => {
            tx.execute(
                "INSERT INTO script_templates (id, name, category, stage, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category,
                 stage=excluded.stage, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["name"], "Script Template"),
                    opt_str_field(item, &["category"]),
                    opt_str_field(item, &["stage"]),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "json_schemas" => {
            tx.execute(
                "INSERT INTO json_schemas (id, name, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["name"], "JSON Schema"),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "assertion_configurations" => {
            tx.execute(
                "INSERT INTO assertion_configurations (id, request_id, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(id) DO UPDATE SET request_id=excluded.request_id, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["requestId"], ""),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "websocket_configurations" => {
            tx.execute(
                "INSERT INTO websocket_configurations (id, request_id, record_kind, name, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET request_id=excluded.request_id, name=excluded.name,
                 updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    opt_str_field(item, &["requestId"]),
                    str_field(item, &["recordKind"], "config"),
                    str_field(item, &["name"], "WebSocket Config"),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "sse_configurations" => {
            tx.execute(
                "INSERT INTO sse_configurations (id, request_id, record_kind, name, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET request_id=excluded.request_id, name=excluded.name,
                 updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    opt_str_field(item, &["requestId"]),
                    str_field(item, &["recordKind"], "config"),
                    str_field(item, &["name"], "SSE Config"),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "graphql_configurations" => {
            tx.execute(
                "INSERT INTO graphql_configurations (id, request_id, name, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET request_id=excluded.request_id, name=excluded.name,
                 updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    opt_str_field(item, &["requestId"]),
                    str_field(item, &["name"], "GraphQL Config"),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "comparison_sessions" => {
            tx.execute(
                "INSERT INTO comparison_sessions (id, title, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(id) DO UPDATE SET title=excluded.title, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["title", "name"], "Comparison Session"),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "developer_tool_preferences" => {
            tx.execute(
                "INSERT INTO developer_tool_preferences (id, last_active_tool, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(id) DO UPDATE SET last_active_tool=excluded.last_active_tool,
                 updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["lastActiveTool"], "json-formatter"),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "application_settings" => {
            tx.execute(
                "INSERT INTO application_settings (id, updated_at, payload_json)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![id, i64_field(item, &["updatedAt"], now), payload_json],
            )?;
        }
        "workspaces" => {
            tx.execute(
                "INSERT INTO workspaces (id, name, workspace_type, created_at, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, workspace_type=excluded.workspace_type,
                 updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["name"], "Workspace"),
                    str_field(item, &["type"], "personal"),
                    i64_field(item, &["createdAt"], now),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "projects" => {
            tx.execute(
                "INSERT INTO projects (id, workspace_id, name, created_at, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET workspace_id=excluded.workspace_id, name=excluded.name,
                 updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["workspaceId"], "ws-default"),
                    str_field(item, &["name"], "Project"),
                    i64_field(item, &["createdAt"], now),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "api_specifications" => {
            tx.execute(
                "INSERT INTO api_specifications (id, project_id, workspace_id, name, version, format, created_at, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, version=excluded.version,
                 format=excluded.format, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    opt_str_field(item, &["projectId"]),
                    opt_str_field(item, &["workspaceId"]),
                    str_field(item, &["name"], "API Specification"),
                    str_field(item, &["version"], "1.0.0"),
                    str_field(item, &["format"], "yaml"),
                    i64_field(item, &["createdAt"], now),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "api_versions" => {
            tx.execute(
                "INSERT INTO api_versions (id, spec_id, version_label, is_active, is_archived, created_at, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                 ON CONFLICT(id) DO UPDATE SET version_label=excluded.version_label, is_active=excluded.is_active,
                 is_archived=excluded.is_archived, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["specId"], ""),
                    str_field(item, &["versionLabel"], "1.0.0"),
                    bool_field(item, &["isActive"], false) as i64,
                    bool_field(item, &["isArchived"], false) as i64,
                    i64_field(item, &["createdAt"], now),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "documentation_configurations" => {
            tx.execute(
                "INSERT INTO documentation_configurations (id, spec_id, title, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET title=excluded.title, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["specId"], ""),
                    str_field(item, &["title"], "API Docs"),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "mock_servers" => {
            tx.execute(
                "INSERT INTO mock_servers (id, project_id, name, port, created_at, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, port=excluded.port,
                 updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    opt_str_field(item, &["projectId"]),
                    str_field(item, &["name"], "Mock Server"),
                    i64_field(item, &["port"], 4010),
                    i64_field(item, &["createdAt"], now),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "mock_endpoints" => {
            tx.execute(
                "INSERT INTO mock_endpoints (id, server_id, method, path, enabled, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET method=excluded.method, path=excluded.path,
                 enabled=excluded.enabled, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["serverId"], ""),
                    str_field(item, &["method"], "GET"),
                    str_field(item, &["path"], "/"),
                    bool_field(item, &["enabled"], true) as i64,
                    payload_json
                ],
            )?;
        }
        "mock_request_logs" => {
            tx.execute(
                "INSERT INTO mock_request_logs (id, server_id, timestamp, method, path, response_status, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["serverId"], ""),
                    i64_field(item, &["timestamp"], now),
                    str_field(item, &["method"], "GET"),
                    str_field(item, &["path"], "/"),
                    i64_field(item, &["responseStatus"], 200),
                    payload_json
                ],
            )?;
        }
        "contract_test_configurations" => {
            tx.execute(
                "INSERT INTO contract_test_configurations (id, spec_id, name, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["specId"], ""),
                    str_field(item, &["name"], "Contract Config"),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "contract_test_reports" => {
            tx.execute(
                "INSERT INTO contract_test_reports (id, spec_id, status, started_at, completed_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET status=excluded.status, completed_at=excluded.completed_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["specId"], ""),
                    str_field(item, &["status"], "passed"),
                    i64_field(item, &["startedAt"], now),
                    item.get("completedAt").and_then(|v| v.as_i64()),
                    payload_json
                ],
            )?;
        }
        "git_repository_configs" => {
            tx.execute(
                "INSERT INTO git_repository_configs (id, project_id, repo_path, current_branch, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET repo_path=excluded.repo_path, current_branch=excluded.current_branch,
                 updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    opt_str_field(item, &["projectId"]),
                    str_field(item, &["repoPath"], ""),
                    str_field(item, &["currentBranch"], "main"),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "git_activity_metadata" => {
            tx.execute(
                "INSERT INTO git_activity_metadata (id, repo_id, action, timestamp, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json",
                params![
                    id,
                    opt_str_field(item, &["repoId"]),
                    str_field(item, &["action"], "commit"),
                    i64_field(item, &["timestamp"], now),
                    payload_json
                ],
            )?;
        }
        "workspace_memberships" => {
            tx.execute(
                "INSERT INTO workspace_memberships (id, workspace_id, email, role, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET role=excluded.role, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["workspaceId"], "ws-default"),
                    str_field(item, &["email"], ""),
                    str_field(item, &["role"], "Viewer"),
                    payload_json
                ],
            )?;
        }
        "collaboration_comments" => {
            tx.execute(
                "INSERT INTO collaboration_comments (id, workspace_id, target_type, target_id, created_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["workspaceId"], "ws-default"),
                    str_field(item, &["targetType"], "spec"),
                    str_field(item, &["targetId"], ""),
                    i64_field(item, &["createdAt"], now),
                    payload_json
                ],
            )?;
        }
        "activity_logs" => {
            tx.execute(
                "INSERT INTO activity_logs (id, workspace_id, project_id, timestamp, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["workspaceId"], "ws-default"),
                    opt_str_field(item, &["projectId"]),
                    i64_field(item, &["timestamp"], now),
                    payload_json
                ],
            )?;
        }
        "sync_metadata" => {
            tx.execute(
                "INSERT INTO sync_metadata (id, workspace_id, status, payload_json)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(id) DO UPDATE SET status=excluded.status, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["workspaceId"], "ws-default"),
                    str_field(item, &["status"], "local-only"),
                    payload_json
                ],
            )?;
        }
        "performance_test_configs" => {
            tx.execute(
                "INSERT INTO performance_test_configs (id, name, mode, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, mode=excluded.mode, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["name"], "Performance Test"),
                    str_field(item, &["mode"], "load"),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "performance_test_runs" => {
            tx.execute(
                "INSERT INTO performance_test_runs (id, config_id, status, started_at, completed_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET status=excluded.status, completed_at=excluded.completed_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["configId"], ""),
                    str_field(item, &["status"], "completed"),
                    i64_field(item, &["startedAt"], now),
                    item.get("completedAt").and_then(|v| v.as_i64()),
                    payload_json
                ],
            )?;
        }
        "performance_metrics" => {
            tx.execute(
                "INSERT INTO performance_metrics (id, run_id, timestamp, payload_json)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["runId"], ""),
                    i64_field(item, &["timestamp"], now),
                    payload_json
                ],
            )?;
        }
        "security_audit_configs" => {
            tx.execute(
                "INSERT INTO security_audit_configs (id, name, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["name"], "Security Audit"),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "security_findings" => {
            tx.execute(
                "INSERT INTO security_findings (id, audit_id, severity, status, detected_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET severity=excluded.severity, status=excluded.status, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["auditId"], ""),
                    str_field(item, &["severity"], "medium"),
                    str_field(item, &["status"], "open"),
                    i64_field(item, &["detectedAt"], now),
                    payload_json
                ],
            )?;
        }
        "monitoring_configs" => {
            tx.execute(
                "INSERT INTO monitoring_configs (id, name, protocol, enabled, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, protocol=excluded.protocol, enabled=excluded.enabled, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["name"], "API Monitor"),
                    str_field(item, &["protocol"], "http"),
                    if bool_field(item, &["enabled"], true) { 1i64 } else { 0i64 },
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "monitoring_results" => {
            tx.execute(
                "INSERT INTO monitoring_results (id, monitor_id, timestamp, status, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET status=excluded.status, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["monitorId"], ""),
                    i64_field(item, &["timestamp"], now),
                    str_field(item, &["status"], "unknown"),
                    payload_json
                ],
            )?;
        }
        "alert_configs" => {
            tx.execute(
                "INSERT INTO alert_configs (id, monitor_id, name, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["monitorId"], ""),
                    str_field(item, &["name"], "Alert Rule"),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "database_connection_profiles" => {
            tx.execute(
                "INSERT INTO database_connection_profiles (id, name, engine, credential_ref, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, engine=excluded.engine, credential_ref=excluded.credential_ref, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["name"], "Database"),
                    str_field(item, &["engine"], "sqlite"),
                    opt_str_field(item, &["credentialRef"]),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "query_history" => {
            tx.execute(
                "INSERT INTO query_history (id, profile_id, executed_at, success, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["profileId"], ""),
                    i64_field(item, &["executedAt"], now),
                    if bool_field(item, &["success"], true) { 1i64 } else { 0i64 },
                    payload_json
                ],
            )?;
        }
        "environment_validation_results" => {
            tx.execute(
                "INSERT INTO environment_validation_results (id, environment_id, checked_at, valid, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET valid=excluded.valid, checked_at=excluded.checked_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["environmentId"], ""),
                    i64_field(item, &["checkedAt"], now),
                    if bool_field(item, &["valid"], true) { 1i64 } else { 0i64 },
                    payload_json
                ],
            )?;
        }
        "dependency_graph_data" => {
            tx.execute(
                "INSERT INTO dependency_graph_data (id, name, generated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, generated_at=excluded.generated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["name"], "Dependency Graph"),
                    i64_field(item, &["generatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "automation_workflows" => {
            tx.execute(
                "INSERT INTO automation_workflows (id, name, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["name"], "Automation Workflow"),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "workflow_executions" => {
            tx.execute(
                "INSERT INTO workflow_executions (id, workflow_id, status, started_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET status=excluded.status, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["workflowId"], ""),
                    str_field(item, &["status"], "passed"),
                    i64_field(item, &["startedAt"], now),
                    payload_json
                ],
            )?;
        }
        "cli_configurations" => {
            tx.execute(
                "INSERT INTO cli_configurations (id, name, subcommand, updated_at, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET name=excluded.name, subcommand=excluded.subcommand, updated_at=excluded.updated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    str_field(item, &["name"], "CLI Config"),
                    str_field(item, &["subcommand"], "run tests"),
                    i64_field(item, &["updatedAt"], now),
                    payload_json
                ],
            )?;
        }
        "analytics_snapshots" => {
            tx.execute(
                "INSERT INTO analytics_snapshots (id, generated_at, payload_json)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(id) DO UPDATE SET generated_at=excluded.generated_at, payload_json=excluded.payload_json",
                params![
                    id,
                    i64_field(item, &["generatedAt"], now),
                    payload_json
                ],
            )?;
        }
        _ => return Err(AppError::new("INVALID_ENTITY_TABLE", "Unsupported entity table", true)),
    }

    Ok(true)
}

pub fn save_entity_json(conn: &mut Connection, entity: &str, item: &Value) -> Result<(), AppError> {
    let tx = conn.transaction()?;
    upsert_entity_in_tx(&tx, entity, item, false)?;
    tx.commit()?;
    Ok(())
}

pub fn import_indexeddb_payload(
    conn: &mut Connection,
    payload: &IndexedDbMigrationPayload,
) -> Result<MigrationReport, AppError> {
    let started = Instant::now();
    let skip_existing = payload.conflict_strategy.as_deref() == Some("skip");

    let mut imported_counts: HashMap<String, usize> = HashMap::new();
    let mut skipped_counts: HashMap<String, usize> = HashMap::new();

    let tx = conn.transaction()?;

    let mut process_list = |table: &str, items: &[Value]| -> Result<(), AppError> {
        let mut imp = 0usize;
        let mut skip = 0usize;
        for item in items {
            if upsert_entity_in_tx(&tx, table, item, skip_existing)? {
                imp += 1;
            } else {
                skip += 1;
            }
        }
        imported_counts.insert(table.to_string(), imp);
        skipped_counts.insert(table.to_string(), skip);
        Ok(())
    };

    process_list("collections", &payload.collections)?;
    process_list("folders", &payload.folders)?;
    process_list("requests", &payload.requests)?;
    process_list("environments", &payload.environments)?;
    process_list("global_variables", &payload.global_variables)?;
    process_list("request_history", &payload.history)?;
    process_list("application_settings", &payload.settings)?;
    process_list("test_suites", &payload.test_suites)?;
    process_list("test_reports", &payload.test_reports)?;
    process_list("script_templates", &payload.script_templates)?;
    process_list("json_schemas", &payload.json_schemas)?;
    process_list("assertion_configurations", &payload.assertion_configurations)?;
    process_list("comparison_sessions", &payload.comparison_sessions)?;
    process_list("developer_tool_preferences", &payload.developer_tool_preferences)?;
    process_list("workspaces", &payload.workspaces)?;
    process_list("projects", &payload.projects)?;
    process_list("api_specifications", &payload.api_specs)?;
    process_list("api_versions", &payload.api_versions)?;
    process_list("documentation_configurations", &payload.documentation_configs)?;
    process_list("mock_servers", &payload.mock_servers)?;
    process_list("mock_endpoints", &payload.mock_endpoints)?;
    process_list("mock_request_logs", &payload.mock_request_logs)?;
    process_list("contract_test_configurations", &payload.contract_configs)?;
    process_list("contract_test_reports", &payload.contract_reports)?;
    process_list("git_repository_configs", &payload.git_repos)?;
    process_list("workspace_memberships", &payload.workspace_members)?;
    process_list("collaboration_comments", &payload.collaboration_comments)?;
    process_list("activity_logs", &payload.activity_logs)?;
    process_list("sync_metadata", &payload.sync_metadata)?;
    process_list("performance_test_configs", &payload.performance_test_configs)?;
    process_list("performance_test_runs", &payload.performance_test_runs)?;
    process_list("performance_metrics", &payload.performance_metrics)?;
    process_list("security_audit_configs", &payload.security_audit_configs)?;
    process_list("security_findings", &payload.security_findings)?;
    process_list("monitoring_configs", &payload.monitoring_configs)?;
    process_list("monitoring_results", &payload.monitoring_results)?;
    process_list("alert_configs", &payload.alert_configs)?;
    process_list("database_connection_profiles", &payload.database_connection_profiles)?;
    process_list("query_history", &payload.query_history)?;
    process_list("environment_validation_results", &payload.environment_validation_results)?;
    process_list("dependency_graph_data", &payload.dependency_graph_data)?;
    process_list("automation_workflows", &payload.automation_workflows)?;
    process_list("workflow_executions", &payload.workflow_executions)?;
    process_list("cli_configurations", &payload.cli_configurations)?;
    process_list("analytics_snapshots", &payload.analytics_snapshots)?;

    // Route Phase 6 protocol configs by protocol discriminator
    for item in &payload.protocol_configs {
        let proto = str_field(item, &["protocol"], "graphql");
        let target = match proto.as_str() {
            "websocket" => "websocket_configurations",
            "sse" => "sse_configurations",
            _ => "graphql_configurations",
        };
        let mut enriched = item.clone();
        if let Some(obj) = enriched.as_object_mut() {
            obj.insert("recordKind".to_string(), Value::String("config".to_string()));
        }
        let ok = upsert_entity_in_tx(&tx, target, &enriched, skip_existing)?;
        let counter = if ok { &mut imported_counts } else { &mut skipped_counts };
        *counter.entry(target.to_string()).or_insert(0) += 1;
    }

    for item in &payload.ws_message_templates {
        let mut enriched = item.clone();
        if let Some(obj) = enriched.as_object_mut() {
            obj.insert("recordKind".to_string(), Value::String("template".to_string()));
        }
        let ok = upsert_entity_in_tx(&tx, "websocket_configurations", &enriched, skip_existing)?;
        let counter = if ok { &mut imported_counts } else { &mut skipped_counts };
        *counter.entry("websocket_configurations".to_string()).or_insert(0) += 1;
    }

    for item in &payload.sse_event_logs {
        let mut enriched = item.clone();
        if let Some(obj) = enriched.as_object_mut() {
            obj.insert("recordKind".to_string(), Value::String("event_log".to_string()));
            if !obj.contains_key("name") {
                obj.insert(
                    "name".to_string(),
                    Value::String(str_field(item, &["url"], "SSE Event Log")),
                );
            }
            if !obj.contains_key("updatedAt") {
                obj.insert(
                    "updatedAt".to_string(),
                    Value::Number(serde_json::Number::from(i64_field(item, &["timestamp"], 0))),
                );
            }
        }
        let ok = upsert_entity_in_tx(&tx, "sse_configurations", &enriched, skip_existing)?;
        let counter = if ok { &mut imported_counts } else { &mut skipped_counts };
        *counter.entry("sse_configurations".to_string()).or_insert(0) += 1;
    }

    tx.commit()?;

    let verified_db_counts = collect_table_counts(conn)?;

    Ok(MigrationReport {
        success: true,
        imported_counts,
        skipped_counts,
        verified_db_counts,
        duration_ms: started.elapsed().as_millis() as u64,
    })
}

pub fn backup_sqlite_database(conn: &Connection, dest_path: &Path) -> Result<(), AppError> {
    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut dst_conn = Connection::open(dest_path)?;
    let backup = rusqlite::backup::Backup::new(conn, &mut dst_conn)?;
    backup.run_to_completion(100, Duration::from_millis(10), None)?;
    Ok(())
}

pub fn restore_sqlite_database(conn: &mut Connection, src_path: &Path) -> Result<(), AppError> {
    let src_conn = Connection::open_with_flags(
        src_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )?;

    let integrity: String = src_conn
        .query_row("PRAGMA integrity_check", [], |r| r.get(0))
        .unwrap_or_else(|_| "failed".to_string());

    if !integrity.eq_ignore_ascii_case("ok") {
        return Err(AppError::new(
            "CORRUPT_BACKUP_DATABASE",
            format!("Selected SQLite backup failed integrity verification: {}", integrity),
            true,
        ));
    }

    let backup = rusqlite::backup::Backup::new(&src_conn, conn)?;
    backup.run_to_completion(100, Duration::from_millis(10), None)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::migrations::run_migrations;
    use serde_json::json;

    #[test]
    fn imports_indexeddb_payload_and_respects_conflict_strategy() {
        let mut conn = Connection::open_in_memory().unwrap();
        run_migrations(&mut conn).unwrap();

        let payload = IndexedDbMigrationPayload {
            collections: vec![json!({
                "id": "col-1",
                "name": "Core API",
                "createdAt": 1000,
                "updatedAt": 1000
            })],
            folders: vec![json!({
                "id": "fld-1",
                "collectionId": "col-1",
                "name": "Auth",
                "createdAt": 1000,
                "updatedAt": 1000
            })],
            requests: vec![json!({
                "id": "req-1",
                "collectionId": "col-1",
                "folderId": "fld-1",
                "name": "Login",
                "requestType": "http",
                "method": "POST",
                "url": "https://api.example.com/login",
                "createdAt": 1000,
                "updatedAt": 1000
            })],
            environments: vec![json!({
                "id": "env-1",
                "name": "Production",
                "isActive": true,
                "variables": [
                    { "id": "v-1", "key": "base_url", "currentValue": "https://api.example.com", "enabled": true, "isSecret": false }
                ],
                "createdAt": 1000,
                "updatedAt": 1000
            })],
            global_variables: vec![],
            history: vec![],
            settings: vec![],
            test_suites: vec![],
            test_reports: vec![],
            script_templates: vec![],
            json_schemas: vec![],
            assertion_configurations: vec![],
            protocol_configs: vec![],
            ws_message_templates: vec![],
            sse_event_logs: vec![],
            comparison_sessions: vec![],
            developer_tool_preferences: vec![],
            workspaces: vec![],
            projects: vec![],
            api_specs: vec![],
            api_versions: vec![],
            documentation_configs: vec![],
            mock_servers: vec![],
            mock_endpoints: vec![],
            mock_request_logs: vec![],
            contract_configs: vec![],
            contract_reports: vec![],
            git_repos: vec![],
            workspace_members: vec![],
            collaboration_comments: vec![],
            activity_logs: vec![],
            sync_metadata: vec![],
            performance_test_configs: vec![],
            performance_test_runs: vec![],
            performance_metrics: vec![],
            security_audit_configs: vec![],
            security_findings: vec![],
            monitoring_configs: vec![],
            monitoring_results: vec![],
            alert_configs: vec![],
            database_connection_profiles: vec![],
            query_history: vec![],
            environment_validation_results: vec![],
            dependency_graph_data: vec![],
            automation_workflows: vec![],
            workflow_executions: vec![],
            cli_configurations: vec![],
            analytics_snapshots: vec![],
            conflict_strategy: Some("overwrite".to_string()),
        };

        let report = import_indexeddb_payload(&mut conn, &payload).unwrap();
        assert!(report.success);
        assert_eq!(report.imported_counts.get("collections"), Some(&1));
        assert_eq!(report.verified_db_counts.get("requests"), Some(&1));
        assert_eq!(report.verified_db_counts.get("variables"), Some(&1));

        // Second import with skip strategy skips existing records
        let mut skip_payload = payload.clone();
        skip_payload.conflict_strategy = Some("skip".to_string());
        let report2 = import_indexeddb_payload(&mut conn, &skip_payload).unwrap();
        assert_eq!(report2.skipped_counts.get("collections"), Some(&1));
        assert_eq!(report2.imported_counts.get("collections"), Some(&0));
    }
}
