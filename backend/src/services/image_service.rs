use std::fs;
use std::path::Path;

use base64::Engine;
use uuid::Uuid;

use crate::errors::{BackendError, BackendResult};
use crate::models::{ImagePasteRequest, ImagePasteResponse};

pub fn save_pasted_image(
    request: &ImagePasteRequest,
    custom_assets_dir: Option<&str>,
) -> BackendResult<ImagePasteResponse> {
    if request.document_path.trim().is_empty() {
        return Err(BackendError::InvalidInput(
            "document_path must not be empty".to_string(),
        ));
    }

    let document = Path::new(&request.document_path);
    let doc_dir = document
        .parent()
        .ok_or_else(|| BackendError::InvalidInput("invalid document path".to_string()))?;

    let assets_dir = if let Some(custom) = custom_assets_dir {
        Path::new(custom).to_path_buf()
    } else {
        doc_dir.join(".assets")
    };

    fs::create_dir_all(&assets_dir)?;

    let bytes = decode_base64(&request.image_base64)?;
    let file_name = request
        .file_name
        .clone()
        .unwrap_or_else(|| format!("img-{}.png", Uuid::new_v4()));
    let target = assets_dir.join(file_name);
    fs::write(&target, &bytes)?;

    let relative_path = if target.starts_with(doc_dir) {
        target
            .strip_prefix(doc_dir)
            .ok()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_else(|| target.to_string_lossy().to_string())
    } else {
        target.to_string_lossy().to_string()
    }
    .replace('\\', "/");

    Ok(ImagePasteResponse {
        absolute_path: target.to_string_lossy().to_string(),
        relative_path,
        size_bytes: bytes.len() as u64,
    })
}

fn decode_base64(raw: &str) -> BackendResult<Vec<u8>> {
    let payload = raw
        .split_once(',')
        .map(|(_, right)| right)
        .unwrap_or(raw);
    base64::engine::general_purpose::STANDARD
        .decode(payload)
        .map_err(|err| BackendError::InvalidInput(format!("invalid base64 image: {err}")))
}