use api_studio_lib::cli::runner::{
    format_junit_xml, run_collection_from_sqlite, run_security_audit_cli,
    run_smoke_performance_cli, validate_openapi_file, EXIT_CONFIG_ERROR,
};
use clap::{Parser, Subcommand, ValueEnum};

#[derive(Copy, Clone, PartialEq, Eq, PartialOrd, Ord, ValueEnum)]
enum OutputFormat {
    Terminal,
    Json,
    JunitXml,
}

#[derive(Parser)]
#[command(
    name = "api-studio",
    version = "2.0.0",
    about = "API Studio Headless CLI Runner for CI/CD, Testing, Security Audits & OpenAPI Validation"
)]
struct Cli {
    #[arg(long, value_enum, default_value_t = OutputFormat::Terminal)]
    format: OutputFormat,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Execute requests, test suites, contract checks, security audits, or performance tests
    Run {
        #[command(subcommand)]
        target: RunTarget,
    },
    /// Validate an OpenAPI YAML or JSON file structurally
    Validate {
        #[arg(long)]
        spec: String,
    },
    /// Generate a formatted summary report from a SQLite project database
    Report {
        #[arg(long)]
        db: String,
    },
}

#[derive(Subcommand)]
enum RunTarget {
    /// Execute a collection stored in the API Studio SQLite database
    Collection {
        #[arg(long)]
        db: String,
        #[arg(long)]
        collection: Option<String>,
        #[arg(long, default_value_t = 30)]
        timeout: u64,
    },
    /// Execute security header & TLS inspection against an HTTPS endpoint
    SecurityAudit {
        #[arg(long)]
        url: String,
    },
    /// Execute a bounded smoke/load test against a target URL
    PerformanceTest {
        #[arg(long)]
        url: String,
        #[arg(long, default_value_t = 5)]
        vus: u32,
        #[arg(long, default_value_t = 10)]
        duration: u64,
    },
}

fn emit_summary(
    suite_name: &str,
    format: OutputFormat,
    summary: &api_studio_lib::models::NativeCliExecutionSummary,
) {
    match format {
        OutputFormat::Json => {
            println!(
                "{}",
                serde_json::to_string_pretty(summary).unwrap_or_else(|_| "{}".into())
            );
        }
        OutputFormat::JunitXml => {
            print!("{}", format_junit_xml(suite_name, summary));
        }
        OutputFormat::Terminal => {
            println!(
                "[{}] status={} total={} passed={} failed={} duration={}ms exit={}",
                suite_name,
                summary.status,
                summary.total,
                summary.passed,
                summary.failed,
                summary.duration_ms,
                summary.exit_code
            );
            for d in &summary.details {
                println!("  - {}", d);
            }
        }
    }
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    let (suite_name, summary) = match cli.command {
        Commands::Run { target } => match target {
            RunTarget::Collection {
                db,
                collection,
                timeout,
            } => (
                collection.clone().unwrap_or_else(|| "collection".into()),
                run_collection_from_sqlite(&db, collection.as_deref(), timeout).await,
            ),
            RunTarget::SecurityAudit { url } => (
                "security-audit".to_string(),
                run_security_audit_cli(&url).await,
            ),
            RunTarget::PerformanceTest { url, vus, duration } => (
                "performance-test".to_string(),
                run_smoke_performance_cli(&url, vus, duration).await,
            ),
        },
        Commands::Validate { spec } => ("openapi-validation".to_string(), validate_openapi_file(&spec)),
        Commands::Report { db } => {
            let safe = api_studio_lib::cli::runner::load_sqlite_project(&db);
            match safe {
                Ok(conn) => {
                    let status = api_studio_lib::database::repositories::get_database_status(
                        &conn,
                        std::path::Path::new(&db),
                    );
                    match status {
                        Ok(st) => (
                            "project-report".to_string(),
                            api_studio_lib::models::NativeCliExecutionSummary {
                                exit_code: 0,
                                status: "ok".into(),
                                total: st.table_counts.len(),
                                passed: st.table_counts.len(),
                                failed: 0,
                                duration_ms: 0,
                                details: st
                                    .table_counts
                                    .into_iter()
                                    .map(|(k, v)| format!("{}: {}", k, v))
                                    .collect(),
                            },
                        ),
                        Err(e) => (
                            "project-report".to_string(),
                            api_studio_lib::models::NativeCliExecutionSummary {
                                exit_code: EXIT_CONFIG_ERROR,
                                status: "error".into(),
                                total: 0,
                                passed: 0,
                                failed: 1,
                                duration_ms: 0,
                                details: vec![e.message],
                            },
                        ),
                    }
                }
                Err(code) => (
                    "project-report".to_string(),
                    api_studio_lib::models::NativeCliExecutionSummary {
                        exit_code: code,
                        status: "config-error".into(),
                        total: 0,
                        passed: 0,
                        failed: 1,
                        duration_ms: 0,
                        details: vec!["Failed to open project database".into()],
                    },
                ),
            }
        }
    };

    emit_summary(&suite_name, cli.format, &summary);
    std::process::exit(summary.exit_code);
}
