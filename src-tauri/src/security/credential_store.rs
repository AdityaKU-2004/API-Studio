use crate::models::{AppError, KeyringStatus};
use keyring::Entry;
use uuid::Uuid;

pub const KEYRING_SERVICE_NAME: &str = "com.apistudio.app";

pub struct CredentialStore;

impl CredentialStore {
    pub fn backend_label() -> &'static str {
        if cfg!(target_os = "macos") {
            "macOS Keychain"
        } else if cfg!(target_os = "windows") {
            "Windows Credential Manager"
        } else {
            "Linux Secret Service (libsecret / D-Bus)"
        }
    }

    pub fn generate_reference(prefix: &str) -> String {
        let clean = prefix
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
            .collect::<String>();
        let scope = if clean.is_empty() { "secret" } else { &clean };
        format!("apistudio:{}:{}", scope, Uuid::new_v4())
    }

    pub fn validate_reference(reference: &str) -> Result<(), AppError> {
        let trimmed = reference.trim();
        if trimmed.is_empty() || trimmed.len() > 256 || trimmed.contains('\0') {
            return Err(AppError::new(
                "INVALID_CREDENTIAL_REF",
                "Credential reference identifier is empty or malformed",
                true,
            ));
        }
        Ok(())
    }

    /// Checks whether the OS credential store is reachable without persisting permanent secrets.
    /// Never silently falls back to plaintext storage if unavailable.
    pub fn check_availability() -> KeyringStatus {
        let probe_key = "apistudio:health_probe";
        match Entry::new(KEYRING_SERVICE_NAME, probe_key) {
            Ok(entry) => match entry.get_password() {
                Ok(_) | Err(keyring::Error::NoEntry) => KeyringStatus {
                    available: true,
                    backend: Self::backend_label().to_string(),
                    error: None,
                },
                Err(err) => KeyringStatus {
                    available: false,
                    backend: Self::backend_label().to_string(),
                    error: Some(format!("OS credential store unavailable: {}", err)),
                },
            },
            Err(err) => KeyringStatus {
                available: false,
                backend: Self::backend_label().to_string(),
                error: Some(format!("Failed to initialize OS credential store: {}", err)),
            },
        }
    }

    pub fn store_secret(reference: &str, secret_value: &str) -> Result<(), AppError> {
        Self::validate_reference(reference)?;
        let entry = Entry::new(KEYRING_SERVICE_NAME, reference).map_err(|e| {
            AppError::new(
                "CREDENTIAL_STORE_UNAVAILABLE",
                "Unable to access OS secure credential storage; secret was not saved",
                true,
            )
            .with_details(e.to_string())
        })?;

        entry.set_password(secret_value).map_err(|e| {
            AppError::new(
                "CREDENTIAL_STORE_WRITE_FAILED",
                "OS credential store rejected storing the secret; plaintext fallback is disabled",
                true,
            )
            .with_details(e.to_string())
        })?;

        Ok(())
    }

    pub fn get_secret(reference: &str) -> Result<Option<String>, AppError> {
        Self::validate_reference(reference)?;
        let entry = Entry::new(KEYRING_SERVICE_NAME, reference).map_err(|e| {
            AppError::new(
                "CREDENTIAL_STORE_UNAVAILABLE",
                "Unable to access OS secure credential storage",
                true,
            )
            .with_details(e.to_string())
        })?;

        match entry.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(AppError::new(
                "CREDENTIAL_STORE_READ_FAILED",
                "Failed to read secret from OS credential store",
                true,
            )
            .with_details(e.to_string())),
        }
    }

    pub fn delete_secret(reference: &str) -> Result<bool, AppError> {
        Self::validate_reference(reference)?;
        let entry = Entry::new(KEYRING_SERVICE_NAME, reference).map_err(|e| {
            AppError::new(
                "CREDENTIAL_STORE_UNAVAILABLE",
                "Unable to access OS secure credential storage",
                true,
            )
            .with_details(e.to_string())
        })?;

        match entry.delete_credential() {
            Ok(()) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(e) => Err(AppError::new(
                "CREDENTIAL_STORE_DELETE_FAILED",
                "Failed to delete secret from OS credential store",
                true,
            )
            .with_details(e.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_namespaced_credential_reference() {
        let r = CredentialStore::generate_reference("proxy_auth");
        assert!(r.starts_with("apistudio:proxy_auth:"));
        assert!(CredentialStore::validate_reference(&r).is_ok());
    }

    #[test]
    fn rejects_empty_or_nul_credential_reference() {
        assert!(CredentialStore::validate_reference("").is_err());
        assert!(CredentialStore::validate_reference("   ").is_err());
        assert!(CredentialStore::validate_reference("bad\0ref").is_err());
    }
}
