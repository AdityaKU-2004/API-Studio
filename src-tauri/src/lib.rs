pub mod commands;
pub mod database;
pub mod models;
pub mod networking;
pub mod security;
pub mod utils;

use commands::{
    certificate_commands, database_commands, diagnostics_commands, file_commands, graphql_commands,
    http_commands, security_commands, sse_commands, websocket_commands,
};
use database::connection::DbState;
use networking::graphql_client::GraphqlSubscriptionManager;
use networking::http_client::HttpCancelRegistry;
use networking::proxy_manager::ProxyState;
use networking::sse_manager::SseManager;
use networking::websocket_manager::WebSocketManager;
use tauri::{Manager, RunEvent};
use utils::logger::LogBuffer;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter("api_studio=info,warn")
        .try_init();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let db_path = app_data_dir.join("api-studio.db");
            let db_state = DbState::open(db_path).map_err(|e| {
                std::io::Error::new(std::io::ErrorKind::Other, e.to_string())
            })?;

            let log_buf = LogBuffer::default();
            log_buf.record(
                "info",
                "bootstrap",
                format!(
                    "Initialized SQLite storage (schema v{})",
                    db_state.schema_version
                ),
            );

            app.manage(db_state);
            app.manage(ProxyState::default());
            app.manage(HttpCancelRegistry::default());
            app.manage(WebSocketManager::default());
            app.manage(SseManager::default());
            app.manage(GraphqlSubscriptionManager::default());
            app.manage(log_buf);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            http_commands::execute_http_request,
            http_commands::cancel_http_request,
            http_commands::set_global_proxy_config,
            http_commands::get_global_proxy_config,
            websocket_commands::ws_connect,
            websocket_commands::ws_send,
            websocket_commands::ws_disconnect,
            sse_commands::sse_connect,
            sse_commands::sse_disconnect,
            graphql_commands::execute_graphql_request,
            graphql_commands::cancel_graphql_request,
            graphql_commands::graphql_subscribe,
            graphql_commands::graphql_unsubscribe,
            database_commands::db_status,
            database_commands::db_list_entities,
            database_commands::db_save_entity,
            database_commands::db_delete_entity,
            database_commands::db_clear_entity,
            database_commands::db_import_indexeddb,
            database_commands::db_backup,
            database_commands::db_restore,
            file_commands::read_native_file,
            file_commands::save_native_file,
            security_commands::keyring_status,
            security_commands::generate_credential_ref,
            security_commands::store_secret,
            security_commands::get_secret,
            security_commands::delete_secret,
            certificate_commands::inspect_certificate,
            diagnostics_commands::get_diagnostic_logs,
            diagnostics_commands::clear_diagnostic_logs,
            diagnostics_commands::export_diagnostic_logs,
        ])
        .build(tauri::generate_context!())
        .expect("Failed to build API Studio Tauri desktop application");

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
            if let Some(reg) = app_handle.try_state::<HttpCancelRegistry>() {
                reg.cancel_all();
            }
            if let Some(ws) = app_handle.try_state::<WebSocketManager>() {
                ws.disconnect_all();
            }
            if let Some(sse) = app_handle.try_state::<SseManager>() {
                sse.disconnect_all();
            }
            if let Some(gql) = app_handle.try_state::<GraphqlSubscriptionManager>() {
                gql.stop_all();
            }
        }
    });
}
