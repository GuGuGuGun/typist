import React from 'react';
import { useStore } from '../store';
import { api, type ThemeMode, type EditorSettings } from '../api';

export const SettingsPane: React.FC = () => {
  const settings = useStore(state => state.settings);
  const loadSettings = useStore(state => state.loadSettings);
  const showLineNumbersForNonMd = useStore(state => state.showLineNumbersForNonMd);
  const openNonMdInSourceMode = useStore(state => state.openNonMdInSourceMode);
  const setShowLineNumbersForNonMd = useStore(state => state.setShowLineNumbersForNonMd);
  const setOpenNonMdInSourceMode = useStore(state => state.setOpenNonMdInSourceMode);

  if (!settings) return null;

  const handleUpdate = async (updates: Partial<EditorSettings>) => {
    try {
      await api.updateSettings(updates);
      await loadSettings();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="preferences-pane-content">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Theme</label>
        <select 
          value={settings.theme} 
          onChange={(e) => handleUpdate({ theme: e.target.value as ThemeMode })}
          className="preferences-input"
        >
          <option value="system">System Default</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}>
          <input 
            type="checkbox" 
            checked={settings.autosave_enabled}
            onChange={(e) => handleUpdate({ autosave_enabled: e.target.checked })}
            style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          Enable Autosave
        </label>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
          Automatically saves your documents periodically and when closing tabs.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}>
          <input
            type="checkbox"
            checked={showLineNumbersForNonMd}
            onChange={(e) => setShowLineNumbersForNonMd(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          非 Markdown 文档显示行号
        </label>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
          对 txt、json 等源码文档在左侧显示行号和当前行高亮。
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}>
          <input
            type="checkbox"
            checked={openNonMdInSourceMode}
            onChange={(e) => setOpenNonMdInSourceMode(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          非 Markdown 文档默认源码模式
        </label>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
          打开非 md 文件时自动使用源码编辑器，避免进入富文本模式。
        </p>
      </div>
    </div>
  );
};
