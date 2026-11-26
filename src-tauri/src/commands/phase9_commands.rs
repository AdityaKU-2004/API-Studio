use crate::db_tools::db_manager::{
    execute_sql_query, inspect_database_schema, test_database_connection, DbQueryCancelRegistry,
};
use crate::models::{
    AppError, NativeCliExecutionSummary, NativeDatabaseProfileInput, NativeDatabaseSchemaSnapshot,
    NativeMonitorCheckResult, NativeMonitorProbeInput, NativePerformanceRunConfig,
    NativePerformanceRunResult, NativeSecurityHeaderAudit, NativeSqlQueryRequest,
    NativeSqlQueryResult,
};
use crate::monitoring::monitor_service::{
    dispatch_webhook_alert, run_single_probe, MonitorSchedulerManager,
};
use crate::performance::engine::{execute_load_test, PerformanceRunRegistry};
use crate::security_audit::auditor::audit_endpoint_headers_and_tls;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{Emitter, State};

#[tauri::command]
pub async fn perf_run_test(
    config: NativePerformanceRunConfig,
    registry: State<'_, PerformanceRunRegistry>,
) -> Result<NativePerformanceRunResult, AppError> {
    execute_load_test(config, &registry).await
}

#[tauri::command]
pub fn perf_cancel_test(
    run_id: String,
    registry: State<'_, PerformanceRunRegistry>,
) -> Result<bool, AppError> {
    Ok(registry.cancel(&run_id))
}

#[tauri::command]
pub async fn security_audit_endpoint(
    url: String,
    include_tls: bool,
) -> Result<NativeSecurityHeaderAudit, AppError> {
    audit_endpoint_headers_and_tls(&url, include_tls).await
}

#[tauri::command]
pub async fn monitor_run_check(
    probe: NativeMonitorProbeInput,
) -> Result<NativeMonitorCheckResult, AppError> {
    Ok(run_single_probe(&probe).await)
}

#[tauri::command]
pub async fn monitor_start_background(
    app: tauri::AppHandle,
    probe: NativeMonitorProbeInput,
    scheduler: State<'_, MonitorSchedulerManager>,
) -> Result<bool, AppError> {
    let stop_flag = scheduler.register_monitor(&probe.id);
    let interval_secs = probe.interval_seconds.clamp(10, 86_400);

    tokio::spawn(async move {
        while !stop_flag.load(Ordering::Relaxed) {
            let result = run_single_probe(&probe).await;
            let _ = app.emit("monitoring-check-result", &result);

            let sleep_until = tokio::time::Instant::now() + Duration::from_secs(interval_secs);
            while tokio::time::Instant::now() < sleep_until {
                if stop_flag.load(Ordering::Relaxed) {
                    return;
                }
                tokio::time::sleep(Duration::from_millis(250)).await;
            }
        }
    });

    Ok(true)
}

#[tauri::command]
pub fn monitor_stop_background(
    monitor_id: String,
    scheduler: State<'_, MonitorSchedulerManager>,
) -> Result<bool, AppError> {
    Ok(scheduler.stop_monitor(&monitor_id))
}

#[tauri::command]
pub async fn monitor_dispatch_webhook(
    webhook_url: String,
    secret_ref: Option<String>,
    payload: serde_json::Value,
) -> Result<u16, AppError> {
    dispatch_webhook_alert(&webhook_url, secret_ref.as_deref(), &payload).await
}

#[tauri::command]
pub async fn db_tools_test_connection(
    profile: NativeDatabaseProfileInput,
) -> Result<String, AppError> {
    test_database_connection(&profile).await
}

#[tauri::command]
pub async fn db_tools_inspect_schema(
    profile: NativeDatabaseProfileInput,
) -> Result<NativeDatabaseSchemaSnapshot, AppError> {
    inspect_database_schema(&profile).await
}

#[tauri::command]
pub async fn db_tools_execute_query(
    request: NativeSqlQueryRequest,
    cancel_registry: State<'_, DbQueryCancelRegistry>,
) -> Result<NativeSqlQueryResult, AppError> {
    execute_sql_query(request, &cancel_registry).await
}

#[tauri::command]
pub fn db_tools_cancel_query(
    query_id: String,
    cancel_registry: State<'_, DbQueryCancelRegistry>,
) -> Result<bool, AppError> {
    Ok(cancel_registry.cancel(&query_id))
}

#[tauri::command]
pub async fn cli_execute_preview(
    subcommand: String,
    target_url: Option<String>,
    spec_path: Option<String>,
) -> Result<NativeCliExecutionSummary, AppError> {
    match subcommand.as_str() {
        "validate openapi" => Ok(crate::cli::runner::validate_openapi_file(
            spec_path.as_deref().unwrap_or(""),
        )),
        "run security-audit" => Ok(crate::cli::runner::run_security_audit_cli(
            target_url.as_deref().unwrap_or(""),
        )
        .await),
        "run performance-test" => Ok(crate::cli::runner::run_smoke_performance_cli(
            target_url.as_deref().unwrap_or(""),
            5,
            5,
        )
        .await),
        _ => Err(AppError::new(
            "CLI_RUN_DESKTOP_SHELL",
            "Run full CLI collection suites natively using the 'api-studio' binary in your terminal/CI runner",
            true,
        )),
    }
}
