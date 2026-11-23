use crate::models::{AppError, NativeProxyConfig, NativeSseConnectPayload, NativeSseEventPayload, NativeSseStatusEvent};
use crate::networking::proxy_manager::resolve_effective_proxy;
use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use uuid::Uuid;

pub struct SseParser {
    buffer: String,
    event_name: Option<String>,
    event_id: Option<String>,
    data_lines: Vec<String>,
    retry_ms: Option<u64>,
}

impl Default for SseParser {
    fn default() -> Self {
        Self {
            buffer: String::new(),
            event_name: None,
            event_id: None,
            data_lines: Vec::new(),
            retry_ms: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedSseEvent {
    pub event_name: String,
    pub event_id: Option<String>,
    pub data: String,
    pub retry_ms: Option<u64>,
}

impl SseParser {
    pub fn feed(&mut self, chunk: &str) -> Vec<ParsedSseEvent> {
        self.buffer.push_str(chunk);
        let mut events = Vec::new();

        while let Some(newline_idx) = self.buffer.find('\n') {
            let mut line = self.buffer[..newline_idx].to_string();
            self.buffer.drain(..=newline_idx);
            if line.ends_with('\r') {
                line.pop();
            }

            if line.is_empty() {
                if let Some(ev) = self.dispatch_current() {
                    events.push(ev);
                }
                continue;
            }

            if line.starts_with(':') {
                continue;
            }

            let (field, value) = match line.split_once(':') {
                Some((f, v)) => (f, v.strip_prefix(' ').unwrap_or(v)),
                None => (line.as_str(), ""),
            };

            match field {
                "event" => self.event_name = Some(value.to_string()),
                "id" if !value.contains('\0') => self.event_id = Some(value.to_string()),
                "data" => self.data_lines.push(value.to_string()),
                "retry" => {
                    if let Ok(ms) = value.trim().parse::<u64>() {
                        self.retry_ms = Some(ms);
                    }
                }
                _ => {}
            }
        }

        events
    }

    pub fn flush(&mut self) -> Vec<ParsedSseEvent> {
        if !self.buffer.is_empty() {
            let mut out = self.feed("\n");
            if let Some(ev) = self.dispatch_current() {
                out.push(ev);
            }
            out
        } else {
            self.dispatch_current().into_iter().collect()
        }
    }

    fn dispatch_current(&mut self) -> Option<ParsedSseEvent> {
        if self.data_lines.is_empty() && self.event_name.is_none() && self.retry_ms.is_none() {
            return None;
        }
        let data = self.data_lines.join("\n");
        let ev = ParsedSseEvent {
            event_name: self.event_name.take().unwrap_or_else(|| "message".to_string()),
            event_id: self.event_id.clone(),
            data,
            retry_ms: self.retry_ms.take(),
        };
        self.data_lines.clear();
        Some(ev)
    }
}

pub struct SseManager {
    sessions: Mutex<HashMap<String, oneshot::Sender<()>>>,
}

impl Default for SseManager {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

impl SseManager {
    pub fn connect(
        &self,
        app: AppHandle,
        payload: NativeSseConnectPayload,
        global_proxy: Option<NativeProxyConfig>,
    ) -> Result<(), AppError> {
        let parsed = url::Url::parse(payload.url.trim()).map_err(|e| {
            AppError::new("INVALID_SSE_URL", "Invalid SSE endpoint URL", true)
                .with_details(e.to_string())
        })?;
        if parsed.scheme() != "http" && parsed.scheme() != "https" {
            return Err(AppError::new(
                "UNSUPPORTED_SSE_PROTOCOL",
                "SSE endpoint must use http:// or https://",
                true,
            ));
        }

        self.disconnect(&payload.session_id);
        let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();
        if let Ok(mut guard) = self.sessions.lock() {
            guard.insert(payload.session_id.clone(), shutdown_tx);
        }

        let session_id = payload.session_id.clone();
        let verify_ssl = payload.verify_ssl.unwrap_or(true);

        tauri::async_runtime::spawn(async move {
            let mut attempt: u32 = 0;
            let mut last_event_id = payload.last_event_id.clone();
            let mut retry_delay_ms = payload.reconnect_delay_ms.max(300);

            loop {
                let _ = app.emit(
                    "sse://status",
                    NativeSseStatusEvent {
                        session_id: session_id.clone(),
                        status: if attempt == 0 { "connecting" } else { "reconnecting" }.to_string(),
                        attempt,
                        error: None,
                        fatal: false,
                    },
                );

                let mut client_builder = reqwest::Client::builder()
                    .use_rustls_tls()
                    .danger_accept_invalid_certs(!verify_ssl);

                if let Ok(Some(resolved)) = resolve_effective_proxy(
                    parsed.as_str(),
                    payload.proxy.as_ref(),
                    global_proxy.as_ref(),
                ) {
                    client_builder = client_builder.proxy(resolved.reqwest_proxy);
                }

                let client = match client_builder.build() {
                    Ok(c) => c,
                    Err(e) => {
                        let _ = app.emit(
                            "sse://status",
                            NativeSseStatusEvent {
                                session_id: session_id.clone(),
                                status: "error".to_string(),
                                attempt,
                                error: Some(e.to_string()),
                                fatal: true,
                            },
                        );
                        break;
                    }
                };

                let mut headers = HeaderMap::new();
                headers.insert("accept", HeaderValue::from_static("text/event-stream"));
                headers.insert("cache-control", HeaderValue::from_static("no-cache"));
                for (k, v) in &payload.headers {
                    if let (Ok(hn), Ok(hv)) = (
                        HeaderName::from_bytes(k.trim().as_bytes()),
                        HeaderValue::from_str(v),
                    ) {
                        headers.insert(hn, hv);
                    }
                }
                if let Some(eid) = &last_event_id {
                    if let Ok(hv) = HeaderValue::from_str(eid) {
                        headers.insert("last-event-id", hv);
                    }
                }

                let resp_res = tokio::select! {
                    r = client.get(parsed.clone()).headers(headers).send() => r,
                    _ = &mut shutdown_rx => {
                        let _ = app.emit(
                            "sse://status",
                            NativeSseStatusEvent {
                                session_id: session_id.clone(),
                                status: "closed".to_string(),
                                attempt,
                                error: None,
                                fatal: false,
                            },
                        );
                        return;
                    }
                };

                match resp_res {
                    Ok(resp) if resp.status().is_success() => {
                        attempt = 0;
                        let _ = app.emit(
                            "sse://status",
                            NativeSseStatusEvent {
                                session_id: session_id.clone(),
                                status: "connected".to_string(),
                                attempt: 0,
                                error: None,
                                fatal: false,
                            },
                        );

                        let mut parser = SseParser::default();
                        let mut stream = resp.bytes_stream();

                        loop {
                            tokio::select! {
                                _ = &mut shutdown_rx => {
                                    let _ = app.emit(
                                        "sse://status",
                                        NativeSseStatusEvent {
                                            session_id: session_id.clone(),
                                            status: "closed".to_string(),
                                            attempt,
                                            error: None,
                                            fatal: false,
                                        },
                                    );
                                    return;
                                }
                                chunk = stream.next() => {
                                    match chunk {
                                        Some(Ok(bytes)) => {
                                            let text = String::from_utf8_lossy(&bytes);
                                            for ev in parser.feed(&text) {
                                                if let Some(eid) = &ev.event_id {
                                                    last_event_id = Some(eid.clone());
                                                }
                                                if let Some(rm) = ev.retry_ms {
                                                    retry_delay_ms = rm.max(300);
                                                }
                                                let size = ev.data.len();
                                                let _ = app.emit(
                                                    "sse://event",
                                                    NativeSseEventPayload {
                                                        session_id: session_id.clone(),
                                                        id: format!("sse-{}", Uuid::new_v4()),
                                                        timestamp: chrono::Utc::now().timestamp_millis(),
                                                        event_name: ev.event_name,
                                                        event_id: ev.event_id,
                                                        data: ev.data,
                                                        retry_ms: ev.retry_ms,
                                                        raw_size_bytes: size,
                                                    },
                                                );
                                            }
                                        }
                                        Some(Err(e)) => {
                                            let _ = app.emit(
                                                "sse://status",
                                                NativeSseStatusEvent {
                                                    session_id: session_id.clone(),
                                                    status: "error".to_string(),
                                                    attempt,
                                                    error: Some(e.to_string()),
                                                    fatal: false,
                                                },
                                            );
                                            break;
                                        }
                                        None => {
                                            for ev in parser.flush() {
                                                let size = ev.data.len();
                                                let _ = app.emit(
                                                    "sse://event",
                                                    NativeSseEventPayload {
                                                        session_id: session_id.clone(),
                                                        id: format!("sse-{}", Uuid::new_v4()),
                                                        timestamp: chrono::Utc::now().timestamp_millis(),
                                                        event_name: ev.event_name,
                                                        event_id: ev.event_id,
                                                        data: ev.data,
                                                        retry_ms: ev.retry_ms,
                                                        raw_size_bytes: size,
                                                    },
                                                );
                                            }
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Ok(resp) => {
                        let _ = app.emit(
                            "sse://status",
                            NativeSseStatusEvent {
                                session_id: session_id.clone(),
                                status: "error".to_string(),
                                attempt,
                                error: Some(format!("HTTP {} from SSE endpoint", resp.status())),
                                fatal: false,
                            },
                        );
                    }
                    Err(e) => {
                        let _ = app.emit(
                            "sse://status",
                            NativeSseStatusEvent {
                                session_id: session_id.clone(),
                                status: "error".to_string(),
                                attempt,
                                error: Some(e.to_string()),
                                fatal: false,
                            },
                        );
                    }
                }

                if !payload.auto_reconnect || attempt >= payload.max_reconnect_attempts {
                    let _ = app.emit(
                        "sse://status",
                        NativeSseStatusEvent {
                            session_id: session_id.clone(),
                            status: "closed".to_string(),
                            attempt,
                            error: None,
                            fatal: false,
                        },
                    );
                    break;
                }

                attempt += 1;
                tokio::select! {
                    _ = tokio::time::sleep(Duration::from_millis(retry_delay_ms)) => {}
                    _ = &mut shutdown_rx => {
                        let _ = app.emit(
                            "sse://status",
                            NativeSseStatusEvent {
                                session_id: session_id.clone(),
                                status: "closed".to_string(),
                                attempt,
                                error: None,
                                fatal: false,
                            },
                        );
                        return;
                    }
                }
            }
        });

        Ok(())
    }

    pub fn disconnect(&self, session_id: &str) -> bool {
        if let Ok(mut guard) = self.sessions.lock() {
            if let Some(tx) = guard.remove(session_id) {
                let _ = tx.send(());
                return true;
            }
        }
        false
    }

    pub fn disconnect_all(&self) {
        if let Ok(mut guard) = self.sessions.lock() {
            for (_, tx) in guard.drain() {
                let _ = tx.send(());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_multiline_sse_events_and_retry() {
        let mut parser = SseParser::default();
        let events = parser.feed(
            ": heartbeat\nevent: update\nid: evt-42\nretry: 5000\ndata: {\"line\":1}\ndata: {\"line\":2}\n\n",
        );
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_name, "update");
        assert_eq!(events[0].event_id.as_deref(), Some("evt-42"));
        assert_eq!(events[0].retry_ms, Some(5000));
        assert_eq!(events[0].data, "{\"line\":1}\n{\"line\":2}");
    }
}
