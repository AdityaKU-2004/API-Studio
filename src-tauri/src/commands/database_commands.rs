use crate::database::connection::DbState;
use crate::database::repositories::{
    backup_sqlite_database, clear_entity_table, delete_entity_by_id, get_database_status,
    import_indexeddb_payload, list_entities_json, restore_sqlite_database, save_entity_json,
};
use crate::models::{AppError, DatabaseStatus, IndexedDbMigrationPayload, MigrationReport};
use crate::utils::logger::LogBuffer;
use crate::utils::path_security::validate_safe_file_path;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn db_status(db: State<'_, DbState>) -> Result<DatabaseStatus, AppError> {
    let path = db.db_path.clone();
    db.with_conn(move |conn| get_database_status(conn, &path)).await
}

#[tauri::command]
pub async fn db_list_entities(
    entity: String,
    db: State<'_, DbState>,
) -> Result<Vec<Value>, AppError> {
    db.with_conn(move |conn| list_entities_json(conn, &entity)).await
}

#[tauri::command]
pub async fn db_save_entity(
    entity: String,
    item: Value,
    db: State<'_, DbState>,
) -> Result<(), AppError> {
    db.with_conn(move |conn| save_entity_json(conn, &entity, &item)).await
}

#[tauri::command]
pub async fn db_delete_entity(
    entity: String,
    id: String,
    db: State<'_, DbState>,
) -> Result<bool, AppError> {
    db.with_conn(move |conn| delete_entity_by_id(conn, &entity, &id)).await
}

#[tauri::command]
pub async fn db_clear_entity(entity: String, db: State<'_, DbState>) -> Result<(), AppError> {
    db.with_conn(move |conn| clear_entity_table(conn, &entity)).await
}

#[tauri::command]
pub async fn db_import_indexeddb(
    payload: IndexedDbMigrationPayload,
    db: State<'_, DbState>,
    logs: State<'_, LogBuffer>,
) -> Result<MigrationReport, AppError> {
    let report = db
        .with_conn(move |conn| import_indexeddb_payload(conn, &payload))
        .await?;
    logs.record(
        "info",
        "sqlite_migration",
        format!(
            "IndexedDB->SQLite migration completed in {} ms",
            report.duration_ms
        ),
    );
    Ok(report)
}

#[tauri::command]
pub async fn db_backup(
    dest_path: String,
    db: State<'_, DbState>,
    logs: State<'_, LogBuffer>,
) -> Result<String, AppError> {
    let safe_dest = validate_safe_file_path(&dest_path, false, Some(&["db", "sqlite", "sqlite3"]))?;
    let safe_clone = safe_dest.clone();
    db.with_conn(move |conn| backup_sqlite_database(conn, &safe_clone)).await?;
    let display = safe_dest.to_string_lossy().to_string();
    logs.record("info", "sqlite_backup", format!("SQLite backup written to {}", display));
    Ok(display)
}

#[tauri::command]
pub async fn db_restore(
    src_path: String,
    db: State<'_, DbState>,
    logs: State<'_, LogBuffer>,
) -> Result<(), AppError> {
    let safe_src = validate_safe_file_path(&src_path, true, Some(&["db", "sqlite", "sqlite3"]))?;
    db.with_conn(move |conn| restore_sqlite_database(conn, &safe_src)).await?;
    logs.record("info", "sqlite_restore", "SQLite database restored cleanly");
    Ok(())
}
