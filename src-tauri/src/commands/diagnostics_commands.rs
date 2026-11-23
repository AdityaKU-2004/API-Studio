use crate::models::{AppError, DiagnosticLogEntry};
use crate::utils::logger::LogBuffer;
use crate::utils::path_security::validate_safe_file_path;
use tauri::State;

#[tauri::command]
pub async fn get_diagnostic_logs(logs: State<'_, LogBuffer>) -> Result<Vec<DiagnosticLogEntry>, AppError> {
    Ok(logs.list())
}

#[tauri::command]
pub async fn clear_diagnostic_logs(logs: State<'_, LogBuffer>) -> Result<(), AppError> {
    logs.clear();
    Ok(())
}

#[tauri::command]
pub async fn export_diagnostic_logs(
    dest_path: String,
    logs: State<'_, LogBuffer>,
) -> Result<usize, AppError> {
    let safe_path = validate_safe_file_path(&dest_path, false, Some(&["json", "log", "txt"]))?;
    if let Some(parent) = safe_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let entries = logs.list();
    let json = serde_json::to_string_pretty(&entries)?;
    std::fs::write(&safe_path, json)?;
    Ok(entries.len())
}
