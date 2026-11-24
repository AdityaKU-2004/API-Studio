use crate::mocking::mock_server::MockServerManager;
use crate::models::{AppError, MockServerConfig, MockServerStatus};
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn mock_start_server(
    app: AppHandle,
    manager: State<'_, MockServerManager>,
    config: MockServerConfig,
) -> Result<MockServerStatus, AppError> {
    manager.start_server(config, Some(app)).await
}

#[tauri::command]
pub async fn mock_stop_server(
    manager: State<'_, MockServerManager>,
    server_id: String,
) -> Result<MockServerStatus, AppError> {
    manager.stop_server(&server_id).await
}

#[tauri::command]
pub async fn mock_update_routes(
    manager: State<'_, MockServerManager>,
    config: MockServerConfig,
) -> Result<(), AppError> {
    manager.update_routes(config).await
}

#[tauri::command]
pub async fn mock_server_status(
    manager: State<'_, MockServerManager>,
    server_id: String,
) -> Result<Option<MockServerStatus>, AppError> {
    Ok(manager.get_status(&server_id).await)
}
