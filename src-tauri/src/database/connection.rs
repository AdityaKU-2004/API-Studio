use crate::database::migrations::run_migrations;
use crate::models::AppError;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub struct DbState {
    pub conn: Arc<Mutex<Connection>>,
    pub db_path: PathBuf,
    pub schema_version: i64,
}

impl DbState {
    pub fn open(db_path: PathBuf) -> Result<Self, AppError> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut conn = Connection::open(&db_path)?;
        conn.execute_batch(
            "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;",
        )?;

        let schema_version = run_migrations(&mut conn)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            db_path,
            schema_version,
        })
    }

    pub async fn with_conn<F, R>(&self, op: F) -> Result<R, AppError>
    where
        F: FnOnce(&mut Connection) -> Result<R, AppError> + Send + 'static,
        R: Send + 'static,
    {
        let conn_arc = Arc::clone(&self.conn);
        tokio::task::spawn_blocking(move || {
            let mut guard = conn_arc.lock().map_err(|_| {
                AppError::new("DATABASE_LOCK_ERROR", "SQLite connection lock poisoned", false)
            })?;
            op(&mut guard)
        })
        .await
        .map_err(|e| {
            AppError::new("DATABASE_TASK_ERROR", "SQLite worker task failed", true)
                .with_details(e.to_string())
        })?
    }
}
