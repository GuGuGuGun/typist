use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSnapshot {
    pub modified_epoch_ms: i64,
    pub size_bytes: u64,
    pub content_hash: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TabSummary {
    pub tab_id: String,
    pub path: String,
    pub title: String,
    pub is_dirty: bool,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenFileResponse {
    pub tab: TabSummary,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveFileResponse {
    pub tab: TabSummary,
    pub snapshot: FileSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalChangeStatus {
    pub changed: bool,
    pub latest_snapshot: Option<FileSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentFileItem {
    pub path: String,
    pub last_opened_epoch_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemeMode {
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppLanguage {
    Zh,
    En,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorSettings {
    pub autosave_enabled: bool,
    pub autosave_interval_secs: u64,
    pub theme: ThemeMode,
    pub focus_mode_enabled: bool,
    pub typewriter_mode_enabled: bool,
    pub font_family: String,
    pub font_size_px: u16,
    pub custom_css_path: Option<String>,
    pub auto_update_enabled: bool,
    pub update_feed_url: Option<String>,
    pub recovery_dir: Option<String>,
    pub image_assets_dir: Option<String>,
    pub language: AppLanguage,
}

impl Default for EditorSettings {
    fn default() -> Self {
        Self {
            autosave_enabled: false,
            autosave_interval_secs: 30,
            theme: ThemeMode::System,
            focus_mode_enabled: false,
            typewriter_mode_enabled: false,
            font_family: "JetBrains Mono".to_string(),
            font_size_px: 15,
            custom_css_path: None,
            auto_update_enabled: true,
            update_feed_url: None,
            recovery_dir: None,
            image_assets_dir: None,
            language: AppLanguage::Zh,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsPatch {
    pub autosave_enabled: Option<bool>,
    pub autosave_interval_secs: Option<u64>,
    pub theme: Option<ThemeMode>,
    pub focus_mode_enabled: Option<bool>,
    pub typewriter_mode_enabled: Option<bool>,
    pub font_family: Option<String>,
    pub font_size_px: Option<u16>,
    pub custom_css_path: Option<Option<String>>,
    pub auto_update_enabled: Option<bool>,
    pub update_feed_url: Option<Option<String>>,
    pub recovery_dir: Option<Option<String>>,
    pub image_assets_dir: Option<Option<String>>,
    pub language: Option<AppLanguage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchRequest {
    pub content: String,
    pub query: String,
    pub is_regex: bool,
    pub case_sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub match_start: usize,
    pub match_end: usize,
    pub line: usize,
    pub column: usize,
    pub matched_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplaceRequest {
    pub content: String,
    pub query: String,
    pub replacement: String,
    pub is_regex: bool,
    pub case_sensitive: bool,
    pub replace_all: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplaceResult {
    pub content: String,
    pub replaced_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceNode {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size_bytes: Option<u64>,
    pub children: Vec<WorkspaceNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenWorkspaceResponse {
    pub root_path: String,
    pub tree: WorkspaceNode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSearchRequest {
    pub workspace_path: String,
    pub query: String,
    pub is_regex: bool,
    pub case_sensitive: bool,
    pub include_extensions: Option<Vec<String>>,
    pub max_results: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSearchMatch {
    pub path: String,
    pub line: usize,
    pub column: usize,
    pub matched_text: String,
    pub line_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSearchResponse {
    pub scanned_files: usize,
    pub matches: Vec<GlobalSearchMatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExportFormat {
    Html,
    Pdf,
    Docx,
    Latex,
    Epub,
    RevealJs,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportRequest {
    pub markdown: String,
    pub target_path: String,
    pub format: ExportFormat,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub target_path: String,
    pub bytes_written: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub entry: String,
    pub permissions: Vec<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PluginLifecycleStatus {
    Registered,
    Active,
    Disabled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginRuntime {
    pub manifest: PluginManifest,
    pub status: PluginLifecycleStatus,
    pub installed_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginEvent {
    pub plugin_id: String,
    pub event: String,
    pub payload: Option<String>,
    pub epoch_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterPluginRequest {
    pub manifest: PluginManifest,
    pub installed_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginPermissionCheckRequest {
    pub plugin_id: String,
    pub permission: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginPermissionCheckResponse {
    pub allowed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveRecoveryDraftRequest {
    pub tab_id: String,
    pub source_path: Option<String>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryDraftMeta {
    pub draft_id: String,
    pub source_path: Option<String>,
    pub updated_epoch_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryDraftContent {
    pub metadata: RecoveryDraftMeta,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImagePasteRequest {
    pub document_path: String,
    pub image_base64: String,
    pub file_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImagePasteResponse {
    pub absolute_path: String,
    pub relative_path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckRequest {
    pub current_version: String,
    pub feed_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub download_url: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogWriteRequest {
    pub level: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticsReport {
    pub log_file_path: String,
    pub recent_log_lines: Vec<String>,
    pub open_tab_count: usize,
    pub plugin_count: usize,
    pub workspace_path: Option<String>,
}
