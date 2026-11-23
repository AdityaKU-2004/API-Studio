use crate::models::{AppError, NativeReadFileResult, NativeSaveFilePayload};
use crate::utils::path_security::validate_safe_file_path;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

#[tauri::command]
pub async fn read_native_file(
    path: String,
    allowed_extensions: Option<Vec<String>>,
) -> Result<NativeReadFileResult, AppError> {
    let ext_refs: Option<Vec<&str>> = allowed_extensions
        .as_ref()
        .map(|list| list.iter().map(|s| s.as_str()).collect());
    let safe_path = validate_safe_file_path(&path, true, ext_refs.as_deref())?;

    let bytes = std::fs::read(&safe_path)?;
    let size_bytes = bytes.len();
    let file_name = safe_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();

    let is_binary = std::str::from_utf8(&bytes).is_err();
    let content_utf8 = if is_binary {
        None
    } else {
        Some(String::from_utf8_lossy(&bytes).into_owned())
    };
    let content_base64 = BASE64.encode(&bytes);

    Ok(NativeReadFileResult {
        path: safe_path.to_string_lossy().to_string(),
        file_name,
        size_bytes,
        content_utf8,
        content_base64,
        is_binary,
    })
}

#[tauri::command]
pub async fn save_native_file(payload: NativeSaveFilePayload) -> Result<usize, AppError> {
    let safe_path = validate_safe_file_path(&payload.path, false, None)?;
    if let Some(parent) = safe_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let bytes = if let Some(b64) = payload.content_base64 {
        BASE64.decode(b64).map_err(|e| {
            AppError::new("INVALID_BASE64_CONTENT", "Invalid base64 file payload", true)
                .with_details(e.to_string())
        })?
    } else {
        payload.content_utf8.unwrap_or_default().into_bytes()
    };

    let len = bytes.len();
    std::fs::write(&safe_path, bytes)?;
    Ok(len)
}
