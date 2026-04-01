use regex::Regex;

use crate::errors::{BackendError, BackendResult};
use crate::models::{ReplaceRequest, ReplaceResult, SearchMatch, SearchRequest};

pub fn search_in_document(request: &SearchRequest) -> BackendResult<Vec<SearchMatch>> {
    if request.query.is_empty() {
        return Err(BackendError::InvalidInput("query must not be empty".to_string()));
    }

    let regex = build_regex(request.query.as_str(), request.is_regex, request.case_sensitive)?;
    let mut matches = Vec::new();

    for item in regex.find_iter(&request.content) {
        let (line, column) = offset_to_line_column(&request.content, item.start());
        matches.push(SearchMatch {
            match_start: item.start(),
            match_end: item.end(),
            line,
            column,
            matched_text: item.as_str().to_string(),
        });
    }

    Ok(matches)
}

pub fn replace_in_document(request: &ReplaceRequest) -> BackendResult<ReplaceResult> {
    if request.query.is_empty() {
        return Err(BackendError::InvalidInput("query must not be empty".to_string()));
    }

    let regex = build_regex(request.query.as_str(), request.is_regex, request.case_sensitive)?;
    let replaced_count = regex.find_iter(&request.content).count();

    if replaced_count == 0 {
        return Ok(ReplaceResult {
            content: request.content.clone(),
            replaced_count: 0,
        });
    }

    let content = if request.replace_all {
        regex
            .replace_all(&request.content, request.replacement.as_str())
            .to_string()
    } else {
        regex
            .replacen(&request.content, 1, request.replacement.as_str())
            .to_string()
    };

    Ok(ReplaceResult {
        content,
        replaced_count: if request.replace_all { replaced_count } else { 1 },
    })
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

fn offset_to_line_column(content: &str, offset: usize) -> (usize, usize) {
    let mut line = 1;
    let mut column = 1;

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

    (line, column)
}

#[cfg(test)]
mod tests {
    use super::{replace_in_document, search_in_document};
    use crate::models::{ReplaceRequest, SearchRequest};

    #[test]
    fn should_find_matches_in_plain_text() {
        let request = SearchRequest {
            content: "abc test test".to_string(),
            query: "test".to_string(),
            is_regex: false,
            case_sensitive: true,
        };

        let matches = search_in_document(&request).expect("search should work");
        assert_eq!(matches.len(), 2);
    }

    #[test]
    fn should_replace_first_only() {
        let request = ReplaceRequest {
            content: "A A A".to_string(),
            query: "A".to_string(),
            replacement: "B".to_string(),
            is_regex: false,
            case_sensitive: true,
            replace_all: false,
        };

        let result = replace_in_document(&request).expect("replace should work");
        assert_eq!(result.content, "B A A");
        assert_eq!(result.replaced_count, 1);
    }
}
