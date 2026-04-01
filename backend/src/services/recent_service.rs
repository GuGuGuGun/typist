use std::time::UNIX_EPOCH;

use crate::models::RecentFileItem;

const DEFAULT_RECENT_LIMIT: usize = 20;

pub fn upsert_recent(
    mut existing: Vec<RecentFileItem>,
    path: String,
    limit: usize,
) -> Vec<RecentFileItem> {
    existing.retain(|item| item.path != path);
    existing.insert(
        0,
        RecentFileItem {
            path,
            last_opened_epoch_ms: now_epoch_ms(),
        },
    );
    let max = if limit == 0 { DEFAULT_RECENT_LIMIT } else { limit };
    existing.truncate(max);
    existing
}

fn now_epoch_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::upsert_recent;
    use crate::models::RecentFileItem;

    #[test]
    fn should_move_existing_file_to_front() {
        let list = vec![
            RecentFileItem {
                path: "a.md".to_string(),
                last_opened_epoch_ms: 1,
            },
            RecentFileItem {
                path: "b.md".to_string(),
                last_opened_epoch_ms: 2,
            },
        ];

        let updated = upsert_recent(list, "a.md".to_string(), 20);
        assert_eq!(updated.first().map(|item| item.path.as_str()), Some("a.md"));
        assert_eq!(updated.len(), 2);
    }

    #[test]
    fn should_apply_limit() {
        let mut list = Vec::new();
        for i in 0..30 {
            list.push(RecentFileItem {
                path: format!("{i}.md"),
                last_opened_epoch_ms: i,
            });
        }

        let updated = upsert_recent(list, "new.md".to_string(), 5);
        assert_eq!(updated.len(), 5);
        assert_eq!(updated.first().map(|item| item.path.as_str()), Some("new.md"));
    }
}
