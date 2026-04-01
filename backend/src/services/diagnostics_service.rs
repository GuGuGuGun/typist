use std::fs;
use std::io::Write;
use std::path::Path;

use chrono::Utc;

use crate::errors::BackendResult;
use crate::models::{DiagnosticsReport, LogWriteRequest};

pub fn write_log(log_file_path: &str, request: &LogWriteRequest) -> BackendResult<()> {
    if let Some(parent) = Path::new(log_file_path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }

    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_file_path)?;
    let line = format!(
        "{} [{}] {}\n",
        Utc::now().to_rfc3339(),
        request.level.to_uppercase(),
        request.message
    );
    file.write_all(line.as_bytes())?;
    Ok(())
}

pub fn read_recent_logs(log_file_path: &str, max_lines: usize) -> BackendResult<Vec<String>> {
    if !Path::new(log_file_path).exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(log_file_path)?;
    let mut lines = content
        .lines()
        .map(|line| line.to_string())
        .collect::<Vec<String>>();

    if lines.len() > max_lines {
        lines = lines.split_off(lines.len() - max_lines);
    }

    Ok(lines)
}

pub fn build_report(
    log_file_path: &str,
    open_tab_count: usize,
    plugin_count: usize,
    workspace_path: Option<String>,
) -> BackendResult<DiagnosticsReport> {
    let recent_log_lines = read_recent_logs(log_file_path, 200)?;
    Ok(DiagnosticsReport {
        log_file_path: log_file_path.to_string(),
        recent_log_lines,
        open_tab_count,
        plugin_count,
        workspace_path,
    })
}