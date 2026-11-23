use crate::models::{
    AppError, NativeHttpRequest, NativeHttpResponse, NativeProxyConfig, NativeResponseCookie,
    NativeTimingBreakdown, NativeTlsConfig,
};
use crate::networking::proxy_manager::resolve_effective_proxy;
use crate::utils::logger::LogBuffer;
use crate::utils::path_security::validate_safe_file_path;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::{Method, redirect::Policy};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tokio::sync::oneshot;
use url::Url;

pub struct HttpCancelRegistry {
    active: Mutex<HashMap<String, oneshot::Sender<()>>>,
}

impl Default for HttpCancelRegistry {
    fn default() -> Self {
        Self {
            active: Mutex::new(HashMap::new()),
        }
    }
}

impl HttpCancelRegistry {
    pub fn register(&self, key: &str) -> oneshot::Receiver<()> {
        let (tx, rx) = oneshot::channel();
        if let Ok(mut guard) = self.active.lock() {
            if let Some(prev) = guard.insert(key.to_string(), tx) {
                let _ = prev.send(());
            }
        }
        rx
    }

    pub fn cancel(&self, key: &str) -> bool {
        if let Ok(mut guard) = self.active.lock() {
            if let Some(tx) = guard.remove(key) {
                let _ = tx.send(());
                return true;
            }
        }
        false
    }

    pub fn remove(&self, key: &str) {
        if let Ok(mut guard) = self.active.lock() {
            guard.remove(key);
        }
    }

    pub fn cancel_all(&self) {
        if let Ok(mut guard) = self.active.lock() {
            for (_, tx) in guard.drain() {
                let _ = tx.send(());
            }
        }
    }
}

fn parse_cookies(headers: &HeaderMap) -> Vec<NativeResponseCookie> {
    let mut cookies = Vec::new();
    for val in headers.get_all(reqwest::header::SET_COOKIE).iter() {
        if let Ok(raw) = val.to_str() {
            let parts: Vec<&str> = raw.split(';').map(|s| s.trim()).collect();
            if let Some(first) = parts.first() {
                if let Some((name, value)) = first.split_once('=') {
                    let mut cookie = NativeResponseCookie {
                        name: name.trim().to_string(),
                        value: value.trim().to_string(),
                        domain: None,
                        path: None,
                        expires: None,
                        http_only: false,
                        secure: false,
                    };
                    for attr in parts.iter().skip(1) {
                        let lower = attr.to_ascii_lowercase();
                        if lower == "httponly" {
                            cookie.http_only = true;
                        } else if lower == "secure" {
                            cookie.secure = true;
                        } else if let Some((ak, av)) = attr.split_once('=') {
                            match ak.trim().to_ascii_lowercase().as_str() {
                                "domain" => cookie.domain = Some(av.trim().to_string()),
                                "path" => cookie.path = Some(av.trim().to_string()),
                                "expires" => cookie.expires = Some(av.trim().to_string()),
                                _ => {}
                            }
                        }
                    }
                    cookies.push(cookie);
                }
            }
        }
    }
    cookies
}

fn is_binary_content_type(ct: &str) -> bool {
    let lower = ct.to_ascii_lowercase();
    if lower.starts_with("text/")
        || lower.contains("json")
        || lower.contains("xml")
        || lower.contains("html")
        || lower.contains("javascript")
        || lower.contains("x-www-form-urlencoded")
        || lower.contains("svg+xml")
    {
        return false;
    }
    lower.starts_with("image/")
        || lower.starts_with("audio/")
        || lower.starts_with("video/")
        || lower.contains("pdf")
        || lower.contains("octet-stream")
        || lower.contains("zip")
}

pub async fn execute_http_request(
    req: NativeHttpRequest,
    global_proxy: Option<&NativeProxyConfig>,
    cancel_registry: &HttpCancelRegistry,
    logs: Option<&LogBuffer>,
) -> Result<NativeHttpResponse, AppError> {
    let total_start = Instant::now();
    let start_epoch_ms = chrono::Utc::now().timestamp_millis();

    let parsed_url = Url::parse(req.url.trim()).map_err(|e| {
        AppError::new("INVALID_URL", format!("Invalid URL '{}'", req.url), true)
            .with_details(e.to_string())
    })?;
    if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
        return Err(AppError::new(
            "UNSUPPORTED_PROTOCOL",
            format!("Unsupported HTTP scheme '{}'", parsed_url.scheme()),
            true,
        ));
    }

    let method = Method::from_bytes(req.method.trim().to_ascii_uppercase().as_bytes()).map_err(|_| {
        AppError::new(
            "INVALID_METHOD",
            format!("Unsupported HTTP method '{}'", req.method),
            true,
        )
    })?;

    let tls_cfg = req.tls.clone().unwrap_or_else(NativeTlsConfig::default);
    let verify_ssl = tls_cfg.verify_ssl;
    let tls_warning = if !verify_ssl {
        if let Some(l) = logs {
            l.record(
                "warn",
                "http_client",
                format!(
                    "TLS verification explicitly disabled by user for {}",
                    parsed_url.host_str().unwrap_or("target")
                ),
            );
        }
        Some("TLS certificate verification is disabled for this request. Connection is vulnerable to MitM attacks.".to_string())
    } else {
        None
    };

    let mut client_builder = reqwest::Client::builder()
        .use_rustls_tls()
        .danger_accept_invalid_certs(!verify_ssl)
        .redirect(if req.follow_redirects {
            Policy::limited(req.max_redirects.unwrap_or(10).min(30))
        } else {
            Policy::none()
        });

    if let Some(timeout_ms) = req.timeout_ms.filter(|t| *t > 0) {
        client_builder = client_builder.timeout(Duration::from_millis(timeout_ms));
    }

    if let Some(ca_pem) = tls_cfg.custom_ca_pem.as_deref().filter(|s| !s.trim().is_empty()) {
        let cert = reqwest::Certificate::from_pem(ca_pem.as_bytes()).map_err(|e| {
            AppError::new("INVALID_CA_CERTIFICATE", "Invalid custom CA PEM certificate", true)
                .with_details(e.to_string())
        })?;
        client_builder = client_builder.add_root_certificate(cert);
    }

    if let (Some(cert_pem), Some(key_pem)) = (
        tls_cfg.client_cert_pem.as_deref().filter(|s| !s.trim().is_empty()),
        tls_cfg.client_key_pem.as_deref().filter(|s| !s.trim().is_empty()),
    ) {
        let combined = format!("{}\n{}", cert_pem.trim(), key_pem.trim());
        let identity = reqwest::Identity::from_pem(combined.as_bytes()).map_err(|e| {
            AppError::new("INVALID_CLIENT_IDENTITY", "Invalid client mTLS certificate or private key PEM", true)
                .with_details(e.to_string())
        })?;
        client_builder = client_builder.identity(identity);
    }

    let resolved_proxy = resolve_effective_proxy(
        parsed_url.as_str(),
        req.proxy.as_ref(),
        global_proxy,
    )?;
    let effective_proxy_display = resolved_proxy.as_ref().map(|p| p.redacted_display.clone());
    if let Some(p) = resolved_proxy {
        client_builder = client_builder.proxy(p.reqwest_proxy);
    }

    let client = client_builder.build().map_err(|e| {
        AppError::new("HTTP_CLIENT_BUILD_ERROR", "Failed to construct native HTTP client", true)
            .with_details(e.to_string())
    })?;

    let mut header_map = HeaderMap::new();
    for (k, v) in &req.headers {
        let trimmed_k = k.trim();
        if trimmed_k.is_empty() {
            continue;
        }
        // Let reqwest generate multipart boundary dynamically
        if req.body_mode == "form-data" && trimmed_k.eq_ignore_ascii_case("content-type") {
            continue;
        }
        let h_name = HeaderName::from_bytes(trimmed_k.as_bytes()).map_err(|e| {
            AppError::new("INVALID_HEADER_NAME", format!("Invalid header name '{}'", trimmed_k), true)
                .with_details(e.to_string())
        })?;
        let h_val = HeaderValue::from_str(v).map_err(|e| {
            AppError::new("INVALID_HEADER_VALUE", format!("Invalid header value for '{}'", trimmed_k), true)
                .with_details(e.to_string())
        })?;
        header_map.insert(h_name, h_val);
    }

    let mut request_builder = client.request(method.clone(), parsed_url.clone()).headers(header_map);

    if method != Method::GET && method != Method::HEAD {
        match req.body_mode.as_str() {
            "raw" => {
                if let Some(raw) = &req.raw_body {
                    request_builder = request_builder.body(raw.clone());
                }
            }
            "x-www-form-urlencoded" => {
                request_builder = request_builder.form(&req.form_url_encoded);
            }
            "form-data" => {
                let mut form = reqwest::multipart::Form::new();
                for part in &req.form_parts {
                    if part.key.trim().is_empty() {
                        continue;
                    }
                    if part.part_type == "file" {
                        let bytes = if let Some(b64) = &part.base64_data {
                            BASE64.decode(b64).map_err(|e| {
                                AppError::new("INVALID_BASE64_PART", "Invalid base64 attachment data", true)
                                    .with_details(e.to_string())
                            })?
                        } else if let Some(fp) = &part.file_path {
                            let safe_path = validate_safe_file_path(fp, true, None)?;
                            std::fs::read(safe_path)?
                        } else {
                            Vec::new()
                        };
                        let file_name = part.file_name.clone().unwrap_or_else(|| "file.bin".to_string());
                        let mut mp = reqwest::multipart::Part::bytes(bytes).file_name(file_name);
                        if let Some(ct) = part.content_type.as_deref().filter(|s| !s.is_empty()) {
                            mp = mp.mime_str(ct).map_err(|e| {
                                AppError::new("INVALID_MIME_TYPE", "Invalid multipart MIME type", true)
                                    .with_details(e.to_string())
                            })?;
                        }
                        form = form.part(part.key.clone(), mp);
                    } else {
                        form = form.text(part.key.clone(), part.value.clone().unwrap_or_default());
                    }
                }
                request_builder = request_builder.multipart(form);
            }
            "binary" => {
                if let Some(b64) = &req.binary_base64 {
                    let bytes = BASE64.decode(b64).map_err(|e| {
                        AppError::new("INVALID_BASE64_BODY", "Invalid base64 binary body", true)
                            .with_details(e.to_string())
                    })?;
                    request_builder = request_builder.body(bytes);
                } else if let Some(fp) = &req.binary_file_path {
                    let safe_path = validate_safe_file_path(fp, true, None)?;
                    let bytes = std::fs::read(safe_path)?;
                    request_builder = request_builder.body(bytes);
                }
            }
            _ => {}
        }
    }

    let prepare_ms = total_start.elapsed().as_millis() as u64;

    // Optional real DNS timing probe ONLY when direct (non-proxied) hostname
    let dns_lookup_ms = if effective_proxy_display.is_none() {
        if let Some(host) = parsed_url.host_str() {
            if host.parse::<std::net::IpAddr>().is_err() {
                let port = parsed_url.port_or_known_default().unwrap_or(80);
                let dns_start = Instant::now();
                let _ = tokio::net::lookup_host((host, port)).await;
                Some(dns_start.elapsed().as_millis() as u64)
            } else {
                Some(0)
            }
        } else {
            None
        }
    } else {
        None
    };

    let cancel_rx = cancel_registry.register(&req.tab_id);
    let send_start = Instant::now();

    let response_res = tokio::select! {
        res = request_builder.send() => res,
        _ = cancel_rx => {
            cancel_registry.remove(&req.tab_id);
            return Err(AppError::new("REQUEST_CANCELLED", "Request was cancelled by user", true));
        }
    };

    let headers_instant = Instant::now();
    let headers_received_epoch = chrono::Utc::now().timestamp_millis();
    let ttfb_ms = send_start.elapsed().as_millis() as u64;

    let response = match response_res {
        Ok(r) => r,
        Err(e) => {
            cancel_registry.remove(&req.tab_id);
            let code = if e.is_timeout() {
                "REQUEST_TIMEOUT"
            } else if e.is_connect() {
                "CONNECTION_FAILED"
            } else if e.is_redirect() {
                "REDIRECT_LIMIT_EXCEEDED"
            } else {
                "NETWORK_ERROR"
            };
            return Err(AppError::new(code, e.to_string(), true));
        }
    };

    let status = response.status().as_u16();
    let status_text = response
        .status()
        .canonical_reason()
        .unwrap_or("Unknown")
        .to_string();
    let ok = response.status().is_success();
    let final_url = response.url().to_string();
    let resp_headers = response.headers().clone();
    let cookies = parse_cookies(&resp_headers);

    let mut headers_map: HashMap<String, String> = HashMap::new();
    let mut header_size_bytes = 0usize;
    for (k, v) in resp_headers.iter() {
        let ks = k.as_str().to_string();
        let vs = v.to_str().unwrap_or("").to_string();
        header_size_bytes += ks.len() + vs.len() + 4;
        headers_map
            .entry(ks)
            .and_modify(|existing| {
                existing.push_str(", ");
                existing.push_str(&vs);
            })
            .or_insert(vs);
    }

    let content_type = headers_map
        .get("content-type")
        .cloned()
        .unwrap_or_else(|| "application/octet-stream".to_string());
    let content_encoding = headers_map.get("content-encoding").cloned();

    let body_bytes = response.bytes().await.map_err(|e| {
        cancel_registry.remove(&req.tab_id);
        AppError::new("BODY_READ_ERROR", "Failed while streaming response body", true)
            .with_details(e.to_string())
    })?;

    cancel_registry.remove(&req.tab_id);

    let download_ms = headers_instant.elapsed().as_millis() as u64;
    let total_ms = total_start.elapsed().as_millis() as u64;
    let end_epoch_ms = chrono::Utc::now().timestamp_millis();
    let size_bytes = body_bytes.len();

    let is_binary = is_binary_content_type(&content_type)
        || (std::str::from_utf8(&body_bytes).is_err());

    let (body_text, body_base64) = if is_binary {
        (None, Some(BASE64.encode(&body_bytes)))
    } else {
        let text = String::from_utf8_lossy(&body_bytes).into_owned();
        (Some(text), None)
    };

    if let Some(l) = logs {
        l.record(
            "info",
            "http_client",
            format!("{} {} -> {} ({} ms, {} B)", method, final_url, status, total_ms, size_bytes),
        );
    }

    Ok(NativeHttpResponse {
        execution_id: req.execution_id,
        request_id: req.request_id,
        status,
        status_text,
        ok,
        final_url,
        method: method.to_string(),
        headers: headers_map,
        cookies,
        body_text,
        body_base64,
        is_binary,
        content_type,
        content_encoding,
        size_bytes,
        header_size_bytes,
        timing: NativeTimingBreakdown {
            start_time: start_epoch_ms,
            headers_received_time: headers_received_epoch,
            end_time: end_epoch_ms,
            duration_ms: total_ms,
            prepare_ms,
            dns_lookup_ms,
            // Honesty rule: reqwest abstracts internal TCP/TLS handshake metrics on pooled sockets
            tcp_connect_ms: None,
            tls_handshake_ms: None,
            ttfb_ms,
            download_ms,
            socket_reused: false,
            effective_proxy: effective_proxy_display,
        },
        tls_verified: verify_ssl,
        tls_warning,
        received_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    #[tokio::test]
    async fn executes_real_http_get_and_records_timing_and_headers() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        tokio::spawn(async move {
            if let Ok((mut socket, _)) = listener.accept().await {
                let mut buf = [0u8; 1024];
                let _ = socket.read(&mut buf).await;
                let body = r#"{"status":"ok","engine":"rust"}"#;
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nSet-Cookie: sid=abc123; Path=/; HttpOnly\r\nContent-Length: {}\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = socket.write_all(resp.as_bytes()).await;
            }
        });

        let registry = HttpCancelRegistry::default();
        let req = NativeHttpRequest {
            execution_id: "exec-1".to_string(),
            tab_id: "tab-1".to_string(),
            request_id: "req-1".to_string(),
            method: "GET".to_string(),
            url: format!("http://{}/health", addr),
            headers: HashMap::new(),
            body_mode: "none".to_string(),
            raw_body: None,
            form_url_encoded: vec![],
            form_parts: vec![],
            binary_base64: None,
            binary_file_path: None,
            timeout_ms: Some(5000),
            follow_redirects: true,
            max_redirects: Some(5),
            tls: Some(NativeTlsConfig::default()),
            proxy: None,
        };

        let out = execute_http_request(req, None, &registry, None).await.unwrap();
        assert_eq!(out.status, 200);
        assert!(out.ok);
        assert_eq!(out.cookies.len(), 1);
        assert_eq!(out.cookies[0].name, "sid");
        assert!(out.cookies[0].http_only);
        assert!(out.body_text.unwrap().contains("\"engine\":\"rust\""));
    }

    #[test]
    fn rejects_unsupported_url_schemes() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let registry = HttpCancelRegistry::default();
        let req = NativeHttpRequest {
            execution_id: "exec-2".to_string(),
            tab_id: "tab-2".to_string(),
            request_id: "req-2".to_string(),
            method: "GET".to_string(),
            url: "file:///etc/passwd".to_string(),
            headers: HashMap::new(),
            body_mode: "none".to_string(),
            raw_body: None,
            form_url_encoded: vec![],
            form_parts: vec![],
            binary_base64: None,
            binary_file_path: None,
            timeout_ms: None,
            follow_redirects: true,
            max_redirects: None,
            tls: None,
            proxy: None,
        };
        let err = rt.block_on(execute_http_request(req, None, &registry, None)).unwrap_err();
        assert_eq!(err.code, "UNSUPPORTED_PROTOCOL");
    }
}
