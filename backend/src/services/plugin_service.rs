use chrono::Utc;

use crate::errors::{BackendError, BackendResult};
use crate::models::{
    PluginEvent, PluginLifecycleStatus, PluginPermissionCheckRequest, PluginRuntime,
    RegisterPluginRequest,
};

pub fn register_plugin(
    plugins: &mut Vec<PluginRuntime>,
    request: RegisterPluginRequest,
) -> BackendResult<PluginRuntime> {
    if request.manifest.id.trim().is_empty() {
        return Err(BackendError::Plugin("plugin id must not be empty".to_string()));
    }

    if plugins
        .iter()
        .any(|plugin| plugin.manifest.id == request.manifest.id)
    {
        return Err(BackendError::Plugin(format!(
            "plugin already registered: {}",
            request.manifest.id
        )));
    }

    let runtime = PluginRuntime {
        manifest: request.manifest,
        status: PluginLifecycleStatus::Registered,
        installed_path: request.installed_path,
    };
    plugins.push(runtime.clone());
    Ok(runtime)
}

pub fn activate_plugin(plugins: &mut [PluginRuntime], plugin_id: &str) -> BackendResult<PluginRuntime> {
    set_plugin_status(plugins, plugin_id, PluginLifecycleStatus::Active)
}

pub fn disable_plugin(plugins: &mut [PluginRuntime], plugin_id: &str) -> BackendResult<PluginRuntime> {
    set_plugin_status(plugins, plugin_id, PluginLifecycleStatus::Disabled)
}

pub fn deactivate_plugin(
    plugins: &mut [PluginRuntime],
    plugin_id: &str,
) -> BackendResult<PluginRuntime> {
    set_plugin_status(plugins, plugin_id, PluginLifecycleStatus::Registered)
}

pub fn destroy_plugin(plugins: &mut Vec<PluginRuntime>, plugin_id: &str) -> BackendResult<PluginRuntime> {
    let index = plugins
        .iter()
        .position(|plugin| plugin.manifest.id == plugin_id)
        .ok_or_else(|| BackendError::Plugin(format!("plugin not found: {plugin_id}")))?;
    Ok(plugins.remove(index))
}

pub fn emit_event(
    events: &mut Vec<PluginEvent>,
    plugin_id: String,
    event: String,
    payload: Option<String>,
) -> PluginEvent {
    let emitted = PluginEvent {
        plugin_id,
        event,
        payload,
        epoch_ms: Utc::now().timestamp_millis(),
    };

    events.push(emitted.clone());
    if events.len() > 500 {
        let to_remove = events.len() - 500;
        events.drain(0..to_remove);
    }

    emitted
}

pub fn check_permission(
    plugins: &[PluginRuntime],
    request: &PluginPermissionCheckRequest,
) -> BackendResult<bool> {
    let plugin = plugins
        .iter()
        .find(|item| item.manifest.id == request.plugin_id)
        .ok_or_else(|| BackendError::Plugin(format!("plugin not found: {}", request.plugin_id)))?;

    Ok(plugin
        .manifest
        .permissions
        .iter()
        .any(|permission| permission == &request.permission))
}

fn set_plugin_status(
    plugins: &mut [PluginRuntime],
    plugin_id: &str,
    status: PluginLifecycleStatus,
) -> BackendResult<PluginRuntime> {
    let plugin = plugins
        .iter_mut()
        .find(|plugin| plugin.manifest.id == plugin_id)
        .ok_or_else(|| BackendError::Plugin(format!("plugin not found: {plugin_id}")))?;
    plugin.status = status;
    Ok(plugin.clone())
}