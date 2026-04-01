use thiserror::Error;

pub type BackendResult<T> = Result<T, BackendError>;

#[derive(Debug, Error)]
pub enum BackendError {
    #[error("I/O error: {0}")]
    Io(String),
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    #[error("Tab not found: {0}")]
    TabNotFound(String),
    #[error("Search pattern error: {0}")]
    SearchPattern(String),
    #[error("Workspace error: {0}")]
    Workspace(String),
    #[error("Export error: {0}")]
    Export(String),
    #[error("Plugin error: {0}")]
    Plugin(String),
    #[error("Recovery error: {0}")]
    Recovery(String),
    #[error("Update error: {0}")]
    Update(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    #[error("State is unavailable")]
    StatePoisoned,
}

impl From<std::io::Error> for BackendError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value.to_string())
    }
}
