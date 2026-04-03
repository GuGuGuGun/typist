import React, { useCallback, useEffect, useState } from 'react';
import { api, type UpdateInfo } from '../api';
import { useStore } from '../store';
import { DownloadCloud, Sparkles, X } from 'lucide-react';

export const UpdaterModal: React.FC = () => {
  const settings = useStore(state => state.settings);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const checkUpdate = useCallback(async (feedUrl: string) => {
    try {
      // Stub current version since we don't have tauri getVersion injected
      const currentVersion = '0.1.1';
      const info = await api.checkUpdate({
        current_version: currentVersion,
        feed_url: feedUrl,
      });
      if (info.update_available) {
        setUpdateInfo(info);
        setIsOpen(true);
      }
    } catch (e) {
      console.error('Failed to check for updates', e);
    }
  }, []);

  useEffect(() => {
    if (settings?.auto_update_enabled && settings.update_feed_url) {
      const timer = window.setTimeout(() => {
        void checkUpdate(settings.update_feed_url as string);
      }, 0);

      return () => {
        window.clearTimeout(timer);
      };
    }

    return undefined;
  }, [checkUpdate, settings?.auto_update_enabled, settings?.update_feed_url]);

  if (!isOpen || !updateInfo) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-window">
        <div className="modal-header">
          <h2 className="modal-title" style={{ color: 'var(--accent)' }}>
            <Sparkles size={18} /> Update Available!
          </h2>
          <div className="modal-close" onClick={() => setIsOpen(false)}>
            <X size={16} />
          </div>
        </div>
        
        <div className="modal-content">
          <p style={{ margin: 0, fontSize: '14px' }}>A new version of Typist is available.</p>
          <div style={{ 
            background: 'color-mix(in srgb, var(--bg-secondary) 70%, transparent)', 
            padding: '12px 16px', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-color)',
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Current Version:</span>
              <span style={{ fontWeight: 500 }}>{updateInfo.current_version}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Latest Version:</span>
              <span style={{ fontWeight: 500, color: 'var(--accent)' }}>{updateInfo.latest_version}</span>
            </div>
          </div>
          
          {updateInfo.notes && (
            <div style={{ 
              color: 'var(--text-secondary)', 
              maxHeight: '120px', 
              overflowY: 'auto',
              fontSize: '13px',
              padding: '12px',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>Release Notes:</strong>
              {updateInfo.notes}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={() => setIsOpen(false)} className="default-btn">
            Later
          </button>
          <button className="primary-btn">
            <DownloadCloud size={16} /> Download
          </button>
        </div>
      </div>
    </div>
  );
};
