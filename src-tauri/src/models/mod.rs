use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
    pub recoverable: bool,
}

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>, recoverable: bool) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
            recoverable,
        }
    }

    pub fn with_details(mut self, details: impl Into<String>) -> Self {
        self.details = Some(details.into());
        self
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        Self::new("DATABASE_ERROR", "SQLite database operation failed", true)
            .with_details(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        Self::new("IO_ERROR", "Filesystem operation failed", true).with_details(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        Self::new("SERIALIZATION_ERROR", "JSON serialization/deserialization failed", true)
            .with_details(err.to_string())
    }
}

// ===================== Proxy & TLS Config =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeProxyConfig {
    pub enabled: bool,
    pub protocol: String, // "http" | "https" | "socks5"
    pub host: String,
    pub port: u16,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub credential_ref: Option<String>,
    #[serde(default)]
    pub bypass_list: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeTlsConfig {
    #[serde(default = "default_true")]
    pub verify_ssl: bool,
    #[serde(default)]
    pub custom_ca_pem: Option<String>,
    #[serde(default)]
    pub client_cert_pem: Option<String>,
    #[serde(default)]
    pub client_key_pem: Option<String>,
}

impl Default for NativeTlsConfig {
    fn default() -> Self {
        Self {
            verify_ssl: true,
            custom_ca_pem: None,
            client_cert_pem: None,
            client_key_pem: None,
        }
    }
}

fn default_true() -> bool {
    true
}

// ===================== HTTP Models =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeFormPart {
    pub key: String,
    pub part_type: String, // "text" | "file"
    #[serde(default)]
    pub value: Option<String>,
    #[serde(default)]
    pub file_name: Option<String>,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default)]
    pub base64_data: Option<String>,
    #[serde(default)]
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeHttpRequest {
    pub execution_id: String,
    pub tab_id: String,
    pub request_id: String,
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub body_mode: String, // "none" | "raw" | "x-www-form-urlencoded" | "form-data" | "binary"
    #[serde(default)]
    pub raw_body: Option<String>,
    #[serde(default)]
    pub form_url_encoded: Vec<(String, String)>,
    #[serde(default)]
    pub form_parts: Vec<NativeFormPart>,
    #[serde(default)]
    pub binary_base64: Option<String>,
    #[serde(default)]
    pub binary_file_path: Option<String>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default = "default_true")]
    pub follow_redirects: bool,
    #[serde(default)]
    pub max_redirects: Option<usize>,
    #[serde(default)]
    pub tls: Option<NativeTlsConfig>,
    #[serde(default)]
    pub proxy: Option<NativeProxyConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeTimingBreakdown {
    pub start_time: i64,
    pub headers_received_time: i64,
    pub end_time: i64,
    pub duration_ms: u64,
    pub prepare_ms: u64,
    pub dns_lookup_ms: Option<u64>,
    pub tcp_connect_ms: Option<u64>,
    pub tls_handshake_ms: Option<u64>,
    pub ttfb_ms: u64,
    pub download_ms: u64,
    pub socket_reused: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub effective_proxy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeResponseCookie {
    pub name: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domain: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires: Option<String>,
    pub http_only: bool,
    pub secure: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeHttpResponse {
    pub execution_id: String,
    pub request_id: String,
    pub status: u16,
    pub status_text: String,
    pub ok: bool,
    pub final_url: String,
    pub method: String,
    pub headers: HashMap<String, String>,
    pub cookies: Vec<NativeResponseCookie>,
    pub body_text: Option<String>,
    pub body_base64: Option<String>,
    pub is_binary: bool,
    pub content_type: String,
    pub content_encoding: Option<String>,
    pub size_bytes: usize,
    pub header_size_bytes: usize,
    pub timing: NativeTimingBreakdown,
    pub tls_verified: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tls_warning: Option<String>,
    pub received_at: String,
}

// ===================== WebSocket Models =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeWsConnectPayload {
    pub session_id: String,
    pub url: String,
    #[serde(default)]
    pub protocols: Vec<String>,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub verify_ssl: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeWsSendPayload {
    pub session_id: String,
    pub text: Option<String>,
    pub binary_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeWsMessageEvent {
    pub session_id: String,
    pub payload: String,
    pub is_binary: bool,
    pub size_bytes: usize,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeWsStatusEvent {
    pub session_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolved_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub close_code: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub close_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ===================== SSE Models =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSseConnectPayload {
    pub session_id: String,
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub last_event_id: Option<String>,
    #[serde(default)]
    pub auto_reconnect: bool,
    #[serde(default)]
    pub max_reconnect_attempts: u32,
    #[serde(default)]
    pub reconnect_delay_ms: u64,
    #[serde(default)]
    pub verify_ssl: Option<bool>,
    #[serde(default)]
    pub proxy: Option<NativeProxyConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSseEventPayload {
    pub session_id: String,
    pub id: String,
    pub timestamp: i64,
    pub event_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_id: Option<String>,
    pub data: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_ms: Option<u64>,
    pub raw_size_bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSseStatusEvent {
    pub session_id: String,
    pub status: String,
    pub attempt: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub fatal: bool,
}

// ===================== GraphQL Models =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeGraphqlExecutePayload {
    pub execution_id: String,
    pub tab_id: String,
    pub request_id: String,
    pub endpoint: String,
    pub method: String,
    pub query: String,
    #[serde(default)]
    pub variables: serde_json::Value,
    #[serde(default)]
    pub operation_name: Option<String>,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub tls: Option<NativeTlsConfig>,
    #[serde(default)]
    pub proxy: Option<NativeProxyConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeGraphqlSubscriptionPayload {
    pub session_id: String,
    pub endpoint: String,
    pub query: String,
    #[serde(default)]
    pub variables: serde_json::Value,
    #[serde(default)]
    pub operation_name: Option<String>,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub verify_ssl: Option<bool>,
}

// ===================== Certificate Models =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CertificateChainNode {
    pub level: usize,
    pub subject: String,
    pub issuer: String,
    pub valid_from: String,
    pub valid_to: String,
    pub serial_number: String,
    pub signature_algorithm: String,
    pub fingerprint_sha256: String,
    pub is_ca: bool,
    pub is_expired: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeCertificateDetails {
    pub subject: String,
    pub issuer: String,
    pub valid_from: String,
    pub valid_to: String,
    pub serial_number: String,
    pub signature_algorithm: String,
    pub public_key_algorithm: String,
    pub public_key_bits: Option<usize>,
    pub fingerprint_sha256: String,
    pub subject_alt_names: Vec<String>,
    pub protocol: String,
    pub cipher_suite: String,
    pub is_expired: bool,
    pub not_yet_valid: bool,
    pub days_remaining: i64,
    pub hostname_match: bool,
    pub trust_verified: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verification_error: Option<String>,
    pub chain: Vec<CertificateChainNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeCertificateInspectionResult {
    pub hostname: String,
    pub port: u16,
    pub checked_at: i64,
    pub protocol_supported: bool,
    pub notice: String,
    pub certificate: Option<NativeCertificateDetails>,
}

// ===================== Database & Migration Models =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseStatus {
    pub initialized: bool,
    pub db_path: String,
    pub schema_version: i64,
    pub table_counts: HashMap<String, usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexedDbMigrationPayload {
    #[serde(default)]
    pub collections: Vec<serde_json::Value>,
    #[serde(default)]
    pub folders: Vec<serde_json::Value>,
    #[serde(default)]
    pub requests: Vec<serde_json::Value>,
    #[serde(default)]
    pub environments: Vec<serde_json::Value>,
    #[serde(default)]
    pub global_variables: Vec<serde_json::Value>,
    #[serde(default)]
    pub history: Vec<serde_json::Value>,
    #[serde(default)]
    pub settings: Vec<serde_json::Value>,
    #[serde(default)]
    pub test_suites: Vec<serde_json::Value>,
    #[serde(default)]
    pub test_reports: Vec<serde_json::Value>,
    #[serde(default)]
    pub script_templates: Vec<serde_json::Value>,
    #[serde(default)]
    pub json_schemas: Vec<serde_json::Value>,
    #[serde(default)]
    pub assertion_configurations: Vec<serde_json::Value>,
    #[serde(default)]
    pub protocol_configs: Vec<serde_json::Value>,
    #[serde(default)]
    pub ws_message_templates: Vec<serde_json::Value>,
    #[serde(default)]
    pub sse_event_logs: Vec<serde_json::Value>,
    #[serde(default)]
    pub comparison_sessions: Vec<serde_json::Value>,
    #[serde(default)]
    pub developer_tool_preferences: Vec<serde_json::Value>,
    #[serde(default)]
    pub conflict_strategy: Option<String>, // "skip" | "overwrite"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationReport {
    pub success: bool,
    pub imported_counts: HashMap<String, usize>,
    pub skipped_counts: HashMap<String, usize>,
    pub verified_db_counts: HashMap<String, usize>,
    pub duration_ms: u64,
}

// ===================== Security & Diagnostics Models =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyringStatus {
    pub available: bool,
    pub backend: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticLogEntry {
    pub id: String,
    pub timestamp: i64,
    pub level: String,
    pub component: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSaveFilePayload {
    pub path: String,
    pub content_utf8: Option<String>,
    pub content_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeReadFileResult {
    pub path: String,
    pub file_name: String,
    pub size_bytes: usize,
    pub content_utf8: Option<String>,
    pub content_base64: String,
    pub is_binary: bool,
}
