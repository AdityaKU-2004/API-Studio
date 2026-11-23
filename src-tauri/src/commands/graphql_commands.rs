use crate::models::{
    AppError, NativeGraphqlExecutePayload, NativeGraphqlSubscriptionPayload, NativeHttpResponse,
};
use crate::networking::graphql_client::{execute_graphql_http, GraphqlSubscriptionManager};
use crate::networking::http_client::HttpCancelRegistry;
use crate::networking::proxy_manager::ProxyState;
use crate::utils::logger::LogBuffer;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn execute_graphql_request(
    payload: NativeGraphqlExecutePayload,
    proxy_state: State<'_, ProxyState>,
    cancel_registry: State<'_, HttpCancelRegistry>,
    logs: State<'_, LogBuffer>,
) -> Result<NativeHttpResponse, AppError> {
    let global_proxy = proxy_state.get_global_proxy();
    execute_graphql_http(payload, global_proxy.as_ref(), &cancel_registry, Some(&logs)).await
}

#[tauri::command]
pub async fn cancel_graphql_request(
    tab_id: String,
    cancel_registry: State<'_, HttpCancelRegistry>,
) -> Result<bool, AppError> {
    Ok(cancel_registry.cancel(&tab_id))
}

#[tauri::command]
pub async fn graphql_subscribe(
    app: AppHandle,
    payload: NativeGraphqlSubscriptionPayload,
    sub_manager: State<'_, GraphqlSubscriptionManager>,
    logs: State<'_, LogBuffer>,
) -> Result<(), AppError> {
    logs.record("info", "graphql", format!("Starting GraphQL subscription {}", payload.session_id));
    sub_manager.start_subscription(app, payload)
}

#[tauri::command]
pub async fn graphql_unsubscribe(
    session_id: String,
    sub_manager: State<'_, GraphqlSubscriptionManager>,
) -> Result<bool, AppError> {
    Ok(sub_manager.stop_subscription(&session_id))
}
