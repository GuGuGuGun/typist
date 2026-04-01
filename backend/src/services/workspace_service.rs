use std::fs;
use std::path::Path;

use regex::Regex;
use walkdir::WalkDir;

use crate::errors::{BackendError, BackendResult};
use crate::models::{
    GlobalSearchMatch, GlobalSearchRequest, GlobalSearchResponse, OpenWorkspaceResponse,
    WorkspaceNode,
};

pub fn open_workspace(root_path: &str) -> BackendResult<OpenWorkspaceResponse> {
    if root_path.trim().is_empty() {
        return Err(BackendError::Workspace(
            "workspace path must not be empty".to_string(),
        ));
    }

    let root = Path::new(root_path);
    if !root.exists() || !root.is_dir() {
        return Err(BackendError::Workspace(format!(
            "workspace path is invalid: {root_path}"
        )));
    }

    let tree = build_tree(root, 0, 8)?;
    Ok(OpenWorkspaceResponse {
        root_path: root_path.to_string(),
        tree,
    })
}

pub fn global_search(request: &GlobalSearchRequest) -> BackendResult<GlobalSearchResponse> {
    if request.query.trim().is_empty() {
        return Err(BackendError::InvalidInput("query must not be empty".to_string()));
    }

    let root = Path::new(&request.workspace_path);
    if !root.exists() || !root.is_dir() {
        return Err(BackendError::Workspace(format!(
            "workspace path is invalid: {}",
            request.workspace_path
        )));
    }

    let regex = build_regex(
        request.query.as_str(),
        request.is_regex,
        request.case_sensitive,
    )?;

    let extensions = request
        .include_extensions
        .clone()
        .unwrap_or_else(|| vec!["md".to_string(), "markdown".to_string()]);
    let max_results = request.max_results.unwrap_or(200);

    let mut scanned_files = 0;
    let mut matches = Vec::new();

    for entry in WalkDir::new(root).into_iter().flatten() {
        if !entry.file_type().is_file() {
            continue;
        }

        let Some(ext) = entry.path().extension().and_then(|value| value.to_str()) else {
            continue;
        };

        if !extensions.iter().any(|allowed| allowed.eq_ignore_ascii_case(ext)) {
            continue;
        }

        scanned_files += 1;
        let path = entry.path();
        let content = fs::read_to_string(path).unwrap_or_default();

        for item in regex.find_iter(&content) {
            let (line, column, line_text) = offset_to_line_column_with_text(&content, item.start());
            matches.push(GlobalSearchMatch {
                path: path.to_string_lossy().to_string(),
                line,
                column,
                matched_text: item.as_str().to_string(),
                line_text,
            });

            if matches.len() >= max_results {
                return Ok(GlobalSearchResponse {
                    scanned_files,
                    matches,
                });
            }
        }
    }

    Ok(GlobalSearchResponse {
        scanned_files,
        matches,
    })
}

pub fn create_workspace_file(parent_path: &str, name: &str) -> BackendResult<String> {
    let target = resolve_workspace_target(parent_path, name)?;
    fs::write(&target, "")?;
    Ok(target.to_string_lossy().to_string())
}

pub fn create_workspace_folder(parent_path: &str, name: &str) -> BackendResult<String> {
    let target = resolve_workspace_target(parent_path, name)?;
    fs::create_dir(&target)?;
    Ok(target.to_string_lossy().to_string())
}

pub fn rename_workspace_entry(target_path: &str, new_name: &str) -> BackendResult<String> {
    let target = resolve_existing_path(target_path)?;
    let parent = target
        .parent()
        .ok_or_else(|| BackendError::InvalidInput("target path has no parent".to_string()))?;
    let candidate = validate_entry_name(new_name)?;
    let destination = parent.join(candidate);

    if destination == target {
        return Ok(target.to_string_lossy().to_string());
    }

    if destination.exists() {
        return Err(BackendError::InvalidInput(format!(
            "target already exists: {}",
            destination.to_string_lossy()
        )));
    }

    fs::rename(&target, &destination)?;
    Ok(destination.to_string_lossy().to_string())
}

pub fn delete_workspace_entry(target_path: &str) -> BackendResult<()> {
    let target = resolve_existing_path(target_path)?;
    if target.is_dir() {
        fs::remove_dir_all(target)?;
    } else {
        fs::remove_file(target)?;
    }
    Ok(())
}

pub fn move_workspace_entry(source_path: &str, destination_parent_path: &str) -> BackendResult<String> {
    let source = resolve_existing_path(source_path)?;
    let destination_parent = resolve_existing_dir(destination_parent_path)?;

    let target = resolve_transfer_target(&source, &destination_parent)?;
    fs::rename(&source, &target)?;
    Ok(target.to_string_lossy().to_string())
}

pub fn copy_workspace_entry(source_path: &str, destination_parent_path: &str) -> BackendResult<String> {
    let source = resolve_existing_path(source_path)?;
    let destination_parent = resolve_existing_dir(destination_parent_path)?;

    let target = resolve_transfer_target(&source, &destination_parent)?;
    if source.is_dir() {
        copy_dir_recursive(&source, &target)?;
    } else {
        fs::copy(&source, &target)?;
    }

    Ok(target.to_string_lossy().to_string())
}

fn resolve_workspace_target(parent_path: &str, name: &str) -> BackendResult<std::path::PathBuf> {
    if parent_path.trim().is_empty() {
        return Err(BackendError::InvalidInput(
            "parent path must not be empty".to_string(),
        ));
    }

    let trimmed_name = validate_entry_name(name)?;

    let parent = Path::new(parent_path);
    if !parent.exists() || !parent.is_dir() {
        return Err(BackendError::Workspace(format!(
            "workspace path is invalid: {parent_path}"
        )));
    }

    let target = parent.join(trimmed_name);
    if target.exists() {
        return Err(BackendError::InvalidInput(format!(
            "target already exists: {}",
            target.to_string_lossy()
        )));
    }

    Ok(target)
}

fn resolve_existing_path(target_path: &str) -> BackendResult<std::path::PathBuf> {
    if target_path.trim().is_empty() {
        return Err(BackendError::InvalidInput(
            "target path must not be empty".to_string(),
        ));
    }

    let target = Path::new(target_path);
    if !target.exists() {
        return Err(BackendError::Workspace(format!(
            "target path does not exist: {target_path}"
        )));
    }

    Ok(target.to_path_buf())
}

fn resolve_existing_dir(dir_path: &str) -> BackendResult<std::path::PathBuf> {
    let dir = resolve_existing_path(dir_path)?;
    if !dir.is_dir() {
        return Err(BackendError::InvalidInput(format!(
            "destination must be a directory: {dir_path}"
        )));
    }

    Ok(dir)
}

fn resolve_transfer_target(
    source: &std::path::Path,
    destination_parent: &std::path::Path,
) -> BackendResult<std::path::PathBuf> {
    let source_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| BackendError::InvalidInput("source path has no file name".to_string()))?;
    let target = destination_parent.join(source_name);

    if target == source {
        return Err(BackendError::InvalidInput(
            "source and destination are the same".to_string(),
        ));
    }

    if source.is_dir() {
        let source_canonical = source.canonicalize()?;
        let destination_canonical = destination_parent.canonicalize()?;
        if destination_canonical.starts_with(&source_canonical) {
            return Err(BackendError::InvalidInput(
                "cannot move or copy directory into itself".to_string(),
            ));
        }
    }

    if target.exists() {
        return Err(BackendError::InvalidInput(format!(
            "target already exists: {}",
            target.to_string_lossy()
        )));
    }

    Ok(target)
}

fn copy_dir_recursive(source: &std::path::Path, target: &std::path::Path) -> BackendResult<()> {
    fs::create_dir(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path.is_dir() {
            copy_dir_recursive(&source_path, &target_path)?;
        } else {
            fs::copy(source_path, target_path)?;
        }
    }
    Ok(())
}

fn validate_entry_name(name: &str) -> BackendResult<&str> {
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err(BackendError::InvalidInput(
            "name must not be empty".to_string(),
        ));
    }

    if trimmed_name.contains('/') || trimmed_name.contains('\\') {
        return Err(BackendError::InvalidInput(
            "name must not contain path separators".to_string(),
        ));
    }

    Ok(trimmed_name)
}

fn build_tree(path: &Path, depth: usize, max_depth: usize) -> BackendResult<WorkspaceNode> {
    let metadata = fs::metadata(path)?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    let mut node = WorkspaceNode {
        path: path.to_string_lossy().to_string(),
        name,
        is_dir: metadata.is_dir(),
        size_bytes: if metadata.is_dir() {
            None
        } else {
            Some(metadata.len())
        },
        children: Vec::new(),
    };

    if metadata.is_dir() && depth < max_depth {
        let mut children = Vec::new();
        for child in fs::read_dir(path)? {
            let child = child?;
            let child_node = build_tree(&child.path(), depth + 1, max_depth)?;
            children.push(child_node);
        }

        children.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
        node.children = children;
    }

    Ok(node)
}

fn build_regex(query: &str, is_regex: bool, case_sensitive: bool) -> BackendResult<Regex> {
    let raw_pattern = if is_regex {
        query.to_string()
    } else {
        regex::escape(query)
    };
    let pattern = if case_sensitive {
        raw_pattern
    } else {
        format!("(?i){raw_pattern}")
    };
    Regex::new(&pattern).map_err(|err| BackendError::SearchPattern(err.to_string()))
}

fn offset_to_line_column_with_text(content: &str, offset: usize) -> (usize, usize, String) {
    let mut line: usize = 1;
    let mut column: usize = 1;

    for (index, ch) in content.char_indices() {
        if index >= offset {
            break;
        }

        if ch == '\n' {
            line += 1;
            column = 1;
        } else {
            column += 1;
        }
    }

    let line_text = content
        .lines()
        .nth(line.saturating_sub(1))
        .unwrap_or_default()
        .to_string();

    (line, column, line_text)
}