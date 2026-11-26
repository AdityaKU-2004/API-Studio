use crate::models::{AppError, NativeMonitorCheckResult, NativeMonitorProbeInput};
use crate::security::credential_store::CredentialStore;
use reqwest::{Client, Method};
use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio_tungstenite::connect_async;

#[derive(Default)]
pub struct MonitorSchedulerManager {
    active_monitors: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl MonitorSchedulerManager {
    pub fn is_running(&self, monitor_id: &str) -> bool {
        self.active_monitors
            .lock()
            .map(|g| g.contains_key(monitor_id))
            .unwrap_or(false)
    }

    pub fn stop_monitor(&self, monitor_id: &str) -> bool {
        if let Ok(mut guard) = self.active_monitors.lock() {
            if let Some(flag) = guard.remove(monitor_id) {
                flag.store(true, Ordering::SeqCst);
                return true;
            }
        }
        false
    }

    pub fn stop_all_sync(&self) {
        if let Ok(mut guard) = self.active_monitors.lock() {
            for (_, flag) in guard.drain() {
                flag.store(true, Ordering::SeqCst);
            }
        }
    }

    pub fn register_monitor(&self, monitor_id: &str) -> Arc<AtomicBool> {
        let stop_flag = Arc::new(AtomicBool::new(false));
        if let Ok(mut guard) = self.active_monitors.lock() {
            if let Some(prev) = guard.insert(monitor_id.to_string(), Arc::clone(&stop_flag)) {
                prev.store(true, Ordering::SeqCst);
            }
        }
        stop_flag
    }
}

pub fn classify_probe_status(
    success: bool,
    response_time_ms: u64,
    degraded_latency_ms: u64,
) -> String {
    if !success {
        "unavailable".to_string()
    } else if degraded_latency_ms > 0 && response_time_ms > degraded_latency_ms {
        "degraded".to_string()
    } else {
        "healthy".to_string()
    }
}

pub async fn run_single_probe(probe: &NativeMonitorProbeInput) -> NativeMonitorCheckResult {
    let started = Instant::now();
    let timeout = Duration::from_millis(probe.timeout_ms.max(500));
    let expected = if probe.expected_statuses.is_empty() {
        vec![200u16, 201, 204]
    } else {
        probe.expected_statuses.clone()
    };

    let res: Result<(Option<u16>, bool, Option<String>), String> = match probe.protocol.as_str() {
        "tcp" => match tokio::time::timeout(timeout, TcpStream::connect(&probe.endpoint)).await {
            Ok(Ok(_stream)) => Ok((None, true, None)),
            Ok(Err(e)) => Err(format!("TCP connection error: {}", e)),
            Err(_) => Err("TCP connection timed out".to_string()),
        },
        "websocket" => match tokio::time::timeout(timeout, connect_async(&probe.endpoint)).await {
            Ok(Ok((mut ws, resp))) => {
                let _ = ws.close(None).await;
                Ok((Some(resp.status().as_u16()), true, None))
            }
            Ok(Err(e)) => Err(format!("WebSocket handshake failed: {}", e)),
            Err(_) => Err("WebSocket handshake timed out".to_string()),
        },
        _ => {
            // http | graphql | sse
            let client = match Client::builder().timeout(timeout).build() {
                Ok(c) => c,
                Err(e) => {
                    return NativeMonitorCheckResult {
                        id: uuid::Uuid::new_v4().to_string(),
                        monitor_id: probe.id.clone(),
                        timestamp: chrono::Utc::now().timestamp_millis(),
                        status: "unavailable".into(),
                        status_code: None,
                        response_time_ms: started.elapsed().as_millis() as u64,
                        success: false,
                        error_message: Some(e.to_string()),
                    }
                }
            };

            let method = Method::from_bytes(probe.method.as_bytes()).unwrap_or(Method::GET);
            let mut builder = client.request(method, &probe.endpoint);
            for (k, v) in &probe.headers {
                builder = builder.header(k, v);
            }
            if probe.protocol == "sse" && !probe.headers.contains_key("Accept") {
                builder = builder.header("Accept", "text/event-stream");
            }
            if let Some(body) = &probe.body {
                if !body.is_empty() {
                    builder = builder.body(body.clone());
                }
            }

            match builder.send().await {
                Ok(resp) => {
                    let code = resp.status().as_u16();
                    let status_ok = expected.contains(&code);
                    if probe.protocol == "sse" {
                        Ok((
                            Some(code),
                            status_ok,
                            if status_ok {
                                None
                            } else {
                                Some(format!("Unexpected SSE HTTP status {}", code))
                            },
                        ))
                    } else {
                        let body_text = resp.text().await.unwrap_or_default();
                        let content_ok = match &probe.expected_content_substring {
                            Some(needle) if !needle.trim().is_empty() => body_text.contains(needle),
                            _ => true,
                        };
                        let ok = status_ok && content_ok;
                        let msg = if !status_ok {
                            Some(format!("HTTP status {} outside expected {:?}", code, expected))
                        } else if !content_ok {
                            Some("Expected response substring was not matched".to_string())
                        } else {
                            None
                        };
                        Ok((Some(code), ok, msg))
                    }
                }
                Err(e) => Err(e.to_string()),
            }
        }
    };

    let elapsed_ms = started.elapsed().as_millis() as u64;
    match res {
        Ok((code, success, error_message)) => NativeMonitorCheckResult {
            id: uuid::Uuid::new_v4().to_string(),
            monitor_id: probe.id.clone(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            status: classify_probe_status(success, elapsed_ms, probe.degraded_latency_ms),
            status_code: code,
            response_time_ms: elapsed_ms,
            success,
            error_message,
        },
        Err(err) => NativeMonitorCheckResult {
            id: uuid::Uuid::new_v4().to_string(),
            monitor_id: probe.id.clone(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            status: "unavailable".into(),
            status_code: None,
            response_time_ms: elapsed_ms,
            success: false,
            error_message: Some(err),
        },
    }
}

pub async fn dispatch_webhook_alert(
    webhook_url: &str,
    secret_ref: Option<&str>,
    payload: &serde_json::Value,
) -> Result<u16, AppError> {
    let trimmed = webhook_url.trim();
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err(AppError::new(
            "INVALID_WEBHOOK_URL",
            "Webhook URL must use http:// or https://",
            true,
        ));
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::new("CLIENT_INIT_FAILED", e.to_string(), false))?;

    let mut req = client.post(trimmed).json(payload);
    if let Some(ref_key) = secret_ref {
        if let Ok(Some(secret)) = CredentialStore::get_secret(ref_key) {
            req = req.header("X-API-Studio-Webhook-Token", secret);
        }
    }

    let resp = req
        .send()
        .await
        .map_err(|e| AppError::new("WEBHOOK_DISPATCH_FAILED", e.to_string(), true))?;
    Ok(resp.status().as_u16())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_health_status_properly() {
        assert_eq!(classify_probe_status(false, 50, 500), "unavailable");
        assert_eq!(classify_probe_status(true, 650, 500), "degraded");
        assert_eq!(classify_probe_status(true, 120, 500), "healthy");
    }
}
