import { invoke } from '@tauri-apps/api/core';

// --- Type Definitions (Sync with backend/models.rs) ---

export type ThemeMode = 'system' | 'light' | 'dark';
export type AppLanguageMode = 'zh' | 'en';

export interface TabSummary {
  tab_id: string;
  path: string;
  title: string;
  is_dirty: boolean;
  is_active: boolean;
}

export interface EditorSettings {
  autosave_enabled: boolean;
  autosave_interval_secs: number;
  theme: ThemeMode;
  focus_mode_enabled: boolean;
  typewriter_mode_enabled: boolean;
  font_family: string;
  font_size_px: number;
  custom_css_path: string | null;
  auto_update_enabled: boolean;
  update_feed_url: string | null;
  recovery_dir: string | null;
  image_assets_dir: string | null;
  language: AppLanguageMode;
}

export interface SettingsPatch {
  autosave_enabled?: boolean;
  autosave_interval_secs?: number;
  theme?: ThemeMode;
  focus_mode_enabled?: boolean;
  typewriter_mode_enabled?: boolean;
  font_family?: string;
  font_size_px?: number;
  custom_css_path?: string | null;
  language?: AppLanguageMode;
}

export interface OpenFileResponse {
  tab: TabSummary;
  content: string;
}

export interface SaveFileResponse {
  tab: TabSummary;
  snapshot: string;
}

export interface FileSnapshot {
  modified_epoch_ms: number;
  size_bytes: number;
  content_hash: number;
}

export interface ExternalChangeStatus {
  changed: boolean;
  latest_snapshot: FileSnapshot | null;
}

export interface RecentFileItem {
  path: string;
  last_opened_at: string;
}

export interface ImagePasteRequest {
  base64_data: string;
  mime_type: string;
}

export interface ImagePasteResponse {
  local_path: string;
  url: string;
}

export interface SearchRequest {
  content: string;
  query: string;
  is_regex: boolean;
  case_sensitive: boolean;
}

export interface SearchMatch {
  match_start: number;
  match_end: number;
  line: number;
  column: number;
  matched_text: string;
}

export interface ReplaceRequest {
  content: string;
  query: string;
  replacement: string;
  is_regex: boolean;
  case_sensitive: boolean;
  replace_all: boolean;
}

export interface ReplaceResult {
  content: string;
  replaced_count: number;
}

// --- Phase 4 Workspace & Others ---
export interface WorkspaceNode {
  path: string;
  name: string;
  is_dir: boolean;
  size_bytes?: number;
  children: WorkspaceNode[];
}

export interface OpenWorkspaceResponse {
  root_path: string;
  tree: WorkspaceNode;
}

export interface GlobalSearchRequest {
  workspace_path: string;
  query: string;
  is_regex: boolean;
  case_sensitive: boolean;
  include_extensions?: string[];
  max_results?: number;
}

export interface GlobalSearchMatch {
  path: string;
  line: number;
  column: number;
  matched_text: string;
  line_text: string;
}

export interface GlobalSearchResponse {
  scanned_files: number;
  matches: GlobalSearchMatch[];
}

export interface ExportRequest {
  markdown: string;
  target_path: string;
  format: 'html' | 'pdf';
  title?: string;
}

export interface ExportResult {
  target_path: string;
  bytes_written: number;
}

export interface SaveRecoveryDraftRequest {
  tab_id: string;
  source_path: string | null;
  content: string;
}

export interface RecoveryDraftMeta {
  draft_id: string;
  source_path: string | null;
  updated_epoch_ms: number;
}

export interface RecoveryDraftContent {
  metadata: RecoveryDraftMeta;
  content: string;
}

export interface UpdateInfo {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  download_url: string | null;
  notes: string | null;
}

export interface UpdateCheckRequest {
  current_version: string;
  feed_url: string;
}

// --- Phase 3 Plugins ---

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  entry: string;
  permissions: string[];
  description: string | null;
}

export type PluginLifecycleStatus = 'registered' | 'active' | 'disabled';

export interface PluginRuntime {
  manifest: PluginManifest;
  status: PluginLifecycleStatus;
  installed_path: string;
}

export interface PluginEvent {
  plugin_id: string;
  event: string;
  payload: string | null;
  epoch_ms: number;
}

export interface RegisterPluginRequest {
  manifest: PluginManifest;
  installed_path: string;
}

// --- API Wrappers ---

export const api = {
  getLaunchFilePaths: () => invoke<string[]>('get_launch_file_paths_cmd'),

  // File & Tabs
  openFile: (path: string) => invoke<OpenFileResponse>('open_file_cmd', { path }),
  saveFile: (tabId: string, content: string) => invoke<SaveFileResponse>('save_file_cmd', { tabId, content }),
  saveFileAs: (tabId: string, targetPath: string, content: string) => invoke<SaveFileResponse>('save_file_as_cmd', { tabId, targetPath, content }),
  closeTab: (tabId: string) => invoke<TabSummary>('close_tab_cmd', { tabId }),
  switchTab: (tabId: string) => invoke<TabSummary>('switch_tab_cmd', { tabId }),
  listTabs: () => invoke<TabSummary[]>('list_tabs_cmd'),
  markTabDirty: (tabId: string, isDirty: boolean) => invoke<TabSummary>('mark_tab_dirty_cmd', { tabId, isDirty }),
  checkExternalModification: (tabId: string) => invoke<ExternalChangeStatus>('check_external_modification_cmd', { tabId }),
  listRecentFiles: () => invoke<RecentFileItem[]>('list_recent_files_cmd'),
  pasteImage: (request: ImagePasteRequest) => invoke<ImagePasteResponse>('paste_image_cmd', { request }),
  searchInDocument: (request: SearchRequest) => invoke<SearchMatch[]>('search_in_document_cmd', { request }),
  replaceInDocument: (request: ReplaceRequest) => invoke<ReplaceResult>('replace_in_document_cmd', { request }),

  // Workspace
  openWorkspace: (path: string) => invoke<OpenWorkspaceResponse>('open_workspace_cmd', { path }),
  getWorkspacePath: () => invoke<string | null>('get_workspace_path_cmd'),
  createWorkspaceFile: (parentPath: string, name: string) =>
    invoke<string>('create_workspace_file_cmd', { parentPath, name }),
  createWorkspaceFolder: (parentPath: string, name: string) =>
    invoke<string>('create_workspace_folder_cmd', { parentPath, name }),
  renameWorkspaceEntry: (targetPath: string, newName: string) =>
    invoke<string>('rename_workspace_entry_cmd', { targetPath, newName }),
  deleteWorkspaceEntry: (targetPath: string) =>
    invoke<void>('delete_workspace_entry_cmd', { targetPath }),
  moveWorkspaceEntry: (sourcePath: string, destinationParentPath: string) =>
    invoke<string>('move_workspace_entry_cmd', { sourcePath, destinationParentPath }),
  copyWorkspaceEntry: (sourcePath: string, destinationParentPath: string) =>
    invoke<string>('copy_workspace_entry_cmd', { sourcePath, destinationParentPath }),
  globalSearch: (request: GlobalSearchRequest) => invoke<GlobalSearchResponse>('global_search_cmd', { request }),

  // Recovery
  saveRecoveryDraft: (request: SaveRecoveryDraftRequest) => invoke<RecoveryDraftMeta>('save_recovery_draft_cmd', { request }),
  listRecoveryDrafts: () => invoke<RecoveryDraftMeta[]>('list_recovery_drafts_cmd'),
  restoreRecoveryDraft: (draftId: string) => invoke<RecoveryDraftContent>('restore_recovery_draft_cmd', { draftId }),
  deleteRecoveryDraft: (draftId: string) => invoke<void>('delete_recovery_draft_cmd', { draftId }),

  // Export & Update
  exportDocument: (request: ExportRequest) => invoke<ExportResult>('export_document_cmd', { request }),
  checkUpdate: (request: UpdateCheckRequest) => invoke<UpdateInfo>('check_update_cmd', { request }),

  // Plugins
  registerPlugin: (request: RegisterPluginRequest) => invoke<PluginRuntime>('register_plugin_cmd', { request }),
  registerPluginFromManifestPath: (manifestPath: string) =>
    invoke<PluginRuntime>('register_plugin_from_manifest_path_cmd', { manifestPath }),
  activatePlugin: (pluginId: string) => invoke<PluginRuntime>('activate_plugin_cmd', { pluginId }),
  disablePlugin: (pluginId: string) => invoke<PluginRuntime>('disable_plugin_cmd', { pluginId }),
  deactivatePlugin: (pluginId: string) => invoke<PluginRuntime>('deactivate_plugin_cmd', { pluginId }),
  destroyPlugin: (pluginId: string) => invoke<PluginRuntime>('destroy_plugin_cmd', { pluginId }),
  listPlugins: () => invoke<PluginRuntime[]>('list_plugins_cmd'),
  emitPluginEvent: (pluginId: string, event: string, payload: string | null) => invoke<PluginEvent>('emit_plugin_event_cmd', { pluginId, event, payload }),
  listPluginEvents: () => invoke<PluginEvent[]>('list_plugin_events_cmd'),

  // Settings
  getSettings: () => invoke<EditorSettings>('get_settings_cmd'),
  updateSettings: (patch: SettingsPatch) => invoke<EditorSettings>('update_settings_cmd', { patch }),
};
