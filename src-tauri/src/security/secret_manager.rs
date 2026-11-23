use crate::models::{AppError, NativeProxyConfig};
use crate::security::credential_store::CredentialStore;
use std::collections::HashMap;

const SENSITIVE_HEADER_NAMES: &[&str] = &[
    "authorization",
    "proxy-authorization",
    "x-api-key",
    "x-auth-token",
    "cookie",
    "set-cookie",
];

/// Masks sensitive HTTP header values for UI diagnostics or log output.
pub fn redact_headers(headers: &HashMap<String, String>) -> HashMap<String, String> {
    let mut sanitized = HashMap::with_capacity(headers.len());
    for (k, v) in headers {
        let lower = k.to_ascii_lowercase();
        if SENSITIVE_HEADER_NAMES.contains(&lower.as_str()) || lower.contains("secret") || lower.contains("token") {
            sanitized.insert(k.clone(), mask_secret_preview(v));
        } else {
            sanitized.insert(k.clone(), v.clone());
        }
    }
    sanitized
}

pub fn mask_secret_preview(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.len() <= 6 {
        return "******".to_string();
    }
    format!("{}***{}", &trimmed[..2], &trimmed[trimmed.len() - 2..])
}

/// Resolves an optional `credential_ref` from OS keyring into the proxy password if no direct override was provided.
pub fn resolve_proxy_password(proxy: &NativeProxyConfig) -> Result<Option<String>, AppError> {
    if let Some(pwd) = &proxy.password {
        if !pwd.is_empty() {
            return Ok(Some(pwd.clone()));
        }
    }
    if let Some(cred_ref) = &proxy.credential_ref {
        if !cred_ref.trim().is_empty() {
            return CredentialStore::get_secret(cred_ref);
        }
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_sensitive_headers_preserving_non_sensitive() {
        let mut h = HashMap::new();
        h.insert("Authorization".to_string(), "Bearer super_secret_token_99".to_string());
        h.insert("Content-Type".to_string(), "application/json".to_string());
        h.insert("X-Api-Key".to_string(), "abc12345xyz".to_string());

        let clean = redact_headers(&h);
        assert_eq!(clean.get("Content-Type").unwrap(), "application/json");
        assert!(!clean.get("Authorization").unwrap().contains("super_secret_token"));
        assert!(!clean.get("X-Api-Key").unwrap().contains("abc12345xyz"));
    }
}
