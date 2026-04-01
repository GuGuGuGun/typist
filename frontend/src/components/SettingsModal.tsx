import React from 'react';
import { useStore } from '../store';
import { api, type ThemeMode } from '../api';
import { X } from 'lucide-react';

export const SettingsModal: React.FC = () => {
  const isOpen = useStore(state => state.isSettingsOpen);
  const toggleOpen = useStore(state => state.toggleSettings);
  const toggleKeybinding = useStore(state => state.toggleKeybinding);
  const settings = useStore(state => state.settings);
  const loadSettings = useStore(state => state.loadSettings);

  if (!isOpen || !settings) return null;

  const handleUpdate = async (patch: any) => {
    try {
      await api.updateSettings(patch);
      await loadSettings();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        width: '400px',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-float)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Preferences</h2>
          <X size={16} style={{ cursor: 'pointer' }} onClick={toggleOpen} />
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>Theme</label>
            <select 
              value={settings.theme} 
              onChange={(e) => handleUpdate({ theme: e.target.value as ThemeMode })}
              style={{ padding: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
            >
              <option value="system">System Default</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={settings.autosave_enabled}
                onChange={(e) => handleUpdate({ autosave_enabled: e.target.checked })}
              />
              Enable Autosave
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>配置</label>
            <button
              className="command-btn"
              style={{ justifyContent: 'center' }}
              onClick={toggleKeybinding}
            >
              按键绑定
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
