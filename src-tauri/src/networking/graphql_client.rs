use crate::models::{
    AppError, NativeGraphqlExecutePayload, NativeGraphqlSubscriptionPayload, NativeHttpRequest,
    NativeHttpResponse, NativeProxyConfig,
};
use crate::networking::http_client::{execute_http_request, HttpCancelRegistry};
use crate::utils::logger::LogBuffer;
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::tungstenite::Message;

pub struct GraphqlSubscriptionManager {
    sessions: Mutex<HashMap<String, oneshot::Sender<()>>>,
}

impl Default for GraphqlSubscriptionManager {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

pub async fn execute_graphql_http(
    payload: NativeGraphqlExecutePayload,
    global_proxy: Option<&NativeProxyConfig>,
    cancel_registry: &HttpCancelRegistry,
    logs: Option<&LogBuffer>,
) -> Result<NativeHttpResponse, AppError> {
    let method = payload.method.trim().to_ascii_uppercase();
    let mut headers = payload.headers;
    let mut target_url = payload.endpoint.trim().to_string();
    let mut body_mode = "none".to_string();
    let mut raw_body = None;

    if method == "GET" {
        let mut parsed = url::Url::parse(&target_url).map_err(|e| {
            AppError::new("INVALID_GRAPHQL_ENDPOINT", "Invalid GraphQL endpoint URL", true)
                .with_details(e.to_string())
        })?;
        {
            let mut pairs = parsed.query_pairs_mut();
            pairs.append_pair("query", &payload.query);
            if !payload.variables.is_null() {
                pairs.append_pair("variables", &payload.variables.to_string());
            }
            if let Some(op) = payload.operation_name.as_deref().filter(|s| !s.is_empty()) {
                pairs.append_pair("operationName", op);
            }
        }
        target_url = parsed.to_string();
    } else {
        if !headers.keys().any(|k| k.eq_ignore_ascii_case("content-type")) {
            headers.insert("Content-Type".to_string(), "application/json".to_string());
        }
        let mut body_obj = json!({
            "query": payload.query,
            "variables": payload.variables
        });
        if let Some(op) = payload.operation_name.as_deref().filter(|s| !s.is_empty()) {
            if let Some(map) = body_obj.as_object_mut() {
                map.insert("operationName".to_string(), json!(op));
            }
        }
        body_mode = "raw".to_string();
        raw_body = Some(body_obj.to_string());
    }

    let http_req = NativeHttpRequest {
        execution_id: payload.execution_id,
        tab_id: payload.tab_id,
        request_id: payload.request_id,
        method,
        url: target_url,
        headers,
        body_mode,
        raw_body,
        form_url_encoded: vec![],
        form_parts: vec![],
        binary_base64: None,
        binary_file_path: None,
        timeout_ms: payload.timeout_ms,
        follow_redirects: true,
        max_redirects: Some(5),
        tls: payload.tls,
        proxy: payload.proxy,
    };

    execute_http_request(http_req, global_proxy, cancel_registry, logs).await
}

impl GraphqlSubscriptionManager {
    pub fn start_subscription(
        &self,
        app: AppHandle,
        payload: NativeGraphqlSubscriptionPayload,
    ) -> Result<(), AppError> {
        let parsed = url::Url::parse(payload.endpoint.trim()).map_err(|e| {
            AppError::new("INVALID_SUBSCRIPTION_URL", "Invalid GraphQL WebSocket subscription URL", true)
                .with_details(e.to_string())
        })?;
        if parsed.scheme() != "ws" && parsed.scheme() != "wss" {
            return Err(AppError::new(
                "UNSUPPORTED_SUBSCRIPTION_SCHEME",
                "GraphQL subscriptions require ws:// or wss:// endpoint",
                true,
            ));
        }

        self.stop_subscription(&payload.session_id);
        let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();
        if let Ok(mut guard) = self.sessions.lock() {
            guard.insert(payload.session_id.clone(), shutdown_tx);
        }

        let mut request = parsed.as_str().into_client_request().map_err(|e| {
            AppError::new("GQL_WS_BUILD_ERROR", "Failed to build GraphQL WS request", true)
                .with_details(e.to_string())
        })?;
        request.headers_mut().insert(
            "Sec-WebSocket-Protocol",
            HeaderValue::from_static("graphql-transport-ws"),
        );
        for (k, v) in &payload.headers {
            if let (Ok(hn), Ok(hv)) = (
                tokio_tungstenite::tungstenite::http::HeaderName::from_bytes(k.trim().as_bytes()),
                HeaderValue::from_str(v),
            ) {
                request.headers_mut().insert(hn, hv);
            }
        }

        let session_id = payload.session_id.clone();

        tauri::async_runtime::spawn(async move {
            let ws_stream = match tokio_tungstenite::connect_async(request).await {
                Ok((s, _)) => s,
                Err(e) => {
                    let _ = app.emit(
                        "graphql://subscription-status",
                        json!({
                            "sessionId": session_id,
                            "status": "error",
                            "error": e.to_string()
                        }),
                    );
                    return;
                }
            };

            let (mut write, mut read) = ws_stream.split();
            let init_msg = json!({ "type": "connection_init", "payload": {} }).to_string();
            if write.send(Message::Text(init_msg.into())).await.is_err() {
                return;
            }

            let sub_payload = json!({
                "id": "sub-1",
                "type": "subscribe",
                "payload": {
                    "query": payload.query,
                    "variables": payload.variables,
                    "operationName": payload.operation_name
                }
            })
            .to_string();
            let _ = write.send(Message::Text(sub_payload.into())).await;

            let _ = app.emit(
                "graphql://subscription-status",
                json!({ "sessionId": session_id, "status": "connected" }),
            );

            loop {
                tokio::select! {
                    _ = &mut shutdown_rx => {
                        let complete = json!({ "id": "sub-1", "type": "complete" }).to_string();
                        let _ = write.send(Message::Text(complete.into())).await;
                        let _ = write.send(Message::Close(None)).await;
                        let _ = app.emit(
                            "graphql://subscription-status",
                            json!({ "sessionId": session_id, "status": "closed" }),
                        );
                        break;
                    }
                    msg = read.next() => {
                        match msg {
                            Some(Ok(Message::Text(txt))) => {
                                let _ = app.emit(
                                    "graphql://subscription-event",
                                    json!({
                                        "sessionId": session_id,
                                        "timestamp": chrono::Utc::now().timestamp_millis(),
                                        "raw": txt.to_string()
                                    }),
                                );
                            }
                            Some(Ok(Message::Close(_))) | None => {
                                let _ = app.emit(
                                    "graphql://subscription-status",
                                    json!({ "sessionId": session_id, "status": "closed" }),
                                );
                                break;
                            }
                            Some(Err(e)) => {
                                let _ = app.emit(
                                    "graphql://subscription-status",
                                    json!({ "sessionId": session_id, "status": "error", "error": e.to_string() }),
                                );
                                break;
                            }
                            _ => {}
                        }
                    }
                }
            }
        });

        Ok(())
    }

    pub fn stop_subscription(&self, session_id: &str) -> bool {
        if let Ok(mut guard) = self.sessions.lock() {
            if let Some(tx) = guard.remove(session_id) {
                let _ = tx.send(());
                return true;
            }
        }
        false
    }

    pub fn stop_all(&self) {
        if let Ok(mut guard) = self.sessions.lock() {
            for (_, tx) in guard.drain() {
                let _ = tx.send(());
            }
        }
    }
}
