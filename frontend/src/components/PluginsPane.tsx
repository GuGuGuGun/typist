import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { runPluginCleanup } from '../sdk/TypistAPI';
import { Blocks, Trash2, Shield, FolderPlus, AlertCircle } from 'lucide-react';

const PLUGIN_SCRIPT_ATTR = 'data-typist-plugin-id';

const getPluginScripts = (pluginId: string) =>
  Array.from(document.querySelectorAll<HTMLScriptElement>(`script[${PLUGIN_SCRIPT_ATTR}]`)).filter(
    (script) => script.getAttribute(PLUGIN_SCRIPT_ATTR) === pluginId,
  );

const hasPluginScript = (pluginId: string) => getPluginScripts(pluginId).length > 0;

const removePluginScripts = (pluginId: string) => {
  getPluginScripts(pluginId).forEach((script) => script.remove());
};

const injectPluginScript = (pluginId: string, entry: string | null | undefined) => {
  if (!entry) return;

  removePluginScripts(pluginId);

  const script = document.createElement('script');
  script.src = entry;
  script.async = true;
  script.setAttribute(PLUGIN_SCRIPT_ATTR, pluginId);
  document.body.appendChild(script);
};

const builtInPlugins = [
  {
    id: 'dev.typist.builtin.wordcount',
    name: 'Word Count',
    version: 'builtin',
    description: '状态栏实时统计字数与字符数。',
  },
  {
    id: 'dev.typist.builtin.advanced-render',
    name: 'Advanced Render',
    version: 'builtin',
    description: '增强渲染交互：Mermaid点击回退源码、图片粘贴落盘、代码块复制按钮。',
  },
];

export const PluginsPane: React.FC = () => {
  const plugins = useStore(state => state.plugins);
  const builtInPluginState = useStore(state => state.builtInPluginState);
  const setBuiltInPluginEnabled = useStore(state => state.setBuiltInPluginEnabled);
  const loadPlugins = useStore(state => state.loadPlugins);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  useEffect(() => {
    plugins
      .filter((plugin) => plugin.status === 'active' && Boolean(plugin.manifest.entry))
      .forEach((plugin) => {
        if (!hasPluginScript(plugin.manifest.id)) {
          injectPluginScript(plugin.manifest.id, plugin.manifest.entry);
        }
      });
  }, [plugins]);

  const handleToggle = async (id: string, currentStatus: string) => {
    try {
      if (currentStatus === 'active') {
        await api.disablePlugin(id);
        await runPluginCleanup(id);
        removePluginScripts(id);
        setStatusMsg(`Disabled plugin: ${id}`);
      } else {
        await runPluginCleanup(id);
        const runtime = await api.activatePlugin(id);
        injectPluginScript(runtime.manifest.id, runtime.manifest.entry);
        setStatusMsg(`Enabled plugin: ${runtime.manifest.name}`);
      }
      await loadPlugins();
    } catch (e) {
      console.error(e);
      setStatusMsg(`Failed: ${e}`);
    }
  };

  const handleLoadCustom = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        filters: [{ name: 'Plugin Manifest', extensions: ['json'] }]
      });

      const manifestPath = Array.isArray(selected) ? selected[0] : selected;
      if (!manifestPath) return;

      const runtime = await api.registerPluginFromManifestPath(manifestPath);
      const activated = await api.activatePlugin(runtime.manifest.id);
      injectPluginScript(activated.manifest.id, activated.manifest.entry);
      await loadPlugins();
      setStatusMsg(`Loaded plugin: ${activated.manifest.name} v${activated.manifest.version}`);
    } catch (e) {
      console.error(e);
      setStatusMsg(`Failed: ${e}`);
    }
  };

  const toggleBuiltInPlugin = (pluginId: string) => {
    const current = builtInPluginState[pluginId] ?? true;
    const next = !current;
    setBuiltInPluginEnabled(pluginId, next);
    setStatusMsg(`${next ? 'Enabled' : 'Disabled'} built-in plugin: ${pluginId}`);
  };

  return (
    <div className="preferences-pane-content" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
      <div className="plugin-toolbar">
        <span className="plugin-toolbar-text">
          Enhance your editor with third-party extensions.
        </span>
        <button onClick={handleLoadCustom} className="primary-btn">
          <FolderPlus size={14} />
          Load Plugin
        </button>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div className="plugin-section-title">Built-in Plugins</div>

        {builtInPlugins.map((plugin) => {
          const isEnabled = builtInPluginState[plugin.id] ?? true;

          return (
            <div
              key={plugin.id}
              className={`plugin-card ${!isEnabled ? 'disabled' : ''}`}
            >
              <div className="plugin-info">
                <div className="plugin-title-wrap">
                  <span className="plugin-title">{plugin.name}</span>
                  <span className="plugin-version">{plugin.version}</span>
                </div>
                <div className="plugin-desc">{plugin.description}</div>
              </div>

              <div className="plugin-actions">
                <label className="switch-base" title={isEnabled ? "Disable plugin" : "Enable plugin"}>
                  <input
                    type="checkbox"
                    className="switch-input"
                    checked={isEnabled}
                    onChange={() => toggleBuiltInPlugin(plugin.id)}
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>
            </div>
          );
        })}

        <div className="plugin-section-title" style={{ marginTop: '16px' }}>External Plugins</div>

        {plugins.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
            <Blocks size={32} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
            <div style={{ fontSize: '14px' }}>No plugins installed via sandbox.</div>
          </div>
        )}

        {plugins.map((plugin, idx) => {
          const isActive = plugin.status === 'active';

          return (
            <div key={idx} className={`plugin-card ${!isActive ? 'disabled' : ''}`}>
              <div className="plugin-info">
                <div className="plugin-title-wrap">
                  <span className="plugin-title">{plugin.manifest.name}</span>
                  <span className="plugin-version">v{plugin.manifest.version}</span>
                </div>
                <div className="plugin-desc">
                  {plugin.manifest.description || 'No description provided.'}
                </div>
                {plugin.manifest.permissions && plugin.manifest.permissions.length > 0 && (
                  <div className="plugin-perms">
                    <Shield size={10} />
                    {plugin.manifest.permissions.join(', ')}
                  </div>
                )}
              </div>

              <div className="plugin-actions">
                <label className="switch-base" title={isActive ? "Disable plugin" : "Enable plugin"}>
                  <input
                    type="checkbox"
                    className="switch-input"
                    checked={isActive}
                    onChange={() => handleToggle(plugin.manifest.id, plugin.status)}
                  />
                  <span className="switch-slider"></span>
                </label>

                <button
                  title="Uninstall Plugin"
                  className="plugin-delete-btn"
                  onClick={async () => {
                    await runPluginCleanup(plugin.manifest.id);
                    removePluginScripts(plugin.manifest.id);
                    await api.destroyPlugin(plugin.manifest.id);
                    await loadPlugins();
                    setStatusMsg(`Uninstalled plugin: ${plugin.manifest.id}`);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {statusMsg && (
        <div style={{
          padding: '10px 24px',
          fontSize: '12px',
          background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
          color: 'var(--text-primary)',
          borderTop: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={14} color="var(--accent)" />
          {statusMsg}
        </div>
      )}
    </div>
  );
};
