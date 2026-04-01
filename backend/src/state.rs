use crate::models::{
    EditorSettings, FileSnapshot, PluginEvent, PluginLifecycleStatus, PluginRuntime,
    RecentFileItem, SettingsPatch, TabSummary,
};

#[derive(Debug, Clone)]
struct TabRuntime {
    summary: TabSummary,
    snapshot: FileSnapshot,
}

#[derive(Debug, Clone)]
pub struct AppState {
    tabs: Vec<TabRuntime>,
    active_tab_id: Option<String>,
    recent_files: Vec<RecentFileItem>,
    settings: EditorSettings,
    workspace_root: Option<String>,
    plugins: Vec<PluginRuntime>,
    plugin_events: Vec<PluginEvent>,
    log_file_path: String,
    next_tab_seq: u64,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            tabs: Vec::new(),
            active_tab_id: None,
            recent_files: Vec::new(),
            settings: EditorSettings::default(),
            workspace_root: None,
            plugins: Vec::new(),
            plugin_events: Vec::new(),
            log_file_path: std::env::temp_dir()
                .join("typist")
                .join("typist.log")
                .to_string_lossy()
                .to_string(),
            next_tab_seq: 1,
        }
    }
}

impl AppState {
    pub fn open_or_focus_tab(
        &mut self,
        path: String,
        title: String,
        snapshot: FileSnapshot,
    ) -> TabSummary {
        if let Some(index) = self.find_tab_index_by_path(&path) {
            self.tabs[index].snapshot = snapshot;
            self.active_tab_id = Some(self.tabs[index].summary.tab_id.clone());
            self.sync_active_flags();
            return self.tabs[index].summary.clone();
        }

        let tab_id = self.next_tab_id();
        self.active_tab_id = Some(tab_id.clone());
        self.tabs.push(TabRuntime {
            summary: TabSummary {
                tab_id,
                path,
                title,
                is_dirty: false,
                is_active: false,
            },
            snapshot,
        });
        self.sync_active_flags();
        self.tabs
            .last()
            .map(|tab| tab.summary.clone())
            .unwrap_or_else(|| TabSummary {
                tab_id: String::new(),
                path: String::new(),
                title: String::new(),
                is_dirty: false,
                is_active: false,
            })
    }

    pub fn close_tab(&mut self, tab_id: &str) -> Option<TabSummary> {
        let index = self.find_tab_index(tab_id)?;
        let removed = self.tabs.remove(index).summary;

        if self.active_tab_id.as_deref() == Some(tab_id) {
            self.active_tab_id = self.tabs.last().map(|tab| tab.summary.tab_id.clone());
        }

        self.sync_active_flags();
        Some(removed)
    }

    pub fn switch_tab(&mut self, tab_id: &str) -> Option<TabSummary> {
        let index = self.find_tab_index(tab_id)?;
        self.active_tab_id = Some(self.tabs[index].summary.tab_id.clone());
        self.sync_active_flags();
        Some(self.tabs[index].summary.clone())
    }

    pub fn list_tabs(&self) -> Vec<TabSummary> {
        self.tabs.iter().map(|tab| tab.summary.clone()).collect()
    }

    pub fn get_tab_path(&self, tab_id: &str) -> Option<String> {
        self.find_tab_index(tab_id)
            .map(|index| self.tabs[index].summary.path.clone())
    }

    pub fn get_tab_snapshot(&self, tab_id: &str) -> Option<FileSnapshot> {
        self.find_tab_index(tab_id)
            .map(|index| self.tabs[index].snapshot.clone())
    }

    pub fn update_tab_after_save(
        &mut self,
        tab_id: &str,
        snapshot: FileSnapshot,
    ) -> Option<TabSummary> {
        let index = self.find_tab_index(tab_id)?;
        self.tabs[index].snapshot = snapshot;
        self.tabs[index].summary.is_dirty = false;
        Some(self.tabs[index].summary.clone())
    }

    pub fn update_tab_path_and_snapshot(
        &mut self,
        tab_id: &str,
        new_path: String,
        new_title: String,
        snapshot: FileSnapshot,
    ) -> Option<TabSummary> {
        let index = self.find_tab_index(tab_id)?;
        self.tabs[index].summary.path = new_path;
        self.tabs[index].summary.title = new_title;
        self.tabs[index].summary.is_dirty = false;
        self.tabs[index].snapshot = snapshot;
        Some(self.tabs[index].summary.clone())
    }

    pub fn mark_tab_dirty(&mut self, tab_id: &str, is_dirty: bool) -> Option<TabSummary> {
        let index = self.find_tab_index(tab_id)?;
        self.tabs[index].summary.is_dirty = is_dirty;
        Some(self.tabs[index].summary.clone())
    }

    pub fn recent_files(&self) -> Vec<RecentFileItem> {
        self.recent_files.clone()
    }

    pub fn set_recent_files(&mut self, files: Vec<RecentFileItem>) {
        self.recent_files = files;
    }

    pub fn settings(&self) -> EditorSettings {
        self.settings.clone()
    }

    pub fn update_settings(&mut self, patch: SettingsPatch) -> EditorSettings {
        if let Some(enabled) = patch.autosave_enabled {
            self.settings.autosave_enabled = enabled;
        }

        if let Some(interval) = patch.autosave_interval_secs {
            self.settings.autosave_interval_secs = interval;
        }

        if let Some(theme) = patch.theme {
            self.settings.theme = theme;
        }

        if let Some(enabled) = patch.focus_mode_enabled {
            self.settings.focus_mode_enabled = enabled;
        }

        if let Some(enabled) = patch.typewriter_mode_enabled {
            self.settings.typewriter_mode_enabled = enabled;
        }

        if let Some(font) = patch.font_family {
            self.settings.font_family = font;
        }

        if let Some(size) = patch.font_size_px {
            if size > 0 {
                self.settings.font_size_px = size;
            }
        }

        if let Some(css) = patch.custom_css_path {
            self.settings.custom_css_path = css;
        }

        if let Some(enabled) = patch.auto_update_enabled {
            self.settings.auto_update_enabled = enabled;
        }

        if let Some(url) = patch.update_feed_url {
            self.settings.update_feed_url = url;
        }

        if let Some(dir) = patch.recovery_dir {
            self.settings.recovery_dir = dir;
        }

        if let Some(dir) = patch.image_assets_dir {
            self.settings.image_assets_dir = dir;
        }

        self.settings.clone()
    }

    pub fn set_workspace_root(&mut self, path: Option<String>) {
        self.workspace_root = path;
    }

    pub fn workspace_root(&self) -> Option<String> {
        self.workspace_root.clone()
    }

    pub fn plugins(&self) -> Vec<PluginRuntime> {
        self.plugins.clone()
    }

    pub fn plugins_mut(&mut self) -> &mut Vec<PluginRuntime> {
        &mut self.plugins
    }

    pub fn plugin_events(&self) -> Vec<PluginEvent> {
        self.plugin_events.clone()
    }

    pub fn plugin_events_mut(&mut self) -> &mut Vec<PluginEvent> {
        &mut self.plugin_events
    }

    pub fn plugin_count(&self) -> usize {
        self.plugins
            .iter()
            .filter(|item| !matches!(item.status, PluginLifecycleStatus::Disabled))
            .count()
    }

    pub fn open_tab_count(&self) -> usize {
        self.tabs.len()
    }

    pub fn log_file_path(&self) -> String {
        self.log_file_path.clone()
    }

    pub fn set_log_file_path(&mut self, path: String) {
        self.log_file_path = path;
    }

    fn next_tab_id(&mut self) -> String {
        let tab_id = format!("tab-{}", self.next_tab_seq);
        self.next_tab_seq += 1;
        tab_id
    }

    fn find_tab_index(&self, tab_id: &str) -> Option<usize> {
        self.tabs.iter().position(|tab| tab.summary.tab_id == tab_id)
    }

    fn find_tab_index_by_path(&self, path: &str) -> Option<usize> {
        self.tabs.iter().position(|tab| tab.summary.path == path)
    }

    fn sync_active_flags(&mut self) {
        for tab in &mut self.tabs {
            tab.summary.is_active = self.active_tab_id.as_deref() == Some(tab.summary.tab_id.as_str());
        }
    }
}
