use crate::models::{
    AppError, NativePerformanceMetricSample, NativePerformanceMetricsSummary,
    NativePerformanceRunConfig, NativePerformanceRunResult,
};
use reqwest::{Client, Method};
use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, AtomicUsize, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant};
use tokio::sync::Semaphore;

const MAX_VIRTUAL_USERS: u32 = 200;
const MAX_DURATION_SECONDS: u64 = 1800;
const MAX_RPS: u32 = 1000;
const MAX_STORED_LATENCY_SAMPLES: usize = 50_000;

#[derive(Default)]
pub struct PerformanceRunRegistry {
    active: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl PerformanceRunRegistry {
    pub fn register(&self, run_id: &str) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        if let Ok(mut guard) = self.active.lock() {
            guard.insert(run_id.to_string(), Arc::clone(&flag));
        }
        flag
    }

    pub fn cancel(&self, run_id: &str) -> bool {
        if let Ok(guard) = self.active.lock() {
            if let Some(flag) = guard.get(run_id) {
                flag.store(true, Ordering::SeqCst);
                return true;
            }
        }
        false
    }

    pub fn remove(&self, run_id: &str) {
        if let Ok(mut guard) = self.active.lock() {
            guard.remove(run_id);
        }
    }

    pub fn cancel_all(&self) {
        if let Ok(mut guard) = self.active.lock() {
            for flag in guard.values() {
                flag.store(true, Ordering::SeqCst);
            }
            guard.clear();
        }
    }
}

pub fn validate_run_config(config: &NativePerformanceRunConfig) -> Result<(), AppError> {
    if config.targets.is_empty() {
        return Err(AppError::new(
            "VALIDATION_ERROR",
            "Performance test requires at least one target request",
            true,
        ));
    }
    if config.virtual_users == 0 || config.virtual_users > MAX_VIRTUAL_USERS {
        return Err(AppError::new(
            "SAFETY_LIMIT_EXCEEDED",
            format!("Virtual users must be between 1 and {}", MAX_VIRTUAL_USERS),
            true,
        ));
    }
    if config.duration_seconds == 0 || config.duration_seconds > MAX_DURATION_SECONDS {
        return Err(AppError::new(
            "SAFETY_LIMIT_EXCEEDED",
            format!("Test duration must be between 1 and {} seconds", MAX_DURATION_SECONDS),
            true,
        ));
    }
    if config.max_requests_per_second == 0 || config.max_requests_per_second > MAX_RPS {
        return Err(AppError::new(
            "SAFETY_LIMIT_EXCEEDED",
            format!("Max RPS must be between 1 and {}", MAX_RPS),
            true,
        ));
    }
    for t in &config.targets {
        let lower = t.url.trim().to_ascii_lowercase();
        if !lower.starts_with("http://") && !lower.starts_with("https://") {
            return Err(AppError::new(
                "INVALID_URL",
                format!("Unsupported URL protocol for target '{}'", t.name),
                true,
            ));
        }
    }
    Ok(())
}

pub fn compute_percentile(sorted_ms: &[f64], percentile: f64) -> f64 {
    if sorted_ms.is_empty() {
        return 0.0;
    }
    if sorted_ms.len() == 1 {
        return sorted_ms[0];
    }
    let rank = (percentile / 100.0) * (sorted_ms.len() - 1) as f64;
    let lower = rank.floor() as usize;
    let upper = rank.ceil() as usize;
    let frac = rank - (lower as f64);
    sorted_ms[lower] * (1.0 - frac) + sorted_ms[upper] * frac
}

pub async fn execute_load_test(
    config: NativePerformanceRunConfig,
    registry: &PerformanceRunRegistry,
) -> Result<NativePerformanceRunResult, AppError> {
    validate_run_config(&config)?;

    let cancel_flag = registry.register(&config.run_id);
    let started_at = chrono::Utc::now().timestamp_millis();
    let started_instant = Instant::now();

    let client = Client::builder()
        .pool_max_idle_per_host(config.virtual_users.min(64) as usize)
        .danger_accept_invalid_certs(!config.verify_ssl.unwrap_or(true))
        .timeout(Duration::from_millis(config.timeout_ms.max(500)))
        .build()
        .map_err(|e| AppError::new("CLIENT_INIT_FAILED", e.to_string(), false))?;

    let semaphore = Arc::new(Semaphore::new(config.virtual_users as usize));
    let total_requests = Arc::new(AtomicUsize::new(0));
    let successful_requests = Arc::new(AtomicUsize::new(0));
    let failed_requests = Arc::new(AtomicUsize::new(0));
    let timeout_count = Arc::new(AtomicUsize::new(0));
    let total_bytes = Arc::new(AtomicUsize::new(0));
    let latencies = Arc::new(Mutex::new(Vec::<f64>::new()));
    let truncated_latencies = Arc::new(AtomicBool::new(false));
    let status_dist = Arc::new(Mutex::new(HashMap::<String, usize>::new()));
    let samples = Arc::new(Mutex::new(Vec::<NativePerformanceMetricSample>::new()));

    let total_duration = Duration::from_secs(config.duration_seconds);
    let min_interval_ms = (1000.0 / (config.max_requests_per_second as f64)).max(1.0);
    let targets = Arc::new(config.targets.clone());

    let mut handles = Vec::with_capacity(config.virtual_users as usize);
    for vu_idx in 0..config.virtual_users {
        let client = client.clone();
        let sem = Arc::clone(&semaphore);
        let cancel = Arc::clone(&cancel_flag);
        let targets = Arc::clone(&targets);
        let total_req = Arc::clone(&total_requests);
        let succ_req = Arc::clone(&successful_requests);
        let fail_req = Arc::clone(&failed_requests);
        let to_cnt = Arc::clone(&timeout_count);
        let bytes_cnt = Arc::clone(&total_bytes);
        let lats = Arc::clone(&latencies);
        let trunc = Arc::clone(&truncated_latencies);
        let statuses = Arc::clone(&status_dist);
        let mode = config.mode.clone();
        let ramp_up = config.ramp_up_seconds;
        let delay_ms = config.request_delay_ms;
        let max_vu = config.virtual_users;

        let handle = tokio::spawn(async move {
            // Stagger VU startup for ramp-up / stress / spike shapes
            if ramp_up > 0 && max_vu > 1 {
                let stagger_ms = ((ramp_up * 1000) / (max_vu as u64)) * (vu_idx as u64);
                let deadline = started_instant + Duration::from_millis(stagger_ms);
                while Instant::now() < deadline {
                    if cancel.load(Ordering::Relaxed) || started_instant.elapsed() >= total_duration {
                        return;
                    }
                    tokio::time::sleep(Duration::from_millis(50)).await;
                }
            }

            let mut target_cursor = vu_idx as usize;
            while !cancel.load(Ordering::Relaxed) && started_instant.elapsed() < total_duration {
                // In spike mode, pause non-burst VUs outside middle burst window
                if mode == "spike" && vu_idx >= (max_vu / 3).max(1) {
                    let frac = started_instant.elapsed().as_secs_f64() / total_duration.as_secs_f64().max(1.0);
                    if !(0.25..=0.75).contains(&frac) {
                        tokio::time::sleep(Duration::from_millis(80)).await;
                        continue;
                    }
                }

                let Ok(_permit) = sem.acquire().await else {
                    break;
                };

                let target = &targets[target_cursor % targets.len()];
                target_cursor = target_cursor.wrapping_add(1);

                let method = Method::from_bytes(target.method.as_bytes()).unwrap_or(Method::GET);
                let mut req_builder = client.request(method, &target.url);
                for (k, v) in &target.headers {
                    req_builder = req_builder.header(k, v);
                }
                if let Some(body) = &target.body {
                    if !body.is_empty() {
                        req_builder = req_builder.body(body.clone());
                    }
                }

                let req_start = Instant::now();
                let resp = req_builder.send().await;
                let elapsed_ms = req_start.elapsed().as_secs_f64() * 1000.0;
                total_req.fetch_add(1, Ordering::Relaxed);

                match resp {
                    Ok(r) => {
                        let code = r.status().as_u16();
                        let ok = r.status().is_success();
                        let len = r.bytes().await.map(|b| b.len()).unwrap_or(0);
                        bytes_cnt.fetch_add(len, Ordering::Relaxed);
                        if ok {
                            succ_req.fetch_add(1, Ordering::Relaxed);
                        } else {
                            fail_req.fetch_add(1, Ordering::Relaxed);
                        }
                        if let Ok(mut map) = statuses.lock() {
                            *map.entry(code.to_string()).or_insert(0) += 1;
                        }
                    }
                    Err(err) => {
                        fail_req.fetch_add(1, Ordering::Relaxed);
                        if err.is_timeout() {
                            to_cnt.fetch_add(1, Ordering::Relaxed);
                        }
                        if let Ok(mut map) = statuses.lock() {
                            *map.entry("ERR".to_string()).or_insert(0) += 1;
                        }
                    }
                }

                if let Ok(mut guard) = lats.lock() {
                    if guard.len() < MAX_STORED_LATENCY_SAMPLES {
                        guard.push(elapsed_ms);
                    } else {
                        trunc.store(true, Ordering::Relaxed);
                    }
                }

                let sleep_ms = delay_ms.max(min_interval_ms as u64);
                tokio::time::sleep(Duration::from_millis(sleep_ms)).await;
            }
        });
        handles.push(handle);
    }

    // Sampler loop (1s interval) while VUs execute
    let sampler_cancel = Arc::clone(&cancel_flag);
    let sampler_total = Arc::clone(&total_requests);
    let sampler_fail = Arc::clone(&failed_requests);
    let sampler_bytes = Arc::clone(&total_bytes);
    let sampler_lats = Arc::clone(&latencies);
    let sampler_statuses = Arc::clone(&status_dist);
    let sampler_out = Arc::clone(&samples);
    let run_id_clone = config.run_id.clone();
    let max_vu_sampler = config.virtual_users;

    let sampler = tokio::spawn(async move {
        let mut prev_req = 0usize;
        let mut prev_bytes = 0usize;
        while !sampler_cancel.load(Ordering::Relaxed) && started_instant.elapsed() < total_duration {
            tokio::time::sleep(Duration::from_secs(1)).await;
            let cur_req = sampler_total.load(Ordering::Relaxed);
            let cur_fail = sampler_fail.load(Ordering::Relaxed);
            let cur_bytes = sampler_bytes.load(Ordering::Relaxed);
            let delta_req = cur_req.saturating_sub(prev_req);
            let delta_bytes = cur_bytes.saturating_sub(prev_bytes);
            prev_req = cur_req;
            prev_bytes = cur_bytes;

            let avg_ms = sampler_lats
                .lock()
                .map(|v| {
                    if v.is_empty() {
                        0.0
                    } else {
                        v.iter().sum::<f64>() / v.len() as f64
                    }
                })
                .unwrap_or(0.0);

            let err_pct = if cur_req > 0 {
                (cur_fail as f64 / cur_req as f64) * 100.0
            } else {
                0.0
            };

            let dist = sampler_statuses.lock().map(|m| m.clone()).unwrap_or_default();
            if let Ok(mut out) = sampler_out.lock() {
                out.push(NativePerformanceMetricSample {
                    id: uuid::Uuid::new_v4().to_string(),
                    run_id: run_id_clone.clone(),
                    timestamp: chrono::Utc::now().timestamp_millis(),
                    elapsed_seconds: started_instant.elapsed().as_secs_f64(),
                    active_virtual_users: max_vu_sampler,
                    current_rps: delta_req as f64,
                    avg_response_time_ms: avg_ms,
                    error_rate_percent: err_pct,
                    throughput_bytes_per_sec: delta_bytes as f64,
                    status_codes: dist,
                });
            }
        }
    });

    for h in handles {
        let _ = h.await;
    }
    let was_cancelled = cancel_flag.load(Ordering::SeqCst);
    cancel_flag.store(true, Ordering::SeqCst);
    let _ = sampler.await;
    registry.remove(&config.run_id);

    let completed_at = chrono::Utc::now().timestamp_millis();
    let duration_ms = started_instant.elapsed().as_millis() as u64;
    let total_req = total_requests.load(Ordering::Relaxed);
    let succ_req = successful_requests.load(Ordering::Relaxed);
    let fail_req = failed_requests.load(Ordering::Relaxed);
    let to_cnt = timeout_count.load(Ordering::Relaxed);
    let bytes_cnt = total_bytes.load(Ordering::Relaxed);

    let mut lat_vec = latencies.lock().map(|v| v.clone()).unwrap_or_default();
    lat_vec.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let avg_ms = if lat_vec.is_empty() {
        0.0
    } else {
        lat_vec.iter().sum::<f64>() / lat_vec.len() as f64
    };
    let min_ms = lat_vec.first().copied().unwrap_or(0.0);
    let max_ms = lat_vec.last().copied().unwrap_or(0.0);
    let median_ms = compute_percentile(&lat_vec, 50.0);
    let p90_ms = compute_percentile(&lat_vec, 90.0);
    let p95_ms = compute_percentile(&lat_vec, 95.0);
    let p99_ms = compute_percentile(&lat_vec, 99.0);

    let elapsed_secs = (duration_ms as f64 / 1000.0).max(0.001);
    let is_approx = truncated_latencies.load(Ordering::Relaxed);

    let summary = NativePerformanceMetricsSummary {
        total_requests: total_req,
        successful_requests: succ_req,
        failed_requests: fail_req,
        timeout_count: to_cnt,
        requests_per_second: (total_req as f64) / elapsed_secs,
        avg_response_time_ms: avg_ms,
        min_response_time_ms: min_ms,
        max_response_time_ms: max_ms,
        median_response_time_ms: median_ms,
        p90_response_time_ms: p90_ms,
        p95_response_time_ms: p95_ms,
        p99_response_time_ms: p99_ms,
        error_rate_percent: if total_req > 0 {
            (fail_req as f64 / total_req as f64) * 100.0
        } else {
            0.0
        },
        total_bytes_received: bytes_cnt,
        throughput_bytes_per_sec: (bytes_cnt as f64) / elapsed_secs,
        status_code_distribution: status_dist.lock().map(|m| m.clone()).unwrap_or_default(),
        sample_count: lat_vec.len(),
        percentiles_approximate: is_approx,
        percentile_note: if is_approx {
            Some(format!(
                "Percentiles computed on first {} capped latency samples",
                MAX_STORED_LATENCY_SAMPLES
            ))
        } else {
            None
        },
    };

    let sample_list = samples.lock().map(|s| s.clone()).unwrap_or_default();

    Ok(NativePerformanceRunResult {
        run_id: config.run_id,
        status: if was_cancelled { "stopped" } else { "completed" }.to_string(),
        started_at,
        completed_at,
        duration_ms,
        summary,
        samples: sample_list,
        error_message: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::NativePerformanceTargetRequest;

    #[test]
    fn computes_linear_interpolated_percentiles_accurately() {
        let data = vec![10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0];
        assert!((compute_percentile(&data, 50.0) - 55.0).abs() < 0.01);
        assert!((compute_percentile(&data, 90.0) - 91.0).abs() < 0.01);
        assert!((compute_percentile(&data, 99.0) - 99.1).abs() < 0.01);
    }

    #[test]
    fn rejects_excessive_virtual_users_safety_cap() {
        let cfg = NativePerformanceRunConfig {
            run_id: "r1".into(),
            mode: "load".into(),
            virtual_users: 500,
            duration_seconds: 10,
            ramp_up_seconds: 0,
            ramp_down_seconds: 0,
            request_delay_ms: 0,
            max_requests_per_second: 100,
            timeout_ms: 5000,
            verify_ssl: Some(true),
            targets: vec![NativePerformanceTargetRequest {
                id: "t1".into(),
                name: "Test".into(),
                method: "GET".into(),
                url: "https://example.com".into(),
                headers: HashMap::new(),
                body: None,
            }],
        };
        let err = validate_run_config(&cfg).unwrap_err();
        assert_eq!(err.code, "SAFETY_LIMIT_EXCEEDED");
    }
}
