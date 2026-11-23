use crate::models::{AppError, NativeWsConnectPayload, NativeWsSendPayload};
use crate::networking::websocket_manager::WebSocketManager;
use crate::utils::logger::LogBuffer;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn ws_connect(
    app: AppHandle,
    payload: NativeWsConnectPayload,
    ws_manager: State<'_, WebSocketManager>,
    logs: State<'_, LogBuffer>,
) -> Result<(), AppError> {
    logs.record("info", "websocket", format!("Connecting WebSocket session {}", payload.session_id));
    ws_manager.connect(app, payload)
}

#[tauri::command]
pub async fn ws_send(
    payload: NativeWsSendPayload,
    ws_manager: State<'_, WebSocketManager>,
) -> Result<(), AppError> {
    ws_manager.send(payload).await
}

#[tauri::command]
pub async fn ws_disconnect(
    session_id: String,
    ws_manager: State<'_, WebSocketManager>,
) -> Result<bool, AppError> {
    Ok(ws_manager.disconnect(&session_id))
}
