use crate::models::{
    AppError, CertificateChainNode, NativeCertificateDetails, NativeCertificateInspectionResult,
};
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::client::WebPkiServerVerifier;
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{ClientConfig, DigitallySignedStruct, RootCertStore, SignatureScheme};
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex};
use tokio::net::TcpStream;
use tokio_rustls::TlsConnector;
use x509_parser::extensions::GeneralName;
use x509_parser::prelude::*;

#[derive(Debug)]
struct InspectionCapture {
    trust_verified: bool,
    verification_error: Option<String>,
}

/// Non-mutating TLS certificate verifier wrapper used STRICTLY for SSL Inspector diagnostics.
/// Evaluates real WebPKI trust against OS root certificates and records pass/fail honestly while
/// still allowing the handshake to finish in-memory so expired/self-signed chain metadata can be inspected.
#[derive(Debug)]
struct InspectingVerifier {
    inner: Arc<WebPkiServerVerifier>,
    capture: Arc<Mutex<InspectionCapture>>,
}

impl ServerCertVerifier for InspectingVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        intermediates: &[CertificateDer<'_>],
        server_name: &ServerName<'_>,
        ocsp_response: &[u8],
        now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        let res = self
            .inner
            .verify_server_cert(end_entity, intermediates, server_name, ocsp_response, now);
        if let Ok(mut guard) = self.capture.lock() {
            match &res {
                Ok(_) => {
                    guard.trust_verified = true;
                    guard.verification_error = None;
                }
                Err(err) => {
                    guard.trust_verified = false;
                    guard.verification_error = Some(err.to_string());
                }
            }
        }
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        self.inner.verify_tls12_signature(message, cert, dss)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        self.inner.verify_tls13_signature(message, cert, dss)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.inner.supported_verify_schemes()
    }
}

fn sha256_colon_hex(der: &[u8]) -> String {
    let digest = Sha256::digest(der);
    digest
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(":")
}

fn format_serial_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(":")
}

pub fn check_san_hostname_match(hostname: &str, sans: &[String], subject_cn: &str) -> bool {
    let target = hostname.trim().to_ascii_lowercase();
    if target.is_empty() {
        return false;
    }

    let match_pattern = |pattern: &str| -> bool {
        let p = pattern.trim().to_ascii_lowercase();
        if p == target {
            return true;
        }
        if let Some(suffix) = p.strip_prefix("*.") {
            if let Some(dot_idx) = target.find('.') {
                let target_parent = &target[dot_idx + 1..];
                return target_parent == suffix;
            }
        }
        false
    };

    if !sans.is_empty() {
        return sans.iter().any(|s| match_pattern(s));
    }

    match_pattern(subject_cn)
}

fn parse_certificate_details(
    hostname: &str,
    chain_der: &[CertificateDer<'_>],
    protocol: String,
    cipher_suite: String,
    trust_verified: bool,
    verification_error: Option<String>,
) -> Result<NativeCertificateDetails, AppError> {
    let leaf_der = chain_der.first().ok_or_else(|| {
        AppError::new("NO_PEER_CERTIFICATE", "Server did not present a TLS certificate", true)
    })?;

    let (_, leaf) = X509Certificate::from_der(leaf_der.as_ref()).map_err(|e| {
        AppError::new("X509_PARSE_ERROR", "Failed to parse peer X.509 certificate", true)
            .with_details(e.to_string())
    })?;

    let mut sans = Vec::new();
    if let Ok(Some(san_ext)) = leaf.subject_alternative_name() {
        for name in &san_ext.value.general_names {
            match name {
                GeneralName::DNSName(d) => sans.push(d.to_string()),
                GeneralName::IPAddress(ip_bytes) => {
                    if ip_bytes.len() == 4 {
                        sans.push(format!(
                            "{}.{}.{}.{}",
                            ip_bytes[0], ip_bytes[1], ip_bytes[2], ip_bytes[3]
                        ));
                    } else {
                        sans.push(format!("IP({} bytes)", ip_bytes.len()));
                    }
                }
                _ => {}
            }
        }
    }

    let subject_cn = leaf
        .subject()
        .iter_common_name()
        .next()
        .and_then(|cn| cn.as_str().ok())
        .unwrap_or("")
        .to_string();

    let now_secs = chrono::Utc::now().timestamp();
    let not_before = leaf.validity().not_before.timestamp();
    let not_after = leaf.validity().not_after.timestamp();
    let is_expired = now_secs > not_after;
    let not_yet_valid = now_secs < not_before;
    let days_remaining = (not_after - now_secs) / 86_400;

    let hostname_match = check_san_hostname_match(hostname, &sans, &subject_cn);

    let pk_alg = leaf.public_key().algorithm.algorithm.to_id_string();
    let pk_bits = leaf.public_key().parsed().ok().map(|pk| pk.key_size());

    let mut chain = Vec::with_capacity(chain_der.len());
    for (idx, cert_der) in chain_der.iter().enumerate() {
        if let Ok((_, cert)) = X509Certificate::from_der(cert_der.as_ref()) {
            let ca = cert
                .basic_constraints()
                .ok()
                .flatten()
                .map(|bc| bc.value.ca)
                .unwrap_or(false);
            let exp = now_secs > cert.validity().not_after.timestamp();
            chain.push(CertificateChainNode {
                level: idx,
                subject: cert.subject().to_string(),
                issuer: cert.issuer().to_string(),
                valid_from: cert.validity().not_before.to_rfc2822().unwrap_or_else(|_| cert.validity().not_before.to_string()),
                valid_to: cert.validity().not_after.to_rfc2822().unwrap_or_else(|_| cert.validity().not_after.to_string()),
                serial_number: format_serial_hex(cert.raw_serial()),
                signature_algorithm: cert.signature_algorithm.algorithm.to_id_string(),
                fingerprint_sha256: sha256_colon_hex(cert_der.as_ref()),
                is_ca: ca,
                is_expired: exp,
            });
        }
    }

    Ok(NativeCertificateDetails {
        subject: leaf.subject().to_string(),
        issuer: leaf.issuer().to_string(),
        valid_from: leaf.validity().not_before.to_rfc2822().unwrap_or_else(|_| leaf.validity().not_before.to_string()),
        valid_to: leaf.validity().not_after.to_rfc2822().unwrap_or_else(|_| leaf.validity().not_after.to_string()),
        serial_number: format_serial_hex(leaf.raw_serial()),
        signature_algorithm: leaf.signature_algorithm.algorithm.to_id_string(),
        public_key_algorithm: pk_alg,
        public_key_bits: pk_bits,
        fingerprint_sha256: sha256_colon_hex(leaf_der.as_ref()),
        subject_alt_names: sans,
        protocol,
        cipher_suite,
        is_expired,
        not_yet_valid,
        days_remaining,
        hostname_match,
        trust_verified,
        verification_error,
        chain,
    })
}

pub async fn inspect_tls_certificate(
    raw_input: &str,
    default_port: u16,
) -> Result<NativeCertificateInspectionResult, AppError> {
    let checked_at = chrono::Utc::now().timestamp_millis();
    let trimmed = raw_input.trim();
    if trimmed.is_empty() {
        return Err(AppError::new(
            "INVALID_TARGET",
            "Hostname or HTTPS URL is required for TLS inspection",
            true,
        ));
    }

    let (hostname, port, protocol_supported) = if trimmed.contains("://") {
        let parsed = url::Url::parse(trimmed).map_err(|e| {
            AppError::new("INVALID_URL", "Invalid URL supplied to TLS inspector", true)
                .with_details(e.to_string())
        })?;
        let supported = matches!(parsed.scheme(), "https" | "wss");
        let host = parsed.host_str().unwrap_or("").to_string();
        let p = parsed.port().unwrap_or(if supported { 443 } else { 80 });
        (host, p, supported)
    } else if let Some((h, p_str)) = trimmed.split_once(':') {
        let p = p_str.parse::<u16>().unwrap_or(default_port);
        (h.to_string(), p, true)
    } else {
        (trimmed.to_string(), default_port, true)
    };

    if hostname.is_empty() {
        return Err(AppError::new("INVALID_HOST", "Could not extract hostname", true));
    }

    if !protocol_supported {
        return Ok(NativeCertificateInspectionResult {
            hostname,
            port,
            checked_at,
            protocol_supported: false,
            notice: "Plaintext HTTP/WS target has no TLS certificate to inspect.".to_string(),
            certificate: None,
        });
    }

    let mut root_store = RootCertStore::empty();
    let native_certs = rustls_native_certs::load_native_certs();
    for cert in native_certs.certs {
        let _ = root_store.add(cert);
    }

    let webpki_verifier = WebPkiServerVerifier::builder(Arc::new(root_store))
        .build()
        .map_err(|e| {
            AppError::new("TLS_VERIFIER_INIT_ERROR", "Failed to initialize system TLS verifier", false)
                .with_details(e.to_string())
        })?;

    let capture = Arc::new(Mutex::new(InspectionCapture {
        trust_verified: false,
        verification_error: None,
    }));

    let custom_verifier = Arc::new(InspectingVerifier {
        inner: webpki_verifier,
        capture: Arc::clone(&capture),
    });

    let config = ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(custom_verifier)
        .with_no_client_auth();

    let connector = TlsConnector::from(Arc::new(config));

    let tcp = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        TcpStream::connect((hostname.as_str(), port)),
    )
    .await
    .map_err(|_| AppError::new("TLS_CONNECT_TIMEOUT", "TCP connection for TLS inspection timed out", true))?
    .map_err(|e| {
        AppError::new("TLS_TCP_CONNECT_ERROR", format!("Failed to connect to {}:{}", hostname, port), true)
            .with_details(e.to_string())
    })?;

    let server_name = ServerName::try_from(hostname.clone()).map_err(|e| {
        AppError::new("INVALID_SERVER_NAME", "Invalid DNS hostname or IP for TLS SNI", true)
            .with_details(e.to_string())
    })?;

    let tls_stream = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        connector.connect(server_name, tcp),
    )
    .await
    .map_err(|_| AppError::new("TLS_HANDSHAKE_TIMEOUT", "TLS handshake timed out", true))?
    .map_err(|e| {
        AppError::new("TLS_HANDSHAKE_FAILED", "TLS handshake failed", true)
            .with_details(e.to_string())
    })?;

    let (_, conn_data) = tls_stream.get_ref();
    let protocol = conn_data
        .protocol_version()
        .map(|v| format!("{:?}", v))
        .unwrap_or_else(|| "Unknown".to_string());
    let cipher_suite = conn_data
        .negotiated_cipher_suite()
        .map(|cs| format!("{:?}", cs.suite()))
        .unwrap_or_else(|| "Unknown".to_string());

    let peer_certs = conn_data.peer_certificates().ok_or_else(|| {
        AppError::new("NO_PEER_CERTIFICATE", "No peer X.509 certificates received", true)
    })?;

    let (trust_verified, verification_error) = capture
        .lock()
        .map(|g| (g.trust_verified, g.verification_error.clone()))
        .unwrap_or((false, Some("Inspection lock unavailable".to_string())));

    let details = parse_certificate_details(
        &hostname,
        peer_certs,
        protocol,
        cipher_suite,
        trust_verified,
        verification_error,
    )?;

    let notice = if details.trust_verified && details.hostname_match && !details.is_expired {
        format!("Verified TLS chain for {}:{} via system trust store.", hostname, port)
    } else {
        format!(
            "Certificate retrieved for {}:{}, but validation reported warnings.",
            hostname, port
        )
    };

    Ok(NativeCertificateInspectionResult {
        hostname,
        port,
        checked_at,
        protocol_supported: true,
        notice,
        certificate: Some(details),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_wildcard_and_exact_sans() {
        let sans = vec!["*.github.com".to_string(), "github.com".to_string()];
        assert!(check_san_hostname_match("api.github.com", &sans, ""));
        assert!(check_san_hostname_match("github.com", &sans, ""));
        assert!(!check_san_hostname_match("sub.api.github.com", &sans, ""));
        assert!(!check_san_hostname_match("evil.com", &sans, ""));
    }
}
