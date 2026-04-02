use std::fs;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

use pulldown_cmark::{html, Options, Parser};

use crate::errors::{BackendError, BackendResult};
use crate::models::{ExportFormat, ExportRequest, ExportResult};

pub fn export_document(request: &ExportRequest) -> BackendResult<ExportResult> {
    if request.target_path.trim().is_empty() {
        return Err(BackendError::Export(
            "target path must not be empty".to_string(),
        ));
    }

    if let Some(parent) = Path::new(&request.target_path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }

    match request.format {
        ExportFormat::Html => export_html(request),
        ExportFormat::Pdf => export_with_pandoc(request, "pdf"),
        ExportFormat::Docx => export_with_pandoc(request, "docx"),
        ExportFormat::Latex => export_with_pandoc(request, "latex"),
        ExportFormat::Epub => export_with_pandoc(request, "epub"),
        ExportFormat::RevealJs => export_with_pandoc(request, "revealjs"),
    }
}

fn export_html(request: &ExportRequest) -> BackendResult<ExportResult> {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_FOOTNOTES);

    let parser = Parser::new_ext(&request.markdown, options);
    let mut html_body = String::new();
    html::push_html(&mut html_body, parser);

    let title = request.title.as_deref().unwrap_or("Typist Export");
    let html_content = format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>{title}</title></head><body>{html_body}</body></html>"
    );
    fs::write(&request.target_path, html_content.as_bytes())?;

    Ok(ExportResult {
        target_path: request.target_path.clone(),
        bytes_written: html_content.len() as u64,
    })
}

fn export_with_pandoc(request: &ExportRequest, writer: &str) -> BackendResult<ExportResult> {
    let prepared_markdown = preprocess_for_pandoc(&request.markdown);

    let mut command = Command::new("pandoc");
    command
        .arg("--from")
        .arg("gfm")
        .arg("--to")
        .arg(writer)
        .arg("--output")
        .arg(&request.target_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    if let Some(title) = request.title.as_deref() {
        if !title.trim().is_empty() {
            command.arg("--metadata").arg(format!("title={title}"));
        }
    }

    let mut child = command.spawn().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            BackendError::Export(
                "pandoc executable was not found. Please install Pandoc and ensure it is available in PATH"
                    .to_string(),
            )
        } else {
            BackendError::Export(format!("failed to start pandoc process: {error}"))
        }
    })?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prepared_markdown.as_bytes())
            .map_err(|error| BackendError::Export(format!("failed to stream markdown to pandoc: {error}")))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| BackendError::Export(format!("failed to wait for pandoc process: {error}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(BackendError::Export(if stderr.is_empty() {
            format!("pandoc export failed with status {}", output.status)
        } else {
            format!("pandoc export failed: {stderr}")
        }));
    }

    let bytes_written = fs::metadata(&request.target_path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);

    Ok(ExportResult {
        target_path: request.target_path.clone(),
        bytes_written,
    })
}

fn preprocess_for_pandoc(markdown: &str) -> String {
    // Normalize a few Typist-specific or user-friendly syntaxes before handing to Pandoc.
    markdown
        .replace("\r\n", "\n")
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            !(trimmed.starts_with("<!-- typist:") && trimmed.ends_with("-->"))
        })
        .collect::<Vec<&str>>()
        .join("\n")
}