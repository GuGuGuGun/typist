use std::path::Path;
use std::sync::{Arc, Mutex, MutexGuard};

use crate::errors::{BackendError, BackendResult};
use crate::models::{
    DiagnosticsReport, EditorSettings, ExportRequest, ExportResult, ExternalChangeStatus,
    GlobalSearchRequest, GlobalSearchResponse, ImagePasteRequest, ImagePasteResponse,
    LogWriteRequest, OpenFileResponse, OpenWorkspaceResponse, PluginEvent,
    PluginPermissionCheckRequest, PluginPermissionCheckResponse, PluginRuntime,
    RecoveryDraftContent, RecoveryDraftMeta, RecentFileItem, RegisterPluginRequest,
    ReplaceRequest, ReplaceResult, SaveFileResponse, SaveRecoveryDraftRequest, SearchMatch,
    SearchRequest, SettingsPatch, TabSummary, UpdateCheckRequest, UpdateInfo,
};
use crate::services::{
    diagnostics_service, export_service, file_service, image_service, plugin_service,
    recent_service, recovery_service, search_service, update_service, workspace_service,
};
use crate::state::AppState;

#[derive(Clone, Default)]
pub struct BackendFacade {
    state: Arc<Mutex<AppState>>,
}

impl BackendFacade {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn open_file(&self, path: String) -> BackendResult<OpenFileResponse> {
        let opened = file_service::open_markdown_file(&path)?;

        let mut state = self.lock_state()?;
        let tab = state.open_or_focus_tab(path.clone(), opened.title, opened.snapshot);
        let recents = recent_service::upsert_recent(state.recent_files(), path, 20);
        state.set_recent_files(recents);

        Ok(OpenFileResponse {
            tab,
            content: opened.content,
        })
    }

    pub fn save_file(&self, tab_id: String, content: String) -> BackendResult<SaveFileResponse> {
        let path = {
            let state = self.lock_state()?;
            state
                .get_tab_path(&tab_id)
                .ok_or_else(|| BackendError::TabNotFound(tab_id.clone()))?
        };

        let snapshot = file_service::save_markdown_file(&path, content.as_str())?;

        let mut state = self.lock_state()?;
        let tab = state
            .update_tab_after_save(&tab_id, snapshot.clone())
            .ok_or_else(|| BackendError::TabNotFound(tab_id.clone()))?;

        Ok(SaveFileResponse { tab, snapshot })
    }

    pub fn save_file_as(
        &self,
        tab_id: String,
        target_path: String,
        content: String,
    ) -> BackendResult<SaveFileResponse> {
        let snapshot = file_service::save_markdown_file(&target_path, content.as_str())?;
        let new_title = Path::new(&target_path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("untitled.md")
            .to_string();

        let mut state = self.lock_state()?;
        let tab = state
            .update_tab_path_and_snapshot(
                &tab_id,
                target_path.clone(),
                new_title,
                snapshot.clone(),
            )
            .ok_or_else(|| BackendError::TabNotFound(tab_id.clone()))?;
        let recents = recent_service::upsert_recent(state.recent_files(), target_path, 20);
        state.set_recent_files(recents);

        Ok(SaveFileResponse { tab, snapshot })
    }

    pub fn close_tab(&self, tab_id: String) -> BackendResult<TabSummary> {
        let mut state = self.lock_state()?;
        state
            .close_tab(&tab_id)
            .ok_or(BackendError::TabNotFound(tab_id))
    }

    pub fn switch_tab(&self, tab_id: String) -> BackendResult<TabSummary> {
        let mut state = self.lock_state()?;
        state
            .switch_tab(&tab_id)
            .ok_or(BackendError::TabNotFound(tab_id))
    }

    pub fn list_tabs(&self) -> BackendResult<Vec<TabSummary>> {
        let state = self.lock_state()?;
        Ok(state.list_tabs())
    }

    pub fn mark_tab_dirty(&self, tab_id: String, is_dirty: bool) -> BackendResult<TabSummary> {
        let mut state = self.lock_state()?;
        state
            .mark_tab_dirty(&tab_id, is_dirty)
            .ok_or(BackendError::TabNotFound(tab_id))
    }

    pub fn check_external_modification(
        &self,
        tab_id: String,
    ) -> BackendResult<ExternalChangeStatus> {
        let (path, previous_snapshot) = {
            let state = self.lock_state()?;
            let path = state
                .get_tab_path(&tab_id)
                .ok_or_else(|| BackendError::TabNotFound(tab_id.clone()))?;
            let snapshot = state
                .get_tab_snapshot(&tab_id)
                .ok_or_else(|| BackendError::TabNotFound(tab_id.clone()))?;
            (path, snapshot)
        };

        file_service::check_external_change(&path, &previous_snapshot)
    }

    pub fn list_recent_files(&self) -> BackendResult<Vec<RecentFileItem>> {
        let state = self.lock_state()?;
        Ok(state.recent_files())
    }

    pub fn get_settings(&self) -> BackendResult<EditorSettings> {
        let state = self.lock_state()?;
        Ok(state.settings())
    }

    pub fn update_settings(&self, patch: SettingsPatch) -> BackendResult<EditorSettings> {
        let mut state = self.lock_state()?;
        Ok(state.update_settings(patch))
    }

    pub fn search_in_document(&self, request: SearchRequest) -> BackendResult<Vec<SearchMatch>> {
        search_service::search_in_document(&request)
    }

    pub fn replace_in_document(&self, request: ReplaceRequest) -> BackendResult<ReplaceResult> {
        search_service::replace_in_document(&request)
    }

    pub fn open_workspace(&self, path: String) -> BackendResult<OpenWorkspaceResponse> {
        let opened = workspace_service::open_workspace(path.as_str())?;
        let mut state = self.lock_state()?;
        state.set_workspace_root(Some(path));
        Ok(opened)
    }

    pub fn get_workspace_path(&self) -> BackendResult<Option<String>> {
        let state = self.lock_state()?;
        Ok(state.workspace_root())
    }

    pub fn create_workspace_file(&self, parent_path: String, name: String) -> BackendResult<String> {
        workspace_service::create_workspace_file(parent_path.as_str(), name.as_str())
    }

    pub fn create_workspace_folder(&self, parent_path: String, name: String) -> BackendResult<String> {
        workspace_service::create_workspace_folder(parent_path.as_str(), name.as_str())
    }

    pub fn rename_workspace_entry(&self, target_path: String, new_name: String) -> BackendResult<String> {
        workspace_service::rename_workspace_entry(target_path.as_str(), new_name.as_str())
    }

    pub fn delete_workspace_entry(&self, target_path: String) -> BackendResult<()> {
        workspace_service::delete_workspace_entry(target_path.as_str())
    }

    pub fn move_workspace_entry(&self, source_path: String, destination_parent_path: String) -> BackendResult<String> {
        workspace_service::move_workspace_entry(source_path.as_str(), destination_parent_path.as_str())
    }

    pub fn copy_workspace_entry(&self, source_path: String, destination_parent_path: String) -> BackendResult<String> {
        workspace_service::copy_workspace_entry(source_path.as_str(), destination_parent_path.as_str())
    }

    pub fn global_search(&self, request: GlobalSearchRequest) -> BackendResult<GlobalSearchResponse> {
        workspace_service::global_search(&request)
    }

    pub fn export_document(&self, request: ExportRequest) -> BackendResult<ExportResult> {
        export_service::export_document(&request)
    }

    pub fn register_plugin(&self, request: RegisterPluginRequest) -> BackendResult<PluginRuntime> {
        let mut state = self.lock_state()?;
        plugin_service::register_plugin(state.plugins_mut(), request)
    }

    pub fn activate_plugin(&self, plugin_id: String) -> BackendResult<PluginRuntime> {
        let mut state = self.lock_state()?;
        plugin_service::activate_plugin(state.plugins_mut(), plugin_id.as_str())
    }

    pub fn disable_plugin(&self, plugin_id: String) -> BackendResult<PluginRuntime> {
        let mut state = self.lock_state()?;
        plugin_service::disable_plugin(state.plugins_mut(), plugin_id.as_str())
    }

    pub fn deactivate_plugin(&self, plugin_id: String) -> BackendResult<PluginRuntime> {
        let mut state = self.lock_state()?;
        plugin_service::deactivate_plugin(state.plugins_mut(), plugin_id.as_str())
    }

    pub fn destroy_plugin(&self, plugin_id: String) -> BackendResult<PluginRuntime> {
        let mut state = self.lock_state()?;
        plugin_service::destroy_plugin(state.plugins_mut(), plugin_id.as_str())
    }

    pub fn list_plugins(&self) -> BackendResult<Vec<PluginRuntime>> {
        let state = self.lock_state()?;
        Ok(state.plugins())
    }

    pub fn emit_plugin_event(
        &self,
        plugin_id: String,
        event: String,
        payload: Option<String>,
    ) -> BackendResult<PluginEvent> {
        let mut state = self.lock_state()?;
        Ok(plugin_service::emit_event(
            state.plugin_events_mut(),
            plugin_id,
            event,
            payload,
        ))
    }

    pub fn list_plugin_events(&self) -> BackendResult<Vec<PluginEvent>> {
        let state = self.lock_state()?;
        Ok(state.plugin_events())
    }

    pub fn check_plugin_permission(
        &self,
        request: PluginPermissionCheckRequest,
    ) -> BackendResult<PluginPermissionCheckResponse> {
        let state = self.lock_state()?;
        let allowed = plugin_service::check_permission(state.plugins().as_slice(), &request)?;
        Ok(PluginPermissionCheckResponse { allowed })
    }

    pub fn save_recovery_draft(
        &self,
        request: SaveRecoveryDraftRequest,
    ) -> BackendResult<RecoveryDraftMeta> {
        let recovery_dir = {
            let state = self.lock_state()?;
            state
                .settings()
                .recovery_dir
                .unwrap_or_else(recovery_service::default_recovery_dir)
        };
        recovery_service::save_recovery_draft(recovery_dir.as_str(), &request)
    }

    pub fn list_recovery_drafts(&self) -> BackendResult<Vec<RecoveryDraftMeta>> {
        let recovery_dir = {
            let state = self.lock_state()?;
            state
                .settings()
                .recovery_dir
                .unwrap_or_else(recovery_service::default_recovery_dir)
        };
        recovery_service::list_recovery_drafts(recovery_dir.as_str())
    }

    pub fn restore_recovery_draft(&self, draft_id: String) -> BackendResult<RecoveryDraftContent> {
        let recovery_dir = {
            let state = self.lock_state()?;
            state
                .settings()
                .recovery_dir
                .unwrap_or_else(recovery_service::default_recovery_dir)
        };
        recovery_service::restore_recovery_draft(recovery_dir.as_str(), draft_id.as_str())
    }

    pub fn delete_recovery_draft(&self, draft_id: String) -> BackendResult<()> {
        let recovery_dir = {
            let state = self.lock_state()?;
            state
                .settings()
                .recovery_dir
                .unwrap_or_else(recovery_service::default_recovery_dir)
        };
        recovery_service::delete_recovery_draft(recovery_dir.as_str(), draft_id.as_str())
    }

    pub fn paste_image(&self, request: ImagePasteRequest) -> BackendResult<ImagePasteResponse> {
        let assets_dir = {
            let state = self.lock_state()?;
            state.settings().image_assets_dir
        };
        image_service::save_pasted_image(&request, assets_dir.as_deref())
    }

    pub fn check_update(&self, request: UpdateCheckRequest) -> BackendResult<UpdateInfo> {
        update_service::check_update(&request)
    }

    pub fn write_log(&self, request: LogWriteRequest) -> BackendResult<()> {
        let log_file_path = {
            let state = self.lock_state()?;
            state.log_file_path()
        };
        diagnostics_service::write_log(log_file_path.as_str(), &request)
    }

    pub fn get_diagnostics_report(&self) -> BackendResult<DiagnosticsReport> {
        let (log_file_path, open_tab_count, plugin_count, workspace_path) = {
            let state = self.lock_state()?;
            (
                state.log_file_path(),
                state.open_tab_count(),
                state.plugin_count(),
                state.workspace_root(),
            )
        };

        diagnostics_service::build_report(
            log_file_path.as_str(),
            open_tab_count,
            plugin_count,
            workspace_path,
        )
    }

    fn lock_state(&self) -> BackendResult<MutexGuard<'_, AppState>> {
        self.state.lock().map_err(|_| BackendError::StatePoisoned)
    }
}

#[cfg(feature = "tauri-integration")]
fn to_invoke_result<T>(result: BackendResult<T>) -> Result<T, String> {
    result.map_err(|err| err.to_string())
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn open_file_cmd(
    backend: tauri::State<'_, BackendFacade>,
    path: String,
) -> Result<OpenFileResponse, String> {
    to_invoke_result(backend.open_file(path))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn save_file_cmd(
    backend: tauri::State<'_, BackendFacade>,
    tab_id: String,
    content: String,
) -> Result<SaveFileResponse, String> {
    to_invoke_result(backend.save_file(tab_id, content))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn save_file_as_cmd(
    backend: tauri::State<'_, BackendFacade>,
    tab_id: String,
    target_path: String,
    content: String,
) -> Result<SaveFileResponse, String> {
    to_invoke_result(backend.save_file_as(tab_id, target_path, content))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn close_tab_cmd(
    backend: tauri::State<'_, BackendFacade>,
    tab_id: String,
) -> Result<TabSummary, String> {
    to_invoke_result(backend.close_tab(tab_id))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn switch_tab_cmd(
    backend: tauri::State<'_, BackendFacade>,
    tab_id: String,
) -> Result<TabSummary, String> {
    to_invoke_result(backend.switch_tab(tab_id))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn list_tabs_cmd(backend: tauri::State<'_, BackendFacade>) -> Result<Vec<TabSummary>, String> {
    to_invoke_result(backend.list_tabs())
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn mark_tab_dirty_cmd(
    backend: tauri::State<'_, BackendFacade>,
    tab_id: String,
    is_dirty: bool,
) -> Result<TabSummary, String> {
    to_invoke_result(backend.mark_tab_dirty(tab_id, is_dirty))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn check_external_modification_cmd(
    backend: tauri::State<'_, BackendFacade>,
    tab_id: String,
) -> Result<ExternalChangeStatus, String> {
    to_invoke_result(backend.check_external_modification(tab_id))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn list_recent_files_cmd(
    backend: tauri::State<'_, BackendFacade>,
) -> Result<Vec<RecentFileItem>, String> {
    to_invoke_result(backend.list_recent_files())
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn get_settings_cmd(
    backend: tauri::State<'_, BackendFacade>,
) -> Result<EditorSettings, String> {
    to_invoke_result(backend.get_settings())
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn update_settings_cmd(
    backend: tauri::State<'_, BackendFacade>,
    patch: SettingsPatch,
) -> Result<EditorSettings, String> {
    to_invoke_result(backend.update_settings(patch))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn search_in_document_cmd(
    backend: tauri::State<'_, BackendFacade>,
    request: SearchRequest,
) -> Result<Vec<SearchMatch>, String> {
    to_invoke_result(backend.search_in_document(request))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn replace_in_document_cmd(
    backend: tauri::State<'_, BackendFacade>,
    request: ReplaceRequest,
) -> Result<ReplaceResult, String> {
    to_invoke_result(backend.replace_in_document(request))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn open_workspace_cmd(
    backend: tauri::State<'_, BackendFacade>,
    path: String,
) -> Result<OpenWorkspaceResponse, String> {
    to_invoke_result(backend.open_workspace(path))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn get_workspace_path_cmd(
    backend: tauri::State<'_, BackendFacade>,
) -> Result<Option<String>, String> {
    to_invoke_result(backend.get_workspace_path())
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn create_workspace_file_cmd(
    backend: tauri::State<'_, BackendFacade>,
    parent_path: String,
    name: String,
) -> Result<String, String> {
    to_invoke_result(backend.create_workspace_file(parent_path, name))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn create_workspace_folder_cmd(
    backend: tauri::State<'_, BackendFacade>,
    parent_path: String,
    name: String,
) -> Result<String, String> {
    to_invoke_result(backend.create_workspace_folder(parent_path, name))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn rename_workspace_entry_cmd(
    backend: tauri::State<'_, BackendFacade>,
    target_path: String,
    new_name: String,
) -> Result<String, String> {
    to_invoke_result(backend.rename_workspace_entry(target_path, new_name))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn delete_workspace_entry_cmd(
    backend: tauri::State<'_, BackendFacade>,
    target_path: String,
) -> Result<(), String> {
    to_invoke_result(backend.delete_workspace_entry(target_path))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn move_workspace_entry_cmd(
    backend: tauri::State<'_, BackendFacade>,
    source_path: String,
    destination_parent_path: String,
) -> Result<String, String> {
    to_invoke_result(backend.move_workspace_entry(source_path, destination_parent_path))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn copy_workspace_entry_cmd(
    backend: tauri::State<'_, BackendFacade>,
    source_path: String,
    destination_parent_path: String,
) -> Result<String, String> {
    to_invoke_result(backend.copy_workspace_entry(source_path, destination_parent_path))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn global_search_cmd(
    backend: tauri::State<'_, BackendFacade>,
    request: GlobalSearchRequest,
) -> Result<GlobalSearchResponse, String> {
    to_invoke_result(backend.global_search(request))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn export_document_cmd(
    backend: tauri::State<'_, BackendFacade>,
    request: ExportRequest,
) -> Result<ExportResult, String> {
    to_invoke_result(backend.export_document(request))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn register_plugin_cmd(
    backend: tauri::State<'_, BackendFacade>,
    request: RegisterPluginRequest,
) -> Result<PluginRuntime, String> {
    to_invoke_result(backend.register_plugin(request))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn activate_plugin_cmd(
    backend: tauri::State<'_, BackendFacade>,
    plugin_id: String,
) -> Result<PluginRuntime, String> {
    to_invoke_result(backend.activate_plugin(plugin_id))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn disable_plugin_cmd(
    backend: tauri::State<'_, BackendFacade>,
    plugin_id: String,
) -> Result<PluginRuntime, String> {
    to_invoke_result(backend.disable_plugin(plugin_id))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn deactivate_plugin_cmd(
    backend: tauri::State<'_, BackendFacade>,
    plugin_id: String,
) -> Result<PluginRuntime, String> {
    to_invoke_result(backend.deactivate_plugin(plugin_id))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn destroy_plugin_cmd(
    backend: tauri::State<'_, BackendFacade>,
    plugin_id: String,
) -> Result<PluginRuntime, String> {
    to_invoke_result(backend.destroy_plugin(plugin_id))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn list_plugins_cmd(
    backend: tauri::State<'_, BackendFacade>,
) -> Result<Vec<PluginRuntime>, String> {
    to_invoke_result(backend.list_plugins())
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn emit_plugin_event_cmd(
    backend: tauri::State<'_, BackendFacade>,
    plugin_id: String,
    event: String,
    payload: Option<String>,
) -> Result<PluginEvent, String> {
    to_invoke_result(backend.emit_plugin_event(plugin_id, event, payload))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn list_plugin_events_cmd(
    backend: tauri::State<'_, BackendFacade>,
) -> Result<Vec<PluginEvent>, String> {
    to_invoke_result(backend.list_plugin_events())
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn check_plugin_permission_cmd(
    backend: tauri::State<'_, BackendFacade>,
    request: PluginPermissionCheckRequest,
) -> Result<PluginPermissionCheckResponse, String> {
    to_invoke_result(backend.check_plugin_permission(request))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn save_recovery_draft_cmd(
    backend: tauri::State<'_, BackendFacade>,
    request: SaveRecoveryDraftRequest,
) -> Result<RecoveryDraftMeta, String> {
    to_invoke_result(backend.save_recovery_draft(request))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn list_recovery_drafts_cmd(
    backend: tauri::State<'_, BackendFacade>,
) -> Result<Vec<RecoveryDraftMeta>, String> {
    to_invoke_result(backend.list_recovery_drafts())
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn restore_recovery_draft_cmd(
    backend: tauri::State<'_, BackendFacade>,
    draft_id: String,
) -> Result<RecoveryDraftContent, String> {
    to_invoke_result(backend.restore_recovery_draft(draft_id))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn delete_recovery_draft_cmd(
    backend: tauri::State<'_, BackendFacade>,
    draft_id: String,
) -> Result<(), String> {
    to_invoke_result(backend.delete_recovery_draft(draft_id))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn paste_image_cmd(
    backend: tauri::State<'_, BackendFacade>,
    request: ImagePasteRequest,
) -> Result<ImagePasteResponse, String> {
    to_invoke_result(backend.paste_image(request))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn check_update_cmd(
    backend: tauri::State<'_, BackendFacade>,
    request: UpdateCheckRequest,
) -> Result<UpdateInfo, String> {
    to_invoke_result(backend.check_update(request))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn write_log_cmd(
    backend: tauri::State<'_, BackendFacade>,
    request: LogWriteRequest,
) -> Result<(), String> {
    to_invoke_result(backend.write_log(request))
}

#[cfg(feature = "tauri-integration")]
#[tauri::command]
pub fn get_diagnostics_report_cmd(
    backend: tauri::State<'_, BackendFacade>,
) -> Result<DiagnosticsReport, String> {
    to_invoke_result(backend.get_diagnostics_report())
}
