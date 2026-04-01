use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::time::UNIX_EPOCH;

use crate::errors::{BackendError, BackendResult};
use crate::models::{ExternalChangeStatus, FileSnapshot};

#[derive(Debug, Clone)]
pub struct OpenedFile {
    pub content: String,
    pub title: String,
    pub snapshot: FileSnapshot,
}

pub fn open_markdown_file(path: &str) -> BackendResult<OpenedFile> {
    if path.trim().is_empty() {
        return Err(BackendError::InvalidInput("path must not be empty".to_string()));
    }

    let content = fs::read_to_string(path)?;
    let title = Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("untitled.md")
        .to_string();
    let snapshot = build_snapshot(path, &content)?;

    Ok(OpenedFile {
        content,
        title,
        snapshot,
    })
}

pub fn save_markdown_file(path: &str, content: &str) -> BackendResult<FileSnapshot> {
    if path.trim().is_empty() {
        return Err(BackendError::InvalidInput("path must not be empty".to_string()));
    }

    fs::write(path, content)?;
    build_snapshot(path, content)
}

pub fn check_external_change(path: &str, previous: &FileSnapshot) -> BackendResult<ExternalChangeStatus> {
    if !Path::new(path).exists() {
        return Ok(ExternalChangeStatus {
            changed: true,
            latest_snapshot: None,
        });
    }

    let content = fs::read_to_string(path)?;
    let latest = build_snapshot(path, &content)?;

    let changed = latest.modified_epoch_ms != previous.modified_epoch_ms
        || latest.size_bytes != previous.size_bytes
        || latest.content_hash != previous.content_hash;

    Ok(ExternalChangeStatus {
        changed,
        latest_snapshot: Some(latest),
    })
}

fn build_snapshot(path: &str, content: &str) -> BackendResult<FileSnapshot> {
    let metadata = fs::metadata(path)?;
    let modified_epoch_ms = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0);

    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);

    Ok(FileSnapshot {
        modified_epoch_ms,
        size_bytes: metadata.len(),
        content_hash: hasher.finish(),
    })
}
