use crate::models::AppError;
use std::path::{Component, Path, PathBuf};

pub const MAX_IMPORT_FILE_BYTES: u64 = 50 * 1024 * 1024; // 50 MB guard

/// Validates a user-provided filesystem path before reading or writing.
/// Rejects NUL bytes, path traversal components (`..`), and enforces allowed extensions when given.
pub fn validate_safe_file_path(
    raw_path: &str,
    must_exist: bool,
    allowed_extensions: Option<&[&str]>,
) -> Result<PathBuf, AppError> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() || trimmed.contains('\0') {
        return Err(AppError::new(
            "INVALID_PATH",
            "File path is empty or contains invalid characters",
            true,
        ));
    }

    let candidate = Path::new(trimmed);

    for comp in candidate.components() {
        if matches!(comp, Component::ParentDir) {
            return Err(AppError::new(
                "PATH_TRAVERSAL_REJECTED",
                "Path traversal ('..') is not allowed",
                false,
            ));
        }
    }

    if let Some(exts) = allowed_extensions {
        let ext = candidate
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_ascii_lowercase())
            .unwrap_or_default();
        if !exts.iter().any(|allowed| allowed.eq_ignore_ascii_case(&ext)) {
            return Err(AppError::new(
                "UNSUPPORTED_FILE_EXTENSION",
                format!("File extension '.{}' is not allowed for this operation", ext),
                true,
            ));
        }
    }

    if must_exist {
        let canonical = candidate.canonicalize().map_err(|e| {
            AppError::new("FILE_NOT_FOUND", "Target file does not exist or is unreadable", true)
                .with_details(e.to_string())
        })?;
        let meta = std::fs::metadata(&canonical)?;
        if !meta.is_file() {
            return Err(AppError::new(
                "NOT_A_FILE",
                "Selected path must reference a regular file",
                true,
            ));
        }
        if meta.len() > MAX_IMPORT_FILE_BYTES {
            return Err(AppError::new(
                "FILE_TOO_LARGE",
                format!(
                    "File exceeds maximum supported size ({} MB)",
                    MAX_IMPORT_FILE_BYTES / (1024 * 1024)
                ),
                true,
            ));
        }
        Ok(canonical)
    } else {
        let parent = candidate.parent().ok_or_else(|| {
            AppError::new("INVALID_PATH", "Target path has no parent directory", true)
        })?;
        if !parent.as_os_str().is_empty() && parent.exists() {
            let canon_parent = parent.canonicalize()?;
            let file_name = candidate.file_name().ok_or_else(|| {
                AppError::new("INVALID_PATH", "Target path has no file name", true)
            })?;
            Ok(canon_parent.join(file_name))
        } else {
            Ok(candidate.to_path_buf())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_parent_traversal() {
        let res = validate_safe_file_path("../../etc/passwd", false, None);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().code, "PATH_TRAVERSAL_REJECTED");
    }

    #[test]
    fn rejects_empty_and_nul_bytes() {
        assert!(validate_safe_file_path("", false, None).is_err());
        assert!(validate_safe_file_path("foo\0bar.json", false, None).is_err());
    }

    #[test]
    fn enforces_allowed_extensions() {
        let res = validate_safe_file_path("collection.exe", false, Some(&["json", "csv"]));
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().code, "UNSUPPORTED_FILE_EXTENSION");
    }
}
