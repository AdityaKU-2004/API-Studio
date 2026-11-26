use crate::models::{
    AppError, NativeDatabaseColumnMeta, NativeDatabaseForeignKeyMeta, NativeDatabaseIndexMeta,
    NativeDatabaseProfileInput, NativeDatabaseSchemaSnapshot, NativeDatabaseTableMeta,
    NativeSqlQueryRequest, NativeSqlQueryResult,
};
use crate::security::credential_store::CredentialStore;
use crate::utils::path_security::validate_safe_file_path;
use mysql_async::prelude::Queryable;
use rusqlite::{types::ValueRef, Connection};
use serde_json::{Map, Value};
use std::collections::{BTreeMap, HashMap};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant};

#[derive(Default)]
pub struct DbQueryCancelRegistry {
    active: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl DbQueryCancelRegistry {
    pub fn register(&self, query_id: &str) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        if let Ok(mut guard) = self.active.lock() {
            guard.insert(query_id.to_string(), Arc::clone(&flag));
        }
        flag
    }

    pub fn cancel(&self, query_id: &str) -> bool {
        if let Ok(guard) = self.active.lock() {
            if let Some(flag) = guard.get(query_id) {
                flag.store(true, Ordering::SeqCst);
                return true;
            }
        }
        false
    }

    pub fn remove(&self, query_id: &str) {
        if let Ok(mut guard) = self.active.lock() {
            guard.remove(query_id);
        }
    }
}

pub fn is_read_only_sql(sql: &str) -> bool {
    let trimmed = sql
        .trim_start()
        .trim_start_matches(|c: char| c == ';' || c.is_whitespace());
    let first_word = trimmed
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_ascii_uppercase();
    matches!(
        first_word.as_str(),
        "SELECT" | "WITH" | "SHOW" | "DESCRIBE" | "DESC" | "EXPLAIN" | "PRAGMA"
    )
}

pub fn is_destructive_sql(sql: &str) -> bool {
    let upper = sql.to_ascii_uppercase();
    let trimmed = upper.trim_start();
    trimmed.starts_with("DROP ")
        || trimmed.starts_with("TRUNCATE ")
        || trimmed.starts_with("ALTER ")
        || (trimmed.starts_with("DELETE ") && !upper.contains(" WHERE "))
        || (trimmed.starts_with("UPDATE ") && !upper.contains(" WHERE "))
}

fn load_profile_password(profile: &NativeDatabaseProfileInput) -> Result<String, AppError> {
    if let Some(ref_key) = &profile.credential_ref {
        if !ref_key.trim().is_empty() {
            return Ok(CredentialStore::get_secret(ref_key)?.unwrap_or_default());
        }
    }
    Ok(String::new())
}

pub async fn test_database_connection(
    profile: &NativeDatabaseProfileInput,
) -> Result<String, AppError> {
    match profile.engine.as_str() {
        "sqlite" => {
            let safe_path = validate_safe_file_path(&profile.database_name, true, None)?;
            let conn = Connection::open_with_flags(
                safe_path,
                rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
            )?;
            let ver: String = conn.query_row("SELECT sqlite_version()", [], |r| r.get(0))?;
            Ok(format!("Connected to SQLite v{}", ver))
        }
        "postgresql" => {
            let password = load_profile_password(profile)?;
            let host = profile.host.as_deref().unwrap_or("127.0.0.1");
            let port = profile.port.unwrap_or(5432);
            let user = profile.username.as_deref().unwrap_or("postgres");
            let conn_str = format!(
                "host={} port={} user={} password={} dbname={}",
                host, port, user, password, profile.database_name
            );
            let (client, connection) =
                tokio_postgres::connect(&conn_str, tokio_postgres::NoTls)
                    .await
                    .map_err(|e| AppError::new("POSTGRES_CONNECT_FAILED", e.to_string(), true))?;
            tokio::spawn(async move {
                let _ = connection.await;
            });
            let row = client
                .query_one("SELECT version()", &[])
                .await
                .map_err(|e| AppError::new("POSTGRES_QUERY_FAILED", e.to_string(), true))?;
            let ver: String = row.get(0);
            Ok(ver)
        }
        "mysql" => {
            let password = load_profile_password(profile)?;
            let host = profile.host.as_deref().unwrap_or("127.0.0.1");
            let port = profile.port.unwrap_or(3306);
            let user = profile.username.as_deref().unwrap_or("root");
            let opts = mysql_async::OptsBuilder::default()
                .ip_or_hostname(host)
                .tcp_port(port)
                .user(Some(user))
                .pass(Some(password))
                .db_name(Some(&profile.database_name));
            let pool = mysql_async::Pool::new(opts);
            let mut conn = pool
                .get_conn()
                .await
                .map_err(|e| AppError::new("MYSQL_CONNECT_FAILED", e.to_string(), true))?;
            let ver: Option<String> = conn
                .query_first("SELECT VERSION()")
                .await
                .map_err(|e| AppError::new("MYSQL_QUERY_FAILED", e.to_string(), true))?;
            drop(conn);
            let _ = pool.disconnect().await;
            Ok(format!("Connected to MySQL {}", ver.unwrap_or_default()))
        }
        _ => Err(AppError::new(
            "UNSUPPORTED_DB_ENGINE",
            format!("Unsupported database engine '{}'", profile.engine),
            true,
        )),
    }
}

pub fn inspect_sqlite_schema(path_str: &str) -> Result<NativeDatabaseSchemaSnapshot, AppError> {
    let safe_path = validate_safe_file_path(path_str, true, None)?;
    let conn = Connection::open_with_flags(
        &safe_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )?;

    let mut stmt = conn.prepare(
        "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )?;
    let entries = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?
        .filter_map(|r| r.ok())
        .collect::<Vec<_>>();

    let mut tables = Vec::new();
    for (name, ttype) in entries {
        let escaped = name.replace('"', "\"\"");
        let mut columns = Vec::new();
        let mut col_stmt = conn.prepare(&format!("PRAGMA table_info(\"{}\")", escaped))?;
        let col_rows = col_stmt.query_map([], |row| {
            Ok(NativeDatabaseColumnMeta {
                name: row.get::<_, String>(1)?,
                data_type: row.get::<_, String>(2)?,
                nullable: row.get::<_, i64>(3)? == 0,
                default_value: row.get::<_, Option<String>>(4)?,
                is_primary_key: row.get::<_, i64>(5)? > 0,
            })
        })?;
        for c in col_rows.flatten() {
            columns.push(c);
        }

        let mut foreign_keys = Vec::new();
        let mut fk_stmt = conn.prepare(&format!("PRAGMA foreign_key_list(\"{}\")", escaped))?;
        let fk_rows = fk_stmt.query_map([], |row| {
            Ok(NativeDatabaseForeignKeyMeta {
                referenced_table: row.get::<_, String>(2)?,
                column_name: row.get::<_, String>(3)?,
                referenced_column: row.get::<_, String>(4)?,
            })
        })?;
        for fk in fk_rows.flatten() {
            foreign_keys.push(fk);
        }

        let mut indexes = Vec::new();
        let mut idx_stmt = conn.prepare(&format!("PRAGMA index_list(\"{}\")", escaped))?;
        let idx_list = idx_stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(1)?, row.get::<_, i64>(2)? == 1))
            })?
            .filter_map(|r| r.ok())
            .collect::<Vec<_>>();
        for (idx_name, is_unique) in idx_list {
            let idx_esc = idx_name.replace('"', "\"\"");
            let mut info_stmt = conn.prepare(&format!("PRAGMA index_info(\"{}\")", idx_esc))?;
            let cols = info_stmt
                .query_map([], |r| r.get::<_, String>(2))?
                .filter_map(|r| r.ok())
                .collect::<Vec<_>>();
            indexes.push(NativeDatabaseIndexMeta {
                name: idx_name,
                columns: cols,
                unique: is_unique,
            });
        }

        tables.push(NativeDatabaseTableMeta {
            schema_name: "main".to_string(),
            table_name: name,
            table_type: ttype,
            columns,
            indexes,
            foreign_keys,
        });
    }

    Ok(NativeDatabaseSchemaSnapshot {
        database_name: safe_path.to_string_lossy().to_string(),
        schemas: vec!["main".to_string()],
        tables,
        inspected_at: chrono::Utc::now().timestamp_millis(),
    })
}

pub async fn inspect_database_schema(
    profile: &NativeDatabaseProfileInput,
) -> Result<NativeDatabaseSchemaSnapshot, AppError> {
    match profile.engine.as_str() {
        "sqlite" => inspect_sqlite_schema(&profile.database_name),
        "postgresql" => {
            let password = load_profile_password(profile)?;
            let host = profile.host.as_deref().unwrap_or("127.0.0.1");
            let port = profile.port.unwrap_or(5432);
            let user = profile.username.as_deref().unwrap_or("postgres");
            let conn_str = format!(
                "host={} port={} user={} password={} dbname={}",
                host, port, user, password, profile.database_name
            );
            let (client, connection) =
                tokio_postgres::connect(&conn_str, tokio_postgres::NoTls)
                    .await
                    .map_err(|e| AppError::new("POSTGRES_CONNECT_FAILED", e.to_string(), true))?;
            tokio::spawn(async move {
                let _ = connection.await;
            });

            let rows = client
                .query(
                    "SELECT table_schema, table_name, table_type, column_name, data_type, is_nullable, column_default
                     FROM information_schema.columns
                     JOIN information_schema.tables USING (table_schema, table_name)
                     WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                     ORDER BY table_schema, table_name, ordinal_position",
                    &[],
                )
                .await
                .map_err(|e| AppError::new("POSTGRES_SCHEMA_FAILED", e.to_string(), true))?;

            let mut grouped: BTreeMap<(String, String, String), Vec<NativeDatabaseColumnMeta>> =
                BTreeMap::new();
            let mut schemas_set = std::collections::BTreeSet::new();
            for row in rows {
                let schema: String = row.get(0);
                let table: String = row.get(1);
                let ttype: String = row.get(2);
                let col: String = row.get(3);
                let dtype: String = row.get(4);
                let nullable: String = row.get(5);
                let default_val: Option<String> = row.get(6);
                schemas_set.insert(schema.clone());
                grouped
                    .entry((
                        schema,
                        table,
                        if ttype.to_ascii_lowercase().contains("view") {
                            "view".to_string()
                        } else {
                            "table".to_string()
                        },
                    ))
                    .or_default()
                    .push(NativeDatabaseColumnMeta {
                        name: col,
                        data_type: dtype,
                        nullable: nullable == "YES",
                        is_primary_key: false,
                        default_value: default_val,
                    });
            }

            let tables = grouped
                .into_iter()
                .map(|((schema_name, table_name, table_type), columns)| {
                    NativeDatabaseTableMeta {
                        schema_name,
                        table_name,
                        table_type,
                        columns,
                        indexes: vec![],
                        foreign_keys: vec![],
                    }
                })
                .collect();

            Ok(NativeDatabaseSchemaSnapshot {
                database_name: profile.database_name.clone(),
                schemas: schemas_set.into_iter().collect(),
                tables,
                inspected_at: chrono::Utc::now().timestamp_millis(),
            })
        }
        "mysql" => {
            let password = load_profile_password(profile)?;
            let host = profile.host.as_deref().unwrap_or("127.0.0.1");
            let port = profile.port.unwrap_or(3306);
            let user = profile.username.as_deref().unwrap_or("root");
            let opts = mysql_async::OptsBuilder::default()
                .ip_or_hostname(host)
                .tcp_port(port)
                .user(Some(user))
                .pass(Some(password))
                .db_name(Some(&profile.database_name));
            let pool = mysql_async::Pool::new(opts);
            let mut conn = pool
                .get_conn()
                .await
                .map_err(|e| AppError::new("MYSQL_CONNECT_FAILED", e.to_string(), true))?;

            let rows: Vec<(String, String, String, String, String, Option<String>)> = conn
                .exec(
                    "SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
                     FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = ?
                     ORDER BY TABLE_NAME, ORDINAL_POSITION",
                    (&profile.database_name,),
                )
                .await
                .map_err(|e| AppError::new("MYSQL_SCHEMA_FAILED", e.to_string(), true))?;
            drop(conn);
            let _ = pool.disconnect().await;

            let mut grouped: BTreeMap<(String, String), Vec<NativeDatabaseColumnMeta>> =
                BTreeMap::new();
            for (schema, table, col, dtype, nullable, col_key) in rows {
                grouped
                    .entry((schema, table))
                    .or_default()
                    .push(NativeDatabaseColumnMeta {
                        name: col,
                        data_type: dtype,
                        nullable: nullable == "YES",
                        is_primary_key: col_key.as_deref() == Some("PRI"),
                        default_value: None,
                    });
            }

            let tables = grouped
                .into_iter()
                .map(|((schema_name, table_name), columns)| NativeDatabaseTableMeta {
                    schema_name,
                    table_name,
                    table_type: "table".to_string(),
                    columns,
                    indexes: vec![],
                    foreign_keys: vec![],
                })
                .collect();

            Ok(NativeDatabaseSchemaSnapshot {
                database_name: profile.database_name.clone(),
                schemas: vec![profile.database_name.clone()],
                tables,
                inspected_at: chrono::Utc::now().timestamp_millis(),
            })
        }
        _ => Err(AppError::new("UNSUPPORTED_DB_ENGINE", "Unsupported engine", true)),
    }
}

pub async fn execute_sql_query(
    req: NativeSqlQueryRequest,
    cancel_registry: &DbQueryCancelRegistry,
) -> Result<NativeSqlQueryResult, AppError> {
    if req.sql.trim().is_empty() {
        return Err(AppError::new("EMPTY_SQL", "SQL query cannot be empty", true));
    }
    if req.read_only && !is_read_only_sql(&req.sql) {
        return Err(AppError::new(
            "READ_ONLY_BLOCKED",
            "Write/DDL query blocked because Read-Only safety mode is enabled",
            true,
        ));
    }
    if is_destructive_sql(&req.sql) && !req.confirm_destructive {
        return Err(AppError::new(
            "CONFIRMATION_REQUIRED",
            "Destructive SQL statements (DROP, TRUNCATE, ALTER, or unbounded DELETE/UPDATE) require explicit confirmation",
            true,
        ));
    }

    let cancel_flag = cancel_registry.register(&req.query_id);
    let max_rows = req.max_rows.clamp(1, 5000);
    let timeout = Duration::from_millis(req.timeout_ms.clamp(1000, 60_000));
    let started = Instant::now();

    let exec_future = async {
        match req.profile.engine.as_str() {
            "sqlite" => {
                let safe_path = validate_safe_file_path(&req.profile.database_name, true, None)?;
                let flags = if req.read_only {
                    rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY
                } else {
                    rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE
                };
                let conn = Connection::open_with_flags(safe_path, flags)?;
                if is_read_only_sql(&req.sql) {
                    let mut stmt = conn.prepare(&req.sql)?;
                    let columns: Vec<String> = stmt
                        .column_names()
                        .iter()
                        .map(|s| (*s).to_string())
                        .collect();
                    let mut rows_out = Vec::new();
                    let mut truncated = false;
                    let mut rows = stmt.query([])?;
                    while let Some(row) = rows.next()? {
                        if cancel_flag.load(Ordering::Relaxed) {
                            return Err(AppError::new("QUERY_CANCELLED", "Query cancelled", true));
                        }
                        if rows_out.len() >= max_rows {
                            truncated = true;
                            break;
                        }
                        let mut obj = Map::new();
                        for (idx, col_name) in columns.iter().enumerate() {
                            let val = match row.get_ref(idx)? {
                                ValueRef::Null => Value::Null,
                                ValueRef::Integer(i) => Value::Number(i.into()),
                                ValueRef::Real(f) => serde_json::Number::from_f64(f)
                                    .map(Value::Number)
                                    .unwrap_or(Value::Null),
                                ValueRef::Text(bytes) => {
                                    Value::String(String::from_utf8_lossy(bytes).to_string())
                                }
                                ValueRef::Blob(bytes) => {
                                    Value::String(format!("<blob {} bytes>", bytes.len()))
                                }
                            };
                            obj.insert(col_name.clone(), val);
                        }
                        rows_out.push(obj);
                    }
                    Ok(NativeSqlQueryResult {
                        columns,
                        row_count: rows_out.len(),
                        rows: rows_out,
                        truncated,
                        affected_rows: None,
                        duration_ms: started.elapsed().as_millis() as u64,
                        warnings: if truncated {
                            vec![format!("Results capped at {} rows", max_rows)]
                        } else {
                            vec![]
                        },
                    })
                } else {
                    let affected = conn.execute(&req.sql, [])?;
                    Ok(NativeSqlQueryResult {
                        columns: vec![],
                        rows: vec![],
                        row_count: 0,
                        truncated: false,
                        affected_rows: Some(affected as u64),
                        duration_ms: started.elapsed().as_millis() as u64,
                        warnings: vec![],
                    })
                }
            }
            "postgresql" => {
                let password = load_profile_password(&req.profile)?;
                let host = req.profile.host.as_deref().unwrap_or("127.0.0.1");
                let port = req.profile.port.unwrap_or(5432);
                let user = req.profile.username.as_deref().unwrap_or("postgres");
                let conn_str = format!(
                    "host={} port={} user={} password={} dbname={}",
                    host, port, user, password, req.profile.database_name
                );
                let (client, connection) =
                    tokio_postgres::connect(&conn_str, tokio_postgres::NoTls)
                        .await
                        .map_err(|e| AppError::new("POSTGRES_CONNECT_FAILED", e.to_string(), true))?;
                tokio::spawn(async move {
                    let _ = connection.await;
                });
                if is_read_only_sql(&req.sql) {
                    let pg_rows = client
                        .query(&req.sql, &[])
                        .await
                        .map_err(|e| AppError::new("POSTGRES_QUERY_FAILED", e.to_string(), true))?;
                    let columns: Vec<String> = pg_rows
                        .first()
                        .map(|r| r.columns().iter().map(|c| c.name().to_string()).collect())
                        .unwrap_or_default();
                    let truncated = pg_rows.len() > max_rows;
                    let mut rows_out = Vec::new();
                    for r in pg_rows.into_iter().take(max_rows) {
                        let mut obj = Map::new();
                        for (idx, col) in columns.iter().enumerate() {
                            let val = r
                                .try_get::<_, Option<String>>(idx)
                                .ok()
                                .flatten()
                                .map(Value::String)
                                .or_else(|| {
                                    r.try_get::<_, Option<i64>>(idx)
                                        .ok()
                                        .flatten()
                                        .map(|n| Value::Number(n.into()))
                                })
                                .or_else(|| {
                                    r.try_get::<_, Option<f64>>(idx)
                                        .ok()
                                        .flatten()
                                        .and_then(serde_json::Number::from_f64)
                                        .map(Value::Number)
                                })
                                .or_else(|| {
                                    r.try_get::<_, Option<bool>>(idx)
                                        .ok()
                                        .flatten()
                                        .map(Value::Bool)
                                })
                                .unwrap_or(Value::Null);
                            obj.insert(col.clone(), val);
                        }
                        rows_out.push(obj);
                    }
                    Ok(NativeSqlQueryResult {
                        columns,
                        row_count: rows_out.len(),
                        rows: rows_out,
                        truncated,
                        affected_rows: None,
                        duration_ms: started.elapsed().as_millis() as u64,
                        warnings: if truncated {
                            vec![format!("Results capped at {} rows", max_rows)]
                        } else {
                            vec![]
                        },
                    })
                } else {
                    let affected = client
                        .execute(&req.sql, &[])
                        .await
                        .map_err(|e| AppError::new("POSTGRES_EXEC_FAILED", e.to_string(), true))?;
                    Ok(NativeSqlQueryResult {
                        columns: vec![],
                        rows: vec![],
                        row_count: 0,
                        truncated: false,
                        affected_rows: Some(affected),
                        duration_ms: started.elapsed().as_millis() as u64,
                        warnings: vec![],
                    })
                }
            }
            "mysql" => {
                let password = load_profile_password(&req.profile)?;
                let host = req.profile.host.as_deref().unwrap_or("127.0.0.1");
                let port = req.profile.port.unwrap_or(3306);
                let user = req.profile.username.as_deref().unwrap_or("root");
                let opts = mysql_async::OptsBuilder::default()
                    .ip_or_hostname(host)
                    .tcp_port(port)
                    .user(Some(user))
                    .pass(Some(password))
                    .db_name(Some(&req.profile.database_name));
                let pool = mysql_async::Pool::new(opts);
                let mut conn = pool
                    .get_conn()
                    .await
                    .map_err(|e| AppError::new("MYSQL_CONNECT_FAILED", e.to_string(), true))?;

                let result = if is_read_only_sql(&req.sql) {
                    let my_rows: Vec<mysql_async::Row> = conn
                        .query(&req.sql)
                        .await
                        .map_err(|e| AppError::new("MYSQL_QUERY_FAILED", e.to_string(), true))?;
                    let columns: Vec<String> = my_rows
                        .first()
                        .map(|r| {
                            r.columns_ref()
                                .iter()
                                .map(|c| c.name_str().to_string())
                                .collect()
                        })
                        .unwrap_or_default();
                    let truncated = my_rows.len() > max_rows;
                    let mut rows_out = Vec::new();
                    for r in my_rows.into_iter().take(max_rows) {
                        let mut obj = Map::new();
                        for (idx, col) in columns.iter().enumerate() {
                            let val = r
                                .get_opt::<mysql_async::Value, usize>(idx)
                                .and_then(|v| v.ok())
                                .map(|mv| match mv {
                                    mysql_async::Value::NULL => Value::Null,
                                    mysql_async::Value::Int(i) => Value::Number(i.into()),
                                    mysql_async::Value::UInt(u) => Value::Number(u.into()),
                                    mysql_async::Value::Float(f) => {
                                        serde_json::Number::from_f64(f as f64)
                                            .map(Value::Number)
                                            .unwrap_or(Value::Null)
                                    }
                                    mysql_async::Value::Double(d) => {
                                        serde_json::Number::from_f64(d)
                                            .map(Value::Number)
                                            .unwrap_or(Value::Null)
                                    }
                                    mysql_async::Value::Bytes(b) => {
                                        Value::String(String::from_utf8_lossy(&b).to_string())
                                    }
                                    other => Value::String(format!("{:?}", other)),
                                })
                                .unwrap_or(Value::Null);
                            obj.insert(col.clone(), val);
                        }
                        rows_out.push(obj);
                    }
                    NativeSqlQueryResult {
                        columns,
                        row_count: rows_out.len(),
                        rows: rows_out,
                        truncated,
                        affected_rows: None,
                        duration_ms: started.elapsed().as_millis() as u64,
                        warnings: if truncated {
                            vec![format!("Results capped at {} rows", max_rows)]
                        } else {
                            vec![]
                        },
                    }
                } else {
                    conn.query_drop(&req.sql)
                        .await
                        .map_err(|e| AppError::new("MYSQL_EXEC_FAILED", e.to_string(), true))?;
                    let affected = conn.affected_rows();
                    NativeSqlQueryResult {
                        columns: vec![],
                        rows: vec![],
                        row_count: 0,
                        truncated: false,
                        affected_rows: Some(affected),
                        duration_ms: started.elapsed().as_millis() as u64,
                        warnings: vec![],
                    }
                };

                drop(conn);
                let _ = pool.disconnect().await;
                Ok(result)
            }
            _ => Err(AppError::new("UNSUPPORTED_DB_ENGINE", "Unsupported engine", true)),
        }
    };

    let outcome = tokio::time::timeout(timeout, exec_future).await;
    cancel_registry.remove(&req.query_id);

    match outcome {
        Ok(res) => res,
        Err(_) => Err(AppError::new(
            "QUERY_TIMEOUT",
            format!("Query timed out after {} ms", timeout.as_millis()),
            true,
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_read_only_and_destructive_sql() {
        assert!(is_read_only_sql("SELECT * FROM users LIMIT 10"));
        assert!(is_read_only_sql("PRAGMA table_info(collections)"));
        assert!(!is_read_only_sql("DELETE FROM users WHERE id = 1"));
        assert!(is_destructive_sql("DROP TABLE users"));
        assert!(is_destructive_sql("DELETE FROM users"));
        assert!(!is_destructive_sql("DELETE FROM users WHERE id = 1"));
    }
}
