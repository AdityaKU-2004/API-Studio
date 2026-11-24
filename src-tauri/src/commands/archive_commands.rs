use crate::models::{AppError, ZipArchiveValidationReport};
use crate::utils::archive_security::validate_zip_archive_file;
use crate::utils::path_security::validate_safe_file_path;

#[tauri::command]
pub fn validate_project_zip(zip_path: String) -> Result<ZipArchiveValidationReport, AppError> {
    let safe_path = validate_safe_file_path(&zip_path, true, Some(&["zip"]))?;
    validate_zip_archive_file(&safe_path.to_string_lossy())
}
