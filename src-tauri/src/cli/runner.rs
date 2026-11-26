use crate::database::migrations::run_migrations;
use crate::database::repositories::list_entities_json;
use crate::models::{
    NativeCliExecutionSummary, NativePerformanceRunConfig, NativePerformanceTargetRequest,
};
use crate::performance::engine::{execute_load_test, PerformanceRunRegistry};
use crate::security_audit::auditor::audit_endpoint_headers_and_tls;
use crate::utils::path_security::validate_safe_file_path;
use reqwest::{Client, Method};
use rusqlite::Connection;
use serde_json::Value;
use std::collections::HashMap;
use std::time::{Duration, Instant};

pub const EXIT_OK: i32 = 0;
pub const EXIT_FAILURE: i32 = 1;
pub const EXIT_CONFIG_ERROR: i32 = 2;
pub const EXIT_EXECUTION_ERROR: i32 = 3;

pub fn format_junit_xml(suite_name: &str, summary: &NativeCliExecutionSummary) -> String {
    let escaped_suite = suite_name
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;");
    let mut xml = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<testsuite name=\"{}\" tests=\"{}\" failures=\"{}\" time=\"{:.3}\">\n",
        escaped_suite,
        summary.total,
        summary.failed,
        (summary.duration_ms as f64) / 1000.0
    );
    for (idx, detail) in summary.details.iter().enumerate() {
        let esc_detail = detail
            .replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;");
        let is_fail = detail.starts_with("FAIL:") || detail.starts_with("ERROR:");
        xml.push_str(&format!(
            "  <testcase classname=\"{}\" name=\"check_{}\" time=\"0.000\">\n",
            escaped_suite,
            idx + 1
        ));
        if is_fail {
            xml.push_str(&format!("    <failure message=\"{}\" />\n", esc_detail));
        }
        xml.push_str("  </testcase>\n");
    }
    xml.push_str("</testsuite>\n");
    xml
}

pub fn load_sqlite_project(db_path: &str) -> Result<Connection, i32> {
    let safe = validate_safe_file_path(db_path, true, Some(&["db", "sqlite", "sqlite3"]))
        .map_err(|_| EXIT_CONFIG_ERROR)?;
    let mut conn = Connection::open(safe).map_err(|_| EXIT_EXECUTION_ERROR)?;
    run_migrations(&mut conn).map_err(|_| EXIT_EXECUTION_ERROR)?;
    Ok(conn)
}

pub fn validate_openapi_file(spec_path: &str) -> NativeCliExecutionSummary {
    let started = Instant::now();
    let safe = match validate_safe_file_path(spec_path, true, Some(&["json", "yaml", "yml"])) {
        Ok(p) => p,
        Err(e) => {
            return NativeCliExecutionSummary {
                exit_code: EXIT_CONFIG_ERROR,
                status: "config-error".into(),
                total: 1,
                passed: 0,
                failed: 1,
                duration_ms: started.elapsed().as_millis() as u64,
                details: vec![format!("ERROR: {}", e.message)],
            };
        }
    };

    let raw = match std::fs::read_to_string(&safe) {
        Ok(c) => c,
        Err(e) => {
            return NativeCliExecutionSummary {
                exit_code: EXIT_EXECUTION_ERROR,
                status: "execution-error".into(),
                total: 1,
                passed: 0,
                failed: 1,
                duration_ms: started.elapsed().as_millis() as u64,
                details: vec![format!("ERROR: Failed to read spec file: {}", e)],
            };
        }
    };

    let mut details = Vec::new();
    let has_openapi_marker = raw.contains("\"openapi\"") || raw.contains("openapi:");
    let has_paths = raw.contains("\"paths\"") || raw.contains("paths:");

    if let Ok(json_val) = serde_json::from_str::<Value>(&raw) {
        if json_val.get("openapi").is_none() || json_val.get("paths").is_none() {
            details.push("FAIL: JSON OpenAPI spec missing 'openapi' or 'paths' root field".into());
            return NativeCliExecutionSummary {
                exit_code: EXIT_FAILURE,
                status: "failed".into(),
                total: 1,
                passed: 0,
                failed: 1,
                duration_ms: started.elapsed().as_millis() as u64,
                details,
            };
        }
    } else if !(has_openapi_marker && has_paths) {
        details.push("FAIL: OpenAPI document missing required 'openapi' and 'paths' sections".into());
        return NativeCliExecutionSummary {
            exit_code: EXIT_FAILURE,
            status: "failed".into(),
            total: 1,
            passed: 0,
            failed: 1,
            duration_ms: started.elapsed().as_millis() as u64,
            details,
        };
    }

    details.push(format!("PASS: Validated OpenAPI specification '{}'", safe.display()));
    NativeCliExecutionSummary {
        exit_code: EXIT_OK,
        status: "passed".into(),
        total: 1,
        passed: 1,
        failed: 0,
        duration_ms: started.elapsed().as_millis() as u64,
        details,
    }
}

pub async fn run_collection_from_sqlite(
    db_path: &str,
    collection_name: Option<&str>,
    timeout_seconds: u64,
) -> NativeCliExecutionSummary {
    let started = Instant::now();
    let conn = match load_sqlite_project(db_path) {
        Ok(c) => c,
        Err(code) => {
            return NativeCliExecutionSummary {
                exit_code: code,
                status: "error".into(),
                total: 0,
                passed: 0,
                failed: 1,
                duration_ms: started.elapsed().as_millis() as u64,
                details: vec!["ERROR: Unable to open SQLite project database".into()],
            };
        }
    };

    let collections = list_entities_json(&conn, "collections").unwrap_or_default();
    let requests = list_entities_json(&conn, "requests").unwrap_or_default();

    let target_col_id = collection_name.and_then(|name| {
        collections
            .iter()
            .find(|c| {
                c.get("name")
                    .and_then(|v| v.as_str())
                    .map(|s| s.eq_ignore_ascii_case(name))
                    .unwrap_or(false)
            })
            .and_then(|c| c.get("id").and_then(|v| v.as_str()))
            .map(|s| s.to_string())
    });

    if collection_name.is_some() && target_col_id.is_none() {
        return NativeCliExecutionSummary {
            exit_code: EXIT_CONFIG_ERROR,
            status: "config-error".into(),
            total: 0,
            passed: 0,
            failed: 1,
            duration_ms: started.elapsed().as_millis() as u64,
            details: vec![format!(
                "ERROR: Collection '{}' not found in SQLite database",
                collection_name.unwrap_or_default()
            )],
        };
    }

    let matched: Vec<&Value> = requests
        .iter()
        .filter(|r| match &target_col_id {
            Some(cid) => r.get("collectionId").and_then(|v| v.as_str()) == Some(cid.as_str()),
            None => true,
        })
        .collect();

    if matched.is_empty() {
        return NativeCliExecutionSummary {
            exit_code: EXIT_CONFIG_ERROR,
            status: "config-error".into(),
            total: 0,
            passed: 0,
            failed: 1,
            duration_ms: started.elapsed().as_millis() as u64,
            details: vec!["ERROR: No executable requests found in selection".into()],
        };
    }

    let client = match Client::builder()
        .timeout(Duration::from_secs(timeout_seconds.max(5)))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return NativeCliExecutionSummary {
                exit_code: EXIT_EXECUTION_ERROR,
                status: "execution-error".into(),
                total: 0,
                passed: 0,
                failed: 1,
                duration_ms: started.elapsed().as_millis() as u64,
                details: vec![format!("ERROR: {}", e)],
            };
        }
    };

    let mut passed = 0usize;
    let mut failed = 0usize;
    let mut details = Vec::new();

    for req in &matched {
        let name = req.get("name").and_then(|v| v.as_str()).unwrap_or("Request");
        let url = req.get("url").and_then(|v| v.as_str()).unwrap_or("");
        let method_str = req.get("method").and_then(|v| v.as_str()).unwrap_or("GET");
        let method = Method::from_bytes(method_str.as_bytes()).unwrap_or(Method::GET);

        match client.request(method, url).send().await {
            Ok(resp) if resp.status().is_success() => {
                passed += 1;
                details.push(format!("PASS: {} {} -> HTTP {}", method_str, url, resp.status().as_u16()));
            }
            Ok(resp) => {
                failed += 1;
                details.push(format!("FAIL: {} {} ({}) -> HTTP {}", method_str, url, name, resp.status().as_u16()));
            }
            Err(e) => {
                failed += 1;
                details.push(format!("FAIL: {} {} -> {}", method_str, url, e));
            }
        }
    }

    NativeCliExecutionSummary {
        exit_code: if failed == 0 { EXIT_OK } else { EXIT_FAILURE },
        status: if failed == 0 { "passed" } else { "failed" }.into(),
        total: matched.len(),
        passed,
        failed,
        duration_ms: started.elapsed().as_millis() as u64,
        details,
    }
}

pub async fn run_security_audit_cli(target_url: &str) -> NativeCliExecutionSummary {
    let started = Instant::now();
    match audit_endpoint_headers_and_tls(target_url, true).await {
        Ok(audit) => {
            let mut details = Vec::new();
            let mut failed = 0usize;
            if !audit.is_https {
                failed += 1;
                details.push(format!("FAIL: Endpoint '{}' does not enforce HTTPS", target_url));
            } else {
                details.push(format!("PASS: Endpoint uses HTTPS ({})", audit.final_url));
            }
            for h in &audit.missing_headers {
                details.push(format!("WARN: Recommended security header '{}' missing", h));
            }
            for leak in &audit.info_leak_warnings {
                details.push(format!("WARN: {}", leak));
            }
            NativeCliExecutionSummary {
                exit_code: if failed == 0 { EXIT_OK } else { EXIT_FAILURE },
                status: if failed == 0 { "passed" } else { "failed" }.into(),
                total: 1 + audit.missing_headers.len(),
                passed: if audit.is_https { 1 } else { 0 },
                failed,
                duration_ms: started.elapsed().as_millis() as u64,
                details,
            }
        }
        Err(e) => NativeCliExecutionSummary {
            exit_code: EXIT_EXECUTION_ERROR,
            status: "execution-error".into(),
            total: 1,
            passed: 0,
            failed: 1,
            duration_ms: started.elapsed().as_millis() as u64,
            details: vec![format!("ERROR: {}", e.message)],
        },
    }
}

pub async fn run_smoke_performance_cli(
    target_url: &str,
    vus: u32,
    duration_seconds: u64,
) -> NativeCliExecutionSummary {
    let started = Instant::now();
    let cfg = NativePerformanceRunConfig {
        run_id: uuid::Uuid::new_v4().to_string(),
        mode: "smoke".into(),
        virtual_users: vus.clamp(1, 50),
        duration_seconds: duration_seconds.clamp(1, 300),
        ramp_up_seconds: 0,
        ramp_down_seconds: 0,
        request_delay_ms: 50,
        max_requests_per_second: 100,
        timeout_ms: 5000,
        verify_ssl: Some(true),
        targets: vec![NativePerformanceTargetRequest {
            id: "cli-target".into(),
            name: "CLI Target".into(),
            method: "GET".into(),
            url: target_url.to_string(),
            headers: HashMap::new(),
            body: None,
        }],
    };
    let registry = PerformanceRunRegistry::default();
    match execute_load_test(cfg, &registry).await {
        Ok(res) => {
            let failed = usize::from(res.summary.error_rate_percent > 5.0);
            NativeCliExecutionSummary {
                exit_code: if failed == 0 { EXIT_OK } else { EXIT_FAILURE },
                status: res.status,
                total: res.summary.total_requests,
                passed: res.summary.successful_requests,
                failed: res.summary.failed_requests,
                duration_ms: res.duration_ms,
                details: vec![format!(
                    "RPS: {:.2}, Avg: {:.1}ms, P95: {:.1}ms, Error Rate: {:.2}%",
                    res.summary.requests_per_second,
                    res.summary.avg_response_time_ms,
                    res.summary.p95_response_time_ms,
                    res.summary.error_rate_percent
                )],
            }
        }
        Err(e) => NativeCliExecutionSummary {
            exit_code: EXIT_CONFIG_ERROR,
            status: "config-error".into(),
            total: 0,
            passed: 0,
            failed: 1,
            duration_ms: started.elapsed().as_millis() as u64,
            details: vec![format!("ERROR: {}", e.message)],
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_valid_junit_xml_for_ci_pipelines() {
        let summary = NativeCliExecutionSummary {
            exit_code: 1,
            status: "failed".into(),
            total: 2,
            passed: 1,
            failed: 1,
            duration_ms: 420,
            details: vec![
                "PASS: GET https://example.com -> HTTP 200".into(),
                "FAIL: POST https://example.com -> HTTP 500".into(),
            ],
        };
        let xml = format_junit_xml("api-studio-suite", &summary);
        assert!(xml.contains("<testsuite name=\"api-studio-suite\" tests=\"2\" failures=\"1\""));
        assert!(xml.contains("<failure message=\"FAIL: POST"));
    }
}
