use crate::models::DiagnosticLogEntry;
use std::collections::VecDeque;
use std::sync::Mutex;
use uuid::Uuid;

const MAX_LOG_ENTRIES: usize = 500;

pub struct LogBuffer {
    entries: Mutex<VecDeque<DiagnosticLogEntry>>,
}

impl Default for LogBuffer {
    fn default() -> Self {
        Self {
            entries: Mutex::new(VecDeque::with_capacity(MAX_LOG_ENTRIES)),
        }
    }
}

/// Redacts common secret patterns (Bearer tokens, Basic credentials, API keys, proxy passwords)
/// before any diagnostic message enters logs or error buffers.
pub fn sanitize_log_text(input: &str) -> String {
    let mut out = input.to_string();

    // Redact URL embedded credentials: scheme://user:pass@host -> scheme://user:***@host
    if let Some(scheme_end) = out.find("://") {
        let rest_start = scheme_end + 3;
        if let Some(at_rel) = out[rest_start..].find('@') {
            let auth_slice = &out[rest_start..rest_start + at_rel];
            if let Some(colon_rel) = auth_slice.find(':') {
                let pass_start = rest_start + colon_rel + 1;
                let pass_end = rest_start + at_rel;
                if pass_end >= pass_start {
                    out.replace_range(pass_start..pass_end, "***");
                }
            }
        }
    }

    // Mask inline Bearer / Basic header leaks
    for prefix in ["Bearer ", "Basic ", "token=", "api_key=", "apikey=", "password="] {
        if let Some(idx) = out.find(prefix) {
            let val_start = idx + prefix.len();
            let val_end = out[val_start..]
                .find(|c: char| c.is_whitespace() || c == '&' || c == ';' || c == '"')
                .map(|rel| val_start + rel)
                .unwrap_or(out.len());
            if val_end > val_start {
                out.replace_range(val_start..val_end, "[REDACTED]");
            }
        }
    }

    out
}

impl LogBuffer {
    pub fn record(&self, level: &str, component: &str, message: impl AsRef<str>) {
        let sanitized = sanitize_log_text(message.as_ref());
        let entry = DiagnosticLogEntry {
            id: Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            level: level.to_string(),
            component: component.to_string(),
            message: sanitized.clone(),
        };

        match level {
            "error" => tracing::error!(target: "api_studio", "[{}] {}", component, sanitized),
            "warn" => tracing::warn!(target: "api_studio", "[{}] {}", component, sanitized),
            _ => tracing::info!(target: "api_studio", "[{}] {}", component, sanitized),
        }

        if let Ok(mut guard) = self.entries.lock() {
            if guard.len() >= MAX_LOG_ENTRIES {
                guard.pop_front();
            }
            guard.push_back(entry);
        }
    }

    pub fn list(&self) -> Vec<DiagnosticLogEntry> {
        self.entries
            .lock()
            .map(|guard| guard.iter().cloned().collect())
            .unwrap_or_default()
    }

    pub fn clear(&self) {
        if let Ok(mut guard) = self.entries.lock() {
            guard.clear();
        }
    }
}
