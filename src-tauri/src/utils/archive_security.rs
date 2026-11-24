use crate::models::{AppError, ZipArchiveValidationReport};
use std::fs::File;
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

const MAX_ZIP_ENTRIES: usize = 500;
const MAX_UNCOMPRESSED_BYTES: u64 = 25 * 1024 * 1024;

pub fn is_safe_zip_entry_name(name: &str) -> bool {
    if name.is_empty() || name.contains('\0') {
        return false;
    }
    if name.starts_with('/') || name.starts_with('\\') {
        return false;
    }
    // Reject Windows drive prefix like C:\
    let bytes = name.as_bytes();
    if bytes.len() >= 2 && bytes[1] == b':' {
        return false;
    }
    let normalized = name.replace('\\', "/");
    for seg in normalized.split('/') {
        if seg == ".." {
            return false;
        }
    }
    true
}

pub fn validate_zip_archive_file(zip_path: &str) -> Result<ZipArchiveValidationReport, AppError> {
    let file = File::open(Path::new(zip_path))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| AppError::new("INVALID_ZIP_ARCHIVE", e.to_string(), true))?;

    let mut errors = Vec::new();
    let total_entries = archive.len();
    if total_entries > MAX_ZIP_ENTRIES {
        errors.push(format!(
            "Archive exceeds maximum entry limit ({})",
            MAX_ZIP_ENTRIES
        ));
    }

    let mut total_uncompressed_bytes = 0u64;
    for i in 0..total_entries.min(MAX_ZIP_ENTRIES) {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| AppError::new("INVALID_ZIP_ARCHIVE", e.to_string(), true))?;
        let name = entry.name().to_string();
        if !is_safe_zip_entry_name(&name) {
            errors.push(format!("Blocked unsafe Zip-Slip path: {}", name));
        }

        // Measure actual decompressed size safely instead of trusting header alone
        let mut buf = [0u8; 8192];
        loop {
            let n = entry.read(&mut buf)?;
            if n == 0 {
                break;
            }
            total_uncompressed_bytes += n as u64;
            if total_uncompressed_bytes > MAX_UNCOMPRESSED_BYTES {
                errors.push("Archive uncompressed payload exceeds 25 MB limit".to_string());
                return Ok(ZipArchiveValidationReport {
                    valid: false,
                    total_entries,
                    total_uncompressed_bytes,
                    errors,
                });
            }
        }
    }

    Ok(ZipArchiveValidationReport {
        valid: errors.is_empty(),
        total_entries,
        total_uncompressed_bytes,
        errors,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_zip_slip_paths_and_allows_safe_paths() {
        assert!(is_safe_zip_entry_name("manifest.json"));
        assert!(is_safe_zip_entry_name("specs/users.yaml"));
        assert!(!is_safe_zip_entry_name("../evil.txt"));
        assert!(!is_safe_zip_entry_name("specs/../../etc/passwd"));
        assert!(!is_safe_zip_entry_name("/etc/passwd"));
        assert!(!is_safe_zip_entry_name("C:\\Windows\\System32\\cmd.exe"));
    }
}
