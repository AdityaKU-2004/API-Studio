use crate::models::{AppError, NativeHttpRequest, NativeHttpResponse, NativeProxyConfig};
use crate::networking::http_client::{execute_http_request as run_http, HttpCancelRegistry};
use crate::networking::proxy_manager::ProxyState;
use crate::utils::logger::LogBuffer;
use tauri::State;

#[tauri::command]
pub async fn execute_http_request(
    request: NativeHttpRequest,
    proxy_state: State<'_, ProxyState>,
    cancel_registry: State<'_, HttpCancelRegistry>,
    logs: State<'_, LogBuffer>,
) -> Result<NativeHttpResponse, AppError> {
    let global_proxy = proxy_state.get_global_proxy();
    run_http(request, global_proxy.as_ref(), &cancel_registry, Some(&logs)).await
}

#[tauri::command]
pub async fn cancel_http_request(
    tab_id: String,
    cancel_registry: State<'_, HttpCancelRegistry>,
) -> Result<bool, AppError> {
    Ok(cancel_registry.cancel(&tab_id))
}

#[tauri::command]
pub async fn set_global_proxy_config(
    config: Option<NativeProxyConfig>,
    proxy_state: State<'_, ProxyState>,
    logs: State<'_, LogBuffer>,
) -> Result<(), AppError> {
    proxy_state.set_global_proxy(config.clone())?;
    let msg = match config {
        Some(c) if c.enabled => format!("Global proxy enabled ({}://{}:{})", c.protocol, c.host, c.port),
        _ => "Global proxy disabled".to_string(),
    };
    logs.record("info", "proxy_manager", msg);
    Ok(())
}

#[tauri::command]
pub async fn get_global_proxy_config(
    proxy_state: State<'_, ProxyState>,
) -> Result<Option<NativeProxyConfig>, AppError> {
    let mut cfg = proxy_state.get_global_proxy();
    // Never leak stored plain proxy password over IPC back to UI once saved
    if let Some(ref mut c) = cfg {
        if c.password.is_some() {
            c.password = Some("********".to_string());
        }
    }
    Ok(cfg)
}
