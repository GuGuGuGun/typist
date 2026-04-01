import React from 'react';
import { useStore } from '../store';
import { X, Settings2, Command, Plug } from 'lucide-react';
import { SettingsPane } from './SettingsPane';
import { KeybindingPane } from './KeybindingPane';
import { PluginsPane } from './PluginsPane';

export const PreferencesModal: React.FC = () => {
  const isOpen = useStore(state => state.isPreferencesOpen);
  const activeTab = useStore(state => state.preferencesActiveTab);
  const openPreferences = useStore(state => state.openPreferences);
  const closePreferences = useStore(state => state.closePreferences);

  if (!isOpen) return null;

  return (
    <div className="preferences-overlay" onClick={closePreferences}>
      <div className="preferences-window" onClick={e => e.stopPropagation()}>
        <div className="preferences-sidebar">
          <div style={{ padding: '24px 16px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Preferences
          </div>
          <div className="preferences-nav">
            <button 
              className={`preferences-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => openPreferences('settings')}
            >
              <Settings2 size={16} /> General
            </button>
            <button 
              className={`preferences-nav-item ${activeTab === 'keybindings' ? 'active' : ''}`}
              onClick={() => openPreferences('keybindings')}
            >
              <Command size={16} /> Keybindings
            </button>
            <button 
              className={`preferences-nav-item ${activeTab === 'plugins' ? 'active' : ''}`}
              onClick={() => openPreferences('plugins')}
            >
              <Plug size={16} /> Plugins
            </button>
          </div>
        </div>

        <div className="preferences-content-area">
          <div className="preferences-header">
            <h2 className="preferences-title">
              {activeTab === 'settings' && 'General Settings'}
              {activeTab === 'keybindings' && 'Keyboard Shortcuts'}
              {activeTab === 'plugins' && 'Plugin Marketplace'}
            </h2>
            <div className="preferences-close" onClick={closePreferences}>
              <X size={16} />
            </div>
          </div>
          
          <div className="preferences-scroll-area">
            {activeTab === 'settings' && <SettingsPane />}
            {activeTab === 'keybindings' && <KeybindingPane />}
            {activeTab === 'plugins' && <PluginsPane />}
          </div>
        </div>
      </div>
    </div>
  );
};
