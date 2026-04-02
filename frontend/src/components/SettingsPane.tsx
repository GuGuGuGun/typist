import React from 'react';
import { useStore } from '../store';
import { api, type ThemeMode, type EditorSettings } from '../api';
import { getLocaleMessages, type AppLanguage } from '../i18n';

export const SettingsPane: React.FC = () => {
  const settings = useStore(state => state.settings);
  const loadSettings = useStore(state => state.loadSettings);
  const language = useStore(state => state.language);
  const setLanguage = useStore(state => state.setLanguage);
  const showLineNumbersForNonMd = useStore(state => state.showLineNumbersForNonMd);
  const openNonMdInSourceMode = useStore(state => state.openNonMdInSourceMode);
  const showFloatingTextToolbar = useStore(state => state.showFloatingTextToolbar);
  const setShowLineNumbersForNonMd = useStore(state => state.setShowLineNumbersForNonMd);
  const setOpenNonMdInSourceMode = useStore(state => state.setOpenNonMdInSourceMode);
  const setShowFloatingTextToolbar = useStore(state => state.setShowFloatingTextToolbar);
  const text = getLocaleMessages(language).settings;

  if (!settings) return null;

  const handleUpdate = async (updates: Partial<EditorSettings>) => {
    try {
      await api.updateSettings(updates);
      await loadSettings();
    } catch (e) {
      console.error(e);
    }
  };

  const pickCustomCss = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{ name: 'CSS Theme', extensions: ['css'] }],
      });

      const selectedPath = Array.isArray(selected) ? selected[0] : selected;
      if (!selectedPath) return;
      await handleUpdate({ custom_css_path: selectedPath });
    } catch (error) {
      console.error('Failed to pick custom css:', error);
    }
  };

  const clearCustomCss = async () => {
    await handleUpdate({ custom_css_path: null });
  };

  return (
    <div className="preferences-pane-content">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{text.languageLabel}</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as AppLanguage)}
          className="preferences-input"
        >
          <option value="zh">{text.languageZh}</option>
          <option value="en">{text.languageEn}</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{text.themeLabel}</label>
        <select 
          value={settings.theme} 
          onChange={(e) => handleUpdate({ theme: e.target.value as ThemeMode })}
          className="preferences-input"
        >
          <option value="system">{text.themeSystem}</option>
          <option value="light">{text.themeLight}</option>
          <option value="dark">{text.themeDark}</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{text.customCssLabel}</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="default-btn" onClick={() => void pickCustomCss()}>{text.customCssChoose}</button>
          <button className="default-btn" onClick={() => void clearCustomCss()}>{text.customCssClear}</button>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
          {settings.custom_css_path ? `${text.customCssCurrent}: ${settings.custom_css_path}` : text.customCssEmpty}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}>
          <input 
            type="checkbox" 
            checked={settings.autosave_enabled}
            onChange={(e) => handleUpdate({ autosave_enabled: e.target.checked })}
            style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          {text.autosaveLabel}
        </label>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
          {text.autosaveDesc}
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
          {text.showLineNumbersLabel}
        </label>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
          {text.showLineNumbersDesc}
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
          {text.openNonMdSourceLabel}
        </label>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
          {text.openNonMdSourceDesc}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}>
          <input
            type="checkbox"
            checked={showFloatingTextToolbar}
            onChange={(e) => setShowFloatingTextToolbar(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          {text.floatingToolbarLabel}
        </label>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
          {text.floatingToolbarDesc}
        </p>
      </div>
    </div>
  );
};
