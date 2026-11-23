use crate::models::{AppError, NativeSseConnectPayload};
use crate::networking::proxy_manager::ProxyState;
use crate::networking::sse_manager::SseManager;
use crate::utils::logger::LogBuffer;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn sse_connect(
    app: AppHandle,
    payload: NativeSseConnectPayload,
    sse_manager: State<'_, SseManager>,
    proxy_state: State<'_, ProxyState>,
    logs: State<'_, LogBuffer>,
) -> Result<(), AppError> {
    logs.record("info", "sse", format!("Starting SSE stream session {}", payload.session_id));
    sse_manager.connect(app, payload, proxy_state.get_global_proxy())
}

#[tauri::command]
pub async fn sse_disconnect(
    session_id: String,
    sse_manager: State<'_, SseManager>,
) -> Result<bool, AppError> {
    Ok(sse_manager.disconnect(&session_id))
}
