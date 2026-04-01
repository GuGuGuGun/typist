use std::fs;
use std::path::Path;

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
        ExportFormat::Pdf => export_pdf(request),
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

fn export_pdf(request: &ExportRequest) -> BackendResult<ExportResult> {
    let plain_text = markdown_to_plain_text(&request.markdown);
    let pdf_bytes = build_simple_pdf(plain_text.as_str())?;
    fs::write(&request.target_path, &pdf_bytes)?;

    Ok(ExportResult {
        target_path: request.target_path.clone(),
        bytes_written: pdf_bytes.len() as u64,
    })
}

fn markdown_to_plain_text(markdown: &str) -> String {
    markdown
        .lines()
        .map(|line| line.trim_start_matches('#').trim().to_string())
        .collect::<Vec<String>>()
        .join("\n")
}

fn build_simple_pdf(content: &str) -> BackendResult<Vec<u8>> {
    let mut lines = content
        .lines()
        .map(|line| line.replace('(', "\\(").replace(')', "\\)").replace('\\', "\\\\"))
        .collect::<Vec<String>>();
    if lines.is_empty() {
        lines.push(" ".to_string());
    }
    lines.truncate(80);

    let mut text_stream = String::from("BT\n/F1 11 Tf\n50 790 Td\n");
    for (index, line) in lines.iter().enumerate() {
        if index == 0 {
            text_stream.push_str(format!("({line}) Tj\n").as_str());
        } else {
            text_stream.push_str(format!("0 -14 Td ({line}) Tj\n").as_str());
        }
    }
    text_stream.push_str("ET\n");

    let object1 = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n".to_string();
    let object2 = "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n".to_string();
    let object3 = "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n".to_string();
    let object4 = format!(
        "4 0 obj << /Length {} >> stream\n{}endstream endobj\n",
        text_stream.len(),
        text_stream
    );
    let object5 = "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n".to_string();

    let mut pdf = Vec::<u8>::new();
    pdf.extend_from_slice(b"%PDF-1.4\n");

    let mut offsets = vec![0usize];
    for object in [&object1, &object2, &object3, &object4, &object5] {
        offsets.push(pdf.len());
        pdf.extend_from_slice(object.as_bytes());
    }

    let xref_offset = pdf.len();
    let mut xref = String::from("xref\n0 6\n0000000000 65535 f \n");
    for offset in offsets.iter().skip(1) {
        xref.push_str(format!("{offset:010} 00000 n \n").as_str());
    }
    pdf.extend_from_slice(xref.as_bytes());

    let trailer = format!(
        "trailer << /Size 6 /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"
    );
    pdf.extend_from_slice(trailer.as_bytes());

    if pdf.is_empty() {
        return Err(BackendError::Export("failed to build pdf".to_string()));
    }

    Ok(pdf)
}