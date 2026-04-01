use std::fs;
use std::path::Path;

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::errors::{BackendError, BackendResult};
use crate::models::{RecoveryDraftContent, RecoveryDraftMeta, SaveRecoveryDraftRequest};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DraftFile {
    metadata: RecoveryDraftMeta,
    content: String,
}

pub fn save_recovery_draft(
    recovery_dir: &str,
    request: &SaveRecoveryDraftRequest,
) -> BackendResult<RecoveryDraftMeta> {
    if request.tab_id.trim().is_empty() {
        return Err(BackendError::Recovery("tab_id must not be empty".to_string()));
    }

    fs::create_dir_all(recovery_dir)?;
    let draft_id = sanitize_draft_id(request.tab_id.as_str());
    let metadata = RecoveryDraftMeta {
        draft_id: draft_id.clone(),
        source_path: request.source_path.clone(),
        updated_epoch_ms: Utc::now().timestamp_millis(),
    };
    let draft = DraftFile {
        metadata: metadata.clone(),
        content: request.content.clone(),
    };

    let path = draft_path(recovery_dir, draft_id.as_str());
    let payload = serde_json::to_string_pretty(&draft)
        .map_err(|err| BackendError::Recovery(err.to_string()))?;
    fs::write(path, payload)?;

    Ok(metadata)
}

pub fn list_recovery_drafts(recovery_dir: &str) -> BackendResult<Vec<RecoveryDraftMeta>> {
    let root = Path::new(recovery_dir);
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut drafts = Vec::new();
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }

        let content = fs::read_to_string(entry.path())?;
        let parsed = serde_json::from_str::<DraftFile>(&content)
            .map_err(|err| BackendError::Recovery(err.to_string()))?;
        drafts.push(parsed.metadata);
    }

    drafts.sort_by(|left, right| right.updated_epoch_ms.cmp(&left.updated_epoch_ms));
    Ok(drafts)
}

pub fn restore_recovery_draft(
    recovery_dir: &str,
    draft_id: &str,
) -> BackendResult<RecoveryDraftContent> {
    let path = draft_path(recovery_dir, draft_id);
    if !Path::new(&path).exists() {
        return Err(BackendError::Recovery(format!(
            "draft not found: {draft_id}"
        )));
    }

    let content = fs::read_to_string(path)?;
    let parsed = serde_json::from_str::<DraftFile>(&content)
        .map_err(|err| BackendError::Recovery(err.to_string()))?;
    Ok(RecoveryDraftContent {
        metadata: parsed.metadata,
        content: parsed.content,
    })
}

pub fn delete_recovery_draft(recovery_dir: &str, draft_id: &str) -> BackendResult<()> {
    let path = draft_path(recovery_dir, draft_id);
    if Path::new(&path).exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

pub fn default_recovery_dir() -> String {
    std::env::temp_dir()
        .join("typist-recovery")
        .to_string_lossy()
        .to_string()
}

fn draft_path(recovery_dir: &str, draft_id: &str) -> String {
    Path::new(recovery_dir)
        .join(format!("{draft_id}.json"))
        .to_string_lossy()
        .to_string()
}

fn sanitize_draft_id(tab_id: &str) -> String {
    tab_id
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>()
}