pub mod cli;
pub mod commands;
pub mod database;
pub mod db_tools;
pub mod git;
pub mod mocking;
pub mod models;
pub mod monitoring;
pub mod networking;
pub mod performance;
pub mod security;
pub mod security_audit;
pub mod utils;

use commands::{
    archive_commands, certificate_commands, database_commands, diagnostics_commands, file_commands,
    git_commands, graphql_commands, http_commands, mock_commands, phase9_commands,
    security_commands, sse_commands, websocket_commands,
};
use database::connection::DbState;
use db_tools::db_manager::DbQueryCancelRegistry;
use mocking::mock_server::MockServerManager;
use monitoring::monitor_service::MonitorSchedulerManager;
use networking::graphql_client::GraphqlSubscriptionManager;
use networking::http_client::HttpCancelRegistry;
use networking::proxy_manager::ProxyState;
use networking::sse_manager::SseManager;
use networking::websocket_manager::WebSocketManager;
use performance::engine::PerformanceRunRegistry;
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
            app.manage(MockServerManager::default());
            app.manage(PerformanceRunRegistry::default());
            app.manage(MonitorSchedulerManager::default());
            app.manage(DbQueryCancelRegistry::default());
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
            mock_commands::mock_start_server,
            mock_commands::mock_stop_server,
            mock_commands::mock_update_routes,
            mock_commands::mock_server_status,
            git_commands::git_init_repo,
            git_commands::git_status,
            git_commands::git_stage_paths,
            git_commands::git_unstage_paths,
            git_commands::git_scan_staged_secrets,
            git_commands::git_commit_changes,
            git_commands::git_list_commits,
            git_commands::git_list_branches,
            git_commands::git_create_branch,
            git_commands::git_switch_branch,
            git_commands::git_diff_file,
            git_commands::git_discard_changes,
            archive_commands::validate_project_zip,
            phase9_commands::perf_run_test,
            phase9_commands::perf_cancel_test,
            phase9_commands::security_audit_endpoint,
            phase9_commands::monitor_run_check,
            phase9_commands::monitor_start_background,
            phase9_commands::monitor_stop_background,
            phase9_commands::monitor_dispatch_webhook,
            phase9_commands::db_tools_test_connection,
            phase9_commands::db_tools_inspect_schema,
            phase9_commands::db_tools_execute_query,
            phase9_commands::db_tools_cancel_query,
            phase9_commands::cli_execute_preview,
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
            if let Some(mock_mgr) = app_handle.try_state::<MockServerManager>() {
                mock_mgr.stop_all_sync();
            }
            if let Some(perf_mgr) = app_handle.try_state::<PerformanceRunRegistry>() {
                perf_mgr.cancel_all();
            }
            if let Some(mon_mgr) = app_handle.try_state::<MonitorSchedulerManager>() {
                mon_mgr.stop_all_sync();
            }
        }
    });
}
