import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { Blocks, Trash2, Shield, FolderPlus, AlertCircle } from 'lucide-react';

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

  const handleToggle = async (id: string, currentStatus: string) => {
    try {
      if (currentStatus === 'active') {
        await api.disablePlugin(id);
      } else {
        await api.activatePlugin(id);

        const plugin = plugins.find(p => p.manifest.id === id);
        if (plugin?.manifest.entry) {
          const script = document.createElement('script');
          script.src = plugin.manifest.entry;
          script.async = true;
          document.body.appendChild(script);
        }
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
      const manifestPath = await open({
        filters: [{ name: 'Plugin Manifest', extensions: ['json'] }]
      });
      if (manifestPath) {
        setStatusMsg(`Plugin feature requires correct formatting of plugin manifest.`);
      }
    } catch (e) {
      console.error(e);
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
                    await api.destroyPlugin(plugin.manifest.id);
                    loadPlugins();
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
