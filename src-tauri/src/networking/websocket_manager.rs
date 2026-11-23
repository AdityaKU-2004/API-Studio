use crate::models::{
    AppError, NativeWsConnectPayload, NativeWsMessageEvent, NativeWsSendPayload,
    NativeWsStatusEvent,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, oneshot};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::tungstenite::Message;

struct WsSessionHandle {
    outbound_tx: mpsc::Sender<Message>,
    shutdown_tx: oneshot::Sender<()>,
}

pub struct WebSocketManager {
    sessions: Mutex<HashMap<String, WsSessionHandle>>,
}

impl Default for WebSocketManager {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

pub fn validate_ws_url(raw: &str) -> Result<url::Url, AppError> {
    let parsed = url::Url::parse(raw.trim()).map_err(|e| {
        AppError::new("INVALID_WS_URL", format!("Invalid WebSocket URL '{}'", raw), true)
            .with_details(e.to_string())
    })?;
    if parsed.scheme() != "ws" && parsed.scheme() != "wss" {
        return Err(AppError::new(
            "UNSUPPORTED_WS_SCHEME",
            "WebSocket URL must use ws:// or wss:// scheme",
            true,
        ));
    }
    Ok(parsed)
}

impl WebSocketManager {
    pub fn connect(&self, app: AppHandle, payload: NativeWsConnectPayload) -> Result<(), AppError> {
        let url = validate_ws_url(&payload.url)?;
        // Disconnect existing session with same ID first
        self.disconnect(&payload.session_id);

        let mut request = url.as_str().into_client_request().map_err(|e| {
            AppError::new("WS_REQUEST_BUILD_ERROR", "Failed to build WebSocket handshake request", true)
                .with_details(e.to_string())
        })?;

        for (k, v) in &payload.headers {
            if k.trim().is_empty() {
                continue;
            }
            if let (Ok(name), Ok(val)) = (
                tokio_tungstenite::tungstenite::http::HeaderName::from_bytes(k.trim().as_bytes()),
                HeaderValue::from_str(v),
            ) {
                request.headers_mut().insert(name, val);
            }
        }

        if !payload.protocols.is_empty() {
            let joined = payload.protocols.join(", ");
            if let Ok(val) = HeaderValue::from_str(&joined) {
                request.headers_mut().insert("Sec-WebSocket-Protocol", val);
            }
        }

        let (outbound_tx, mut outbound_rx) = mpsc::channel::<Message>(128);
        let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();

        if let Ok(mut guard) = self.sessions.lock() {
            guard.insert(
                payload.session_id.clone(),
                WsSessionHandle {
                    outbound_tx,
                    shutdown_tx,
                },
            );
        }

        let session_id = payload.session_id.clone();
        let resolved_url = url.to_string();
        let timeout_ms = payload.timeout_ms.unwrap_or(10_000).max(500);

        let _ = app.emit(
            "websocket://status",
            NativeWsStatusEvent {
                session_id: session_id.clone(),
                status: "connecting".to_string(),
                resolved_url: Some(resolved_url.clone()),
                close_code: None,
                close_reason: None,
                error: None,
            },
        );

        tauri::async_runtime::spawn(async move {
            let connect_fut = tokio_tungstenite::connect_async(request);
            let connect_res = tokio::time::timeout(Duration::from_millis(timeout_ms), connect_fut).await;

            let ws_stream = match connect_res {
                Ok(Ok((stream, _resp))) => stream,
                Ok(Err(e)) => {
                    let _ = app.emit(
                        "websocket://status",
                        NativeWsStatusEvent {
                            session_id: session_id.clone(),
                            status: "error".to_string(),
                            resolved_url: None,
                            close_code: None,
                            close_reason: None,
                            error: Some(format!("WebSocket handshake failed: {}", e)),
                        },
                    );
                    return;
                }
                Err(_) => {
                    let _ = app.emit(
                        "websocket://status",
                        NativeWsStatusEvent {
                            session_id: session_id.clone(),
                            status: "error".to_string(),
                            resolved_url: None,
                            close_code: None,
                            close_reason: None,
                            error: Some(format!("WebSocket connection timed out after {}ms", timeout_ms)),
                        },
                    );
                    return;
                }
            };

            let _ = app.emit(
                "websocket://status",
                NativeWsStatusEvent {
                    session_id: session_id.clone(),
                    status: "connected".to_string(),
                    resolved_url: Some(resolved_url),
                    close_code: None,
                    close_reason: None,
                    error: None,
                },
            );

            let (mut write, mut read) = ws_stream.split();

            loop {
                tokio::select! {
                    _ = &mut shutdown_rx => {
                        let _ = write.send(Message::Close(None)).await;
                        let _ = app.emit(
                            "websocket://status",
                            NativeWsStatusEvent {
                                session_id: session_id.clone(),
                                status: "closed".to_string(),
                                resolved_url: None,
                                close_code: Some(1000),
                                close_reason: Some("Closed by user".to_string()),
                                error: None,
                            },
                        );
                        break;
                    }
                    outgoing = outbound_rx.recv() => {
                        match outgoing {
                            Some(msg) => {
                                if let Err(e) = write.send(msg).await {
                                    let _ = app.emit(
                                        "websocket://status",
                                        NativeWsStatusEvent {
                                            session_id: session_id.clone(),
                                            status: "error".to_string(),
                                            resolved_url: None,
                                            close_code: None,
                                            close_reason: None,
                                            error: Some(format!("WebSocket write failed: {}", e)),
                                        },
                                    );
                                    break;
                                }
                            }
                            None => break,
                        }
                    }
                    incoming = read.next() => {
                        match incoming {
                            Some(Ok(Message::Text(txt))) => {
                                let size_bytes = txt.len();
                                let _ = app.emit(
                                    "websocket://message",
                                    NativeWsMessageEvent {
                                        session_id: session_id.clone(),
                                        payload: txt.to_string(),
                                        is_binary: false,
                                        size_bytes,
                                        timestamp: chrono::Utc::now().timestamp_millis(),
                                    },
                                );
                            }
                            Some(Ok(Message::Binary(bytes))) => {
                                let size_bytes = bytes.len();
                                let hex_preview = bytes
                                    .iter()
                                    .map(|b| format!("{:02x}", b))
                                    .collect::<Vec<_>>()
                                    .join(" ");
                                let _ = app.emit(
                                    "websocket://message",
                                    NativeWsMessageEvent {
                                        session_id: session_id.clone(),
                                        payload: hex_preview,
                                        is_binary: true,
                                        size_bytes,
                                        timestamp: chrono::Utc::now().timestamp_millis(),
                                    },
                                );
                            }
                            Some(Ok(Message::Close(frame))) => {
                                let (code, reason) = frame
                                    .map(|f| (Some(f.code.into()), Some(f.reason.to_string())))
                                    .unwrap_or((Some(1000), None));
                                let _ = app.emit(
                                    "websocket://status",
                                    NativeWsStatusEvent {
                                        session_id: session_id.clone(),
                                        status: "closed".to_string(),
                                        resolved_url: None,
                                        close_code: code,
                                        close_reason: reason,
                                        error: None,
                                    },
                                );
                                break;
                            }
                            Some(Ok(Message::Ping(data))) => {
                                let _ = write.send(Message::Pong(data)).await;
                            }
                            Some(Ok(_)) => {}
                            Some(Err(e)) => {
                                let _ = app.emit(
                                    "websocket://status",
                                    NativeWsStatusEvent {
                                        session_id: session_id.clone(),
                                        status: "error".to_string(),
                                        resolved_url: None,
                                        close_code: None,
                                        close_reason: None,
                                        error: Some(e.to_string()),
                                    },
                                );
                                break;
                            }
                            None => {
                                let _ = app.emit(
                                    "websocket://status",
                                    NativeWsStatusEvent {
                                        session_id: session_id.clone(),
                                        status: "closed".to_string(),
                                        resolved_url: None,
                                        close_code: Some(1006),
                                        close_reason: Some("Connection ended".to_string()),
                                        error: None,
                                    },
                                );
                                break;
                            }
                        }
                    }
                }
            }
        });

        Ok(())
    }

    pub async fn send(&self, payload: NativeWsSendPayload) -> Result<(), AppError> {
        let tx = {
            let guard = self.sessions.lock().map_err(|_| {
                AppError::new("WS_LOCK_ERROR", "WebSocket session registry lock poisoned", true)
            })?;
            guard.get(&payload.session_id).map(|h| h.outbound_tx.clone())
        };

        let tx = tx.ok_or_else(|| {
            AppError::new("WS_NOT_CONNECTED", "No active WebSocket session for tab", true)
        })?;

        let msg = if let Some(b64) = payload.binary_base64 {
            let bytes = BASE64.decode(b64).map_err(|e| {
                AppError::new("INVALID_BASE64", "Invalid binary WebSocket frame payload", true)
                    .with_details(e.to_string())
            })?;
            Message::Binary(bytes.into())
        } else {
            Message::Text(payload.text.unwrap_or_default().into())
        };

        tx.send(msg).await.map_err(|_| {
            AppError::new("WS_SEND_FAILED", "Failed to send WebSocket message; socket closed", true)
        })
    }

    pub fn disconnect(&self, session_id: &str) -> bool {
        if let Ok(mut guard) = self.sessions.lock() {
            if let Some(handle) = guard.remove(session_id) {
                let _ = handle.shutdown_tx.send(());
                return true;
            }
        }
        false
    }

    pub fn disconnect_all(&self) {
        if let Ok(mut guard) = self.sessions.lock() {
            for (_, handle) in guard.drain() {
                let _ = handle.shutdown_tx.send(());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_websocket_schemes() {
        assert!(validate_ws_url("wss://echo.websocket.events").is_ok());
        assert!(validate_ws_url("ws://localhost:8080/ws").is_ok());
        assert!(validate_ws_url("https://example.com").is_err());
    }
}
