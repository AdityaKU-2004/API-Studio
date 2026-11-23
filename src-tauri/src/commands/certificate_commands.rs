use crate::models::{AppError, NativeCertificateInspectionResult};
use crate::networking::certificate_inspector::inspect_tls_certificate;
use crate::utils::logger::LogBuffer;
use tauri::State;

#[tauri::command]
pub async fn inspect_certificate(
    target: String,
    port: Option<u16>,
    logs: State<'_, LogBuffer>,
) -> Result<NativeCertificateInspectionResult, AppError> {
    logs.record("info", "tls_inspector", format!("Inspecting TLS certificate for {}", target));
    inspect_tls_certificate(&target, port.unwrap_or(443)).await
}
