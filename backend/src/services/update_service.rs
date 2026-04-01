use semver::Version;
use serde::Deserialize;

use crate::errors::{BackendError, BackendResult};
use crate::models::{UpdateCheckRequest, UpdateInfo};

#[derive(Debug, Deserialize)]
struct UpdateFeed {
    latest_version: String,
    download_url: Option<String>,
    notes: Option<String>,
}

pub fn check_update(request: &UpdateCheckRequest) -> BackendResult<UpdateInfo> {
    if request.feed_url.trim().is_empty() {
        return Err(BackendError::Update("feed_url must not be empty".to_string()));
    }

    let response = ureq::get(&request.feed_url)
        .call()
        .map_err(|err| BackendError::Update(err.to_string()))?;

    let feed: UpdateFeed = response
        .into_json()
        .map_err(|err| BackendError::Update(err.to_string()))?;

    let update_available = compare_versions(request.current_version.as_str(), feed.latest_version.as_str())?;

    Ok(UpdateInfo {
        current_version: request.current_version.clone(),
        latest_version: feed.latest_version,
        update_available,
        download_url: feed.download_url,
        notes: feed.notes,
    })
}

fn compare_versions(current: &str, latest: &str) -> BackendResult<bool> {
    let current_version = Version::parse(current)
        .map_err(|err| BackendError::Update(format!("invalid current version: {err}")))?;
    let latest_version = Version::parse(latest)
        .map_err(|err| BackendError::Update(format!("invalid latest version: {err}")))?;
    Ok(latest_version > current_version)
}