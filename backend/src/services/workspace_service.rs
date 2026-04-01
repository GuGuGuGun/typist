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