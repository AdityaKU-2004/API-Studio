use crate::models::{AppError, NativeProxyConfig};
use crate::security::secret_manager::resolve_proxy_password;
use std::sync::RwLock;
use url::Url;

pub struct ProxyState {
    global_proxy: RwLock<Option<NativeProxyConfig>>,
}

impl Default for ProxyState {
    fn default() -> Self {
        Self {
            global_proxy: RwLock::new(None),
        }
    }
}

impl ProxyState {
    pub fn set_global_proxy(&self, config: Option<NativeProxyConfig>) -> Result<(), AppError> {
        let mut guard = self
            .global_proxy
            .write()
            .map_err(|_| AppError::new("PROXY_LOCK_ERROR", "Proxy state lock poisoned", true))?;
        *guard = config;
        Ok(())
    }

    pub fn get_global_proxy(&self) -> Option<NativeProxyConfig> {
        self.global_proxy.read().ok().and_then(|g| g.clone())
    }
}

pub fn should_bypass_proxy(target_url: &str, bypass_list: &[String]) -> bool {
    let parsed = match Url::parse(target_url) {
        Ok(u) => u,
        Err(_) => return false,
    };
    let host = match parsed.host_str() {
        Some(h) => h.to_ascii_lowercase(),
        None => return false,
    };

    for pattern_raw in bypass_list {
        let pattern = pattern_raw.trim().to_ascii_lowercase();
        if pattern.is_empty() {
            continue;
        }
        if pattern == "*" {
            return true;
        }
        if let Some(suffix) = pattern.strip_prefix("*.") {
            if host == suffix || host.ends_with(&format!(".{}", suffix)) {
                return true;
            }
        } else if let Some(suffix) = pattern.strip_prefix('.') {
            if host == suffix || host.ends_with(&pattern) {
                return true;
            }
        } else if host == pattern {
            return true;
        }
    }
    false
}

pub struct ResolvedProxy {
    pub reqwest_proxy: reqwest::Proxy,
    pub redacted_display: String,
}

pub fn resolve_effective_proxy(
    target_url: &str,
    request_override: Option<&NativeProxyConfig>,
    global_proxy: Option<&NativeProxyConfig>,
) -> Result<Option<ResolvedProxy>, AppError> {
    let candidate = match request_override {
        Some(ov) => Some(ov),
        None => global_proxy,
    };

    let cfg = match candidate {
        Some(c) if c.enabled => c,
        _ => return Ok(None),
    };

    if should_bypass_proxy(target_url, &cfg.bypass_list) {
        return Ok(None);
    }

    let host = cfg.host.trim();
    if host.is_empty() || cfg.port == 0 {
        return Err(AppError::new(
            "INVALID_PROXY_CONFIG",
            "Enabled proxy configuration requires a valid host and port",
            true,
        ));
    }

    let proto = match cfg.protocol.to_ascii_lowercase().as_str() {
        "http" => "http",
        "https" => "https",
        "socks5" | "socks5h" => "socks5h",
        other => {
            return Err(AppError::new(
                "UNSUPPORTED_PROXY_PROTOCOL",
                format!("Unsupported proxy protocol '{}'", other),
                true,
            ))
        }
    };

    let proxy_url = format!("{}://{}:{}", proto, host, cfg.port);
    let mut proxy = reqwest::Proxy::all(&proxy_url).map_err(|e| {
        AppError::new("INVALID_PROXY_URL", "Failed to construct proxy URL", true)
            .with_details(e.to_string())
    })?;

    let password = resolve_proxy_password(cfg)?;
    let redacted_display = if let Some(user) = cfg.username.as_deref().filter(|u| !u.is_empty()) {
        if let Some(pwd) = password.as_deref() {
            proxy = proxy.basic_auth(user, pwd);
            format!("{}://{}:***@{}:{}", proto, user, host, cfg.port)
        } else {
            proxy = proxy.basic_auth(user, "");
            format!("{}://{}@{}:{}", proto, user, host, cfg.port)
        }
    } else {
        proxy_url
    };

    Ok(Some(ResolvedProxy {
        reqwest_proxy: proxy,
        redacted_display,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn evaluates_proxy_bypass_rules_accurately() {
        let rules = vec![
            "localhost".to_string(),
            "*.internal.corp".to_string(),
            "127.0.0.1".to_string(),
        ];
        assert!(should_bypass_proxy("http://localhost:3000/api", &rules));
        assert!(should_bypass_proxy("https://auth.internal.corp/token", &rules));
        assert!(!should_bypass_proxy("https://api.github.com/users", &rules));
    }

    #[test]
    fn masks_proxy_password_in_redacted_display() {
        let cfg = NativeProxyConfig {
            enabled: true,
            protocol: "http".to_string(),
            host: "proxy.example.com".to_string(),
            port: 8080,
            username: Some("alice".to_string()),
            password: Some("s3cr3t!".to_string()),
            credential_ref: None,
            bypass_list: vec![],
        };
        let resolved = resolve_effective_proxy("https://api.github.com", Some(&cfg), None)
            .unwrap()
            .unwrap();
        assert!(!resolved.redacted_display.contains("s3cr3t!"));
        assert_eq!(resolved.redacted_display, "http://alice:***@proxy.example.com:8080");
    }
}
