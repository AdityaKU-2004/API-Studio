use crate::models::{AppError, NativeSecurityHeaderAudit};
use crate::networking::certificate_inspector::inspect_certificate_native;
use reqwest::Client;
use std::collections::HashMap;
use std::time::Duration;
use url::Url;

const RECOMMENDED_SECURITY_HEADERS: &[&str] = &[
    "strict-transport-security",
    "x-content-type-options",
    "content-security-policy",
    "x-frame-options",
    "referrer-policy",
    "cache-control",
];

const INFO_LEAK_HEADERS: &[&str] = &[
    "server",
    "x-powered-by",
    "x-aspnet-version",
    "x-aspnetmvc-version",
];

pub fn evaluate_security_headers(headers: &HashMap<String, String>) -> (Vec<String>, Vec<String>) {
    let lower_map: HashMap<String, String> = headers
        .iter()
        .map(|(k, v)| (k.to_ascii_lowercase(), v.clone()))
        .collect();

    let missing = RECOMMENDED_SECURITY_HEADERS
        .iter()
        .filter(|h| !lower_map.contains_key(**h))
        .map(|h| (*h).to_string())
        .collect::<Vec<_>>();

    let leaks = INFO_LEAK_HEADERS
        .iter()
        .filter_map(|h| {
            lower_map
                .get(*h)
                .map(|val| format!("Header '{}' exposes stack detail: '{}'", h, val))
        })
        .collect::<Vec<_>>();

    (missing, leaks)
}

pub async fn audit_endpoint_headers_and_tls(
    raw_url: &str,
    include_tls: bool,
) -> Result<NativeSecurityHeaderAudit, AppError> {
    let parsed = Url::parse(raw_url.trim())
        .map_err(|e| AppError::new("INVALID_URL", format!("Invalid audit target URL: {}", e), true))?;

    let scheme = parsed.scheme().to_ascii_lowercase();
    if scheme != "http" && scheme != "https" {
        return Err(AppError::new(
            "UNSUPPORTED_PROTOCOL",
            "Security header audit requires HTTP or HTTPS URL",
            true,
        ));
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| AppError::new("CLIENT_INIT_FAILED", e.to_string(), false))?;

    let resp = client
        .get(parsed.as_str())
        .send()
        .await
        .map_err(|e| AppError::new("AUDIT_REQUEST_FAILED", e.to_string(), true))?;

    let final_url = resp.url().to_string();
    let status_code = resp.status().as_u16();
    let mut header_map = HashMap::new();
    for (name, val) in resp.headers() {
        header_map.insert(
            name.as_str().to_string(),
            val.to_str().unwrap_or("<non-utf8>").to_string(),
        );
    }

    let (missing_headers, info_leak_warnings) = evaluate_security_headers(&header_map);
    let is_https = final_url.to_ascii_lowercase().starts_with("https://");

    let certificate = if include_tls && is_https {
        inspect_certificate_native(&final_url).await.ok()
    } else {
        None
    };

    Ok(NativeSecurityHeaderAudit {
        url: raw_url.to_string(),
        final_url,
        status_code,
        is_https,
        response_headers: header_map,
        missing_headers,
        info_leak_warnings,
        certificate,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_missing_headers_and_server_leak() {
        let mut hdrs = HashMap::new();
        hdrs.insert("Server".into(), "nginx/1.24.0".into());
        hdrs.insert("X-Content-Type-Options".into(), "nosniff".into());

        let (missing, leaks) = evaluate_security_headers(&hdrs);
        assert!(missing.contains(&"strict-transport-security".to_string()));
        assert!(!missing.contains(&"x-content-type-options".to_string()));
        assert_eq!(leaks.len(), 1);
    }
}
