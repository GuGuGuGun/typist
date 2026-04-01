#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .manage(typist_backend::commands::BackendFacade::new())
        .invoke_handler(tauri::generate_handler![
            typist_backend::commands::open_file_cmd,
            typist_backend::commands::save_file_cmd,
            typist_backend::commands::save_file_as_cmd,
            typist_backend::commands::close_tab_cmd,
            typist_backend::commands::switch_tab_cmd,
            typist_backend::commands::list_tabs_cmd,
            typist_backend::commands::mark_tab_dirty_cmd,
            typist_backend::commands::check_external_modification_cmd,
            typist_backend::commands::list_recent_files_cmd,
            typist_backend::commands::get_settings_cmd,
            typist_backend::commands::update_settings_cmd,
            typist_backend::commands::search_in_document_cmd,
            typist_backend::commands::replace_in_document_cmd,
            typist_backend::commands::open_workspace_cmd,
            typist_backend::commands::get_workspace_path_cmd,
            typist_backend::commands::global_search_cmd,
            typist_backend::commands::export_document_cmd,
            typist_backend::commands::register_plugin_cmd,
            typist_backend::commands::activate_plugin_cmd,
            typist_backend::commands::disable_plugin_cmd,
            typist_backend::commands::deactivate_plugin_cmd,
            typist_backend::commands::destroy_plugin_cmd,
            typist_backend::commands::list_plugins_cmd,
            typist_backend::commands::emit_plugin_event_cmd,
            typist_backend::commands::list_plugin_events_cmd,
            typist_backend::commands::check_plugin_permission_cmd,
            typist_backend::commands::save_recovery_draft_cmd,
            typist_backend::commands::list_recovery_drafts_cmd,
            typist_backend::commands::restore_recovery_draft_cmd,
            typist_backend::commands::delete_recovery_draft_cmd,
            typist_backend::commands::paste_image_cmd,
            typist_backend::commands::check_update_cmd,
            typist_backend::commands::write_log_cmd,
            typist_backend::commands::get_diagnostics_report_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
