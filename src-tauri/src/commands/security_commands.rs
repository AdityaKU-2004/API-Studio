use crate::models::{AppError, KeyringStatus};
use crate::security::credential_store::CredentialStore;
use crate::utils::logger::LogBuffer;
use tauri::State;

#[tauri::command]
pub async fn keyring_status() -> Result<KeyringStatus, AppError> {
    Ok(CredentialStore::check_availability())
}

#[tauri::command]
pub async fn generate_credential_ref(prefix: String) -> Result<String, AppError> {
    Ok(CredentialStore::generate_reference(&prefix))
}

#[tauri::command]
pub async fn store_secret(
    reference: String,
    secret_value: String,
    logs: State<'_, LogBuffer>,
) -> Result<(), AppError> {
    CredentialStore::store_secret(&reference, &secret_value)?;
    logs.record("info", "security", format!("Stored secret under reference {}", reference));
    Ok(())
}

#[tauri::command]
pub async fn get_secret(reference: String) -> Result<Option<String>, AppError> {
    CredentialStore::get_secret(&reference)
}

#[tauri::command]
pub async fn delete_secret(
    reference: String,
    logs: State<'_, LogBuffer>,
) -> Result<bool, AppError> {
    let deleted = CredentialStore::delete_secret(&reference)?;
    logs.record("info", "security", format!("Deleted credential reference {}", reference));
    Ok(deleted)
}
