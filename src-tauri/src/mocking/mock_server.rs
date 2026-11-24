use crate::models::{AppError, MockEndpointRule, MockRequestLog, MockServerConfig, MockServerStatus};
use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, State};
use axum::http::{HeaderMap, HeaderName, HeaderValue, Method, StatusCode, Uri};
use axum::response::IntoResponse;
use axum::Router;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter};
use tokio::sync::{oneshot, Mutex};

const MAX_MOCK_BODY_BYTES: usize = 2 * 1024 * 1024; // 2 MB body cap

struct RunningMockServer {
    bound_address: String,
    port: u16,
    started_at: i64,
    request_count: Arc<AtomicU64>,
    routes: Arc<RwLock<Vec<MockEndpointRule>>>,
    shutdown_tx: Option<oneshot::Sender<()>>,
}

#[derive(Clone)]
struct MockAppState {
    server_id: String,
    routes: Arc<RwLock<Vec<MockEndpointRule>>>,
    request_count: Arc<AtomicU64>,
    app_handle: Option<AppHandle>,
}

#[derive(Default)]
pub struct MockServerManager {
    servers: Mutex<HashMap<String, RunningMockServer>>,
}

impl MockServerManager {
    pub async fn start_server(
        &self,
        config: MockServerConfig,
        app_handle: Option<AppHandle>,
    ) -> Result<MockServerStatus, AppError> {
        let mut servers = self.servers.lock().await;

        // Stop previous instance with same ID if active
        if let Some(mut existing) = servers.remove(&config.id) {
            if let Some(tx) = existing.shutdown_tx.take() {
                let _ = tx.send(());
            }
        }

        // Security-first default: localhost-only binding unless explicitly enabled
        let bind_host = if config.allow_lan_exposure {
            "0.0.0.0"
        } else {
            "127.0.0.1"
        };
        let addr_str = format!("{}:{}", bind_host, config.port);

        let listener = tokio::net::TcpListener::bind(&addr_str).await.map_err(|e| {
            AppError::new(
                "MOCK_PORT_BIND_ERROR",
                format!("Failed to bind mock server on {}: {}", addr_str, e),
                true,
            )
        })?;

        let local_addr = listener.local_addr().map_err(|e| {
            AppError::new("MOCK_PORT_BIND_ERROR", e.to_string(), true)
        })?;
        let actual_port = local_addr.port();
        let bound_str = format!("{}:{}", bind_host, actual_port);

        let routes = Arc::new(RwLock::new(config.endpoints));
        let request_count = Arc::new(AtomicU64::new(0));
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

        let state = MockAppState {
            server_id: config.id.clone(),
            routes: Arc::clone(&routes),
            request_count: Arc::clone(&request_count),
            app_handle,
        };

        let app = Router::new()
            .fallback(handle_mock_request)
            .layer(DefaultBodyLimit::max(MAX_MOCK_BODY_BYTES))
            .with_state(state);

        tokio::spawn(async move {
            let server = axum::serve(listener, app).with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            });
            let _ = server.await;
        });

        let started_at = chrono::Utc::now().timestamp_millis();
        servers.insert(
            config.id.clone(),
            RunningMockServer {
                bound_address: bound_str.clone(),
                port: actual_port,
                started_at,
                request_count: Arc::clone(&request_count),
                routes,
                shutdown_tx: Some(shutdown_tx),
            },
        );

        Ok(MockServerStatus {
            server_id: config.id,
            running: true,
            bound_address: Some(bound_str),
            port: actual_port,
            started_at: Some(started_at),
            request_count: 0,
            last_error: None,
        })
    }

    pub async fn stop_server(&self, server_id: &str) -> Result<MockServerStatus, AppError> {
        let mut servers = self.servers.lock().await;
        if let Some(mut srv) = servers.remove(server_id) {
            let count = srv.request_count.load(Ordering::Relaxed);
            let port = srv.port;
            if let Some(tx) = srv.shutdown_tx.take() {
                let _ = tx.send(());
            }
            return Ok(MockServerStatus {
                server_id: server_id.to_string(),
                running: false,
                bound_address: None,
                port,
                started_at: None,
                request_count: count,
                last_error: None,
            });
        }

        Ok(MockServerStatus {
            server_id: server_id.to_string(),
            running: false,
            bound_address: None,
            port: 0,
            started_at: None,
            request_count: 0,
            last_error: None,
        })
    }

    pub async fn update_routes(&self, config: MockServerConfig) -> Result<(), AppError> {
        let servers = self.servers.lock().await;
        if let Some(srv) = servers.get(&config.id) {
            if let Ok(mut guard) = srv.routes.write() {
                *guard = config.endpoints;
            }
        }
        Ok(())
    }

    pub async fn get_status(&self, server_id: &str) -> Option<MockServerStatus> {
        let servers = self.servers.lock().await;
        servers.get(server_id).map(|srv| MockServerStatus {
            server_id: server_id.to_string(),
            running: true,
            bound_address: Some(srv.bound_address.clone()),
            port: srv.port,
            started_at: Some(srv.started_at),
            request_count: srv.request_count.load(Ordering::Relaxed),
            last_error: None,
        })
    }

    pub fn stop_all_sync(&self) {
        if let Ok(mut servers) = self.servers.try_lock() {
            for (_, mut srv) in servers.drain() {
                if let Some(tx) = srv.shutdown_tx.take() {
                    let _ = tx.send(());
                }
            }
        }
    }
}

fn match_route<'a>(
    routes: &'a [MockEndpointRule],
    method: &str,
    path: &str,
) -> Option<(&'a MockEndpointRule, HashMap<String, String>)> {
    let req_segments: Vec<&str> = path
        .trim_matches('/')
        .split('/')
        .filter(|s| !s.is_empty())
        .collect();

    for rule in routes {
        if !rule.enabled || !rule.method.eq_ignore_ascii_case(method) {
            continue;
        }
        let rule_path = rule.path.split('?').next().unwrap_or(&rule.path);
        let rule_segments: Vec<&str> = rule_path
            .trim_matches('/')
            .split('/')
            .filter(|s| !s.is_empty())
            .collect();

        if rule_segments.len() != req_segments.len() {
            continue;
        }

        let mut path_params = HashMap::new();
        let mut matched = true;
        for (r_seg, req_seg) in rule_segments.iter().zip(req_segments.iter()) {
            if let Some(stripped) = r_seg.strip_prefix(':') {
                path_params.insert(stripped.to_string(), (*req_seg).to_string());
            } else if r_seg.starts_with('{') && r_seg.ends_with('}') && r_seg.len() > 2 {
                let key = &r_seg[1..r_seg.len() - 1];
                path_params.insert(key.to_string(), (*req_seg).to_string());
            } else if r_seg != req_seg {
                matched = false;
                break;
            }
        }

        if matched {
            return Some((rule, path_params));
        }
    }
    None
}

fn render_safe_template(
    template: &str,
    path_params: &HashMap<String, String>,
    query_params: &HashMap<String, String>,
) -> String {
    let mut result = template.to_string();
    result = result.replace("{{$uuid}}", &uuid::Uuid::new_v4().to_string());
    result = result.replace("{{$timestamp}}", &chrono::Utc::now().timestamp().to_string());
    result = result.replace("{{$isoTimestamp}}", &chrono::Utc::now().to_rfc3339());
    for (k, v) in path_params {
        result = result.replace(&format!("{{{{path.{}}}}}", k), v);
    }
    for (k, v) in query_params {
        result = result.replace(&format!("{{{{query.{}}}}}", k), v);
    }
    result
}

async fn handle_mock_request(
    State(state): State<MockAppState>,
    method: Method,
    uri: Uri,
    req_headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    let started = std::time::Instant::now();
    let count = state.request_count.fetch_add(1, Ordering::Relaxed) + 1;

    let path = uri.path().to_string();
    let query = uri.query().unwrap_or("").to_string();
    let query_params: HashMap<String, String> = url::form_urlencoded::parse(query.as_bytes())
        .into_owned()
        .collect();

    let mut headers_map = HashMap::new();
    for (name, val) in req_headers.iter() {
        if let Ok(v) = val.to_str() {
            headers_map.insert(name.to_string(), v.to_string());
        }
    }

    let req_body_str = String::from_utf8_lossy(&body).to_string();

    let matched_rule_opt: Option<(MockEndpointRule, HashMap<String, String>)> = {
        let guard = state.routes.read().ok();
        guard.and_then(|routes| {
            match_route(&routes, method.as_str(), &path).map(|(r, p)| (r.clone(), p))
        })
    };

    let (status, resp_headers, resp_body, matched_id) = if let Some((rule, path_params)) =
        matched_rule_opt
    {
        if rule.delay_ms > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(rule.delay_ms.min(10000))).await;
        }
        let rendered = render_safe_template(&rule.body, &path_params, &query_params);
        let status = StatusCode::from_u16(rule.status_code).unwrap_or(StatusCode::OK);
        let mut out_headers = HeaderMap::new();
        if let Ok(ct) = HeaderValue::from_str(&rule.content_type) {
            out_headers.insert(axum::http::header::CONTENT_TYPE, ct);
        }
        for (k, v) in &rule.headers {
            if let (Ok(hn), Ok(hv)) = (
                HeaderName::from_bytes(k.as_bytes()),
                HeaderValue::from_str(v),
            ) {
                out_headers.insert(hn, hv);
            }
        }
        (status, out_headers, rendered, Some(rule.id))
    } else {
        let mut out_headers = HeaderMap::new();
        out_headers.insert(
            axum::http::header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        );
        let body = serde_json::json!({
            "error": "MOCK_ROUTE_NOT_FOUND",
            "method": method.as_str(),
            "path": path
        })
        .to_string();
        (StatusCode::NOT_FOUND, out_headers, body, None)
    };

    let log_entry = MockRequestLog {
        id: format!("mlog-{}-{}", chrono::Utc::now().timestamp_millis(), count),
        server_id: state.server_id.clone(),
        timestamp: chrono::Utc::now().timestamp_millis(),
        method: method.as_str().to_string(),
        path: path.clone(),
        query,
        headers: headers_map,
        request_body: req_body_str,
        matched_endpoint_id: matched_id,
        response_status: status.as_u16(),
        response_time_ms: started.elapsed().as_millis() as u64,
        remote_addr: Some("127.0.0.1".to_string()),
    };

    if let Some(handle) = &state.app_handle {
        let _ = handle.emit("mock://request-logged", log_entry);
    }

    (status, resp_headers, resp_body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn starts_binds_matches_and_stops_mock_server() {
        let mgr = MockServerManager::default();
        let config = MockServerConfig {
            id: "srv-test".to_string(),
            project_id: "proj-1".to_string(),
            name: "Test Mock".to_string(),
            host: "127.0.0.1".to_string(),
            port: 0,
            allow_lan_exposure: false,
            spec_id: None,
            endpoints: vec![MockEndpointRule {
                id: "ep-1".to_string(),
                server_id: "srv-test".to_string(),
                method: "GET".to_string(),
                path: "/users/:id".to_string(),
                enabled: true,
                status_code: 200,
                headers: HashMap::from([("X-Mock-Test".to_string(), "ok".to_string())]),
                body: r#"{"id":"{{path.id}}","active":true}"#.to_string(),
                content_type: "application/json".to_string(),
                delay_ms: 0,
                description: None,
            }],
        };

        let status = mgr.start_server(config, None).await.unwrap();
        assert!(status.running);
        assert!(status.port > 0);
        assert!(status.bound_address.unwrap().starts_with("127.0.0.1:"));

        let url = format!("http://127.0.0.1:{}/users/42", status.port);
        let resp = reqwest::get(&url).await.unwrap();
        assert_eq!(resp.status(), 200);
        assert_eq!(resp.headers().get("x-mock-test").unwrap(), "ok");
        let text = resp.text().await.unwrap();
        assert!(text.contains(r#""id":"42""#));

        let stopped = mgr.stop_server("srv-test").await.unwrap();
        assert!(!stopped.running);
    }
}
