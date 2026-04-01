import React, { useState, useEffect } from 'react';
import { api, type UpdateInfo } from '../api';
import { useStore } from '../store';
import { DownloadCloud, Sparkles, X } from 'lucide-react';

export const UpdaterModal: React.FC = () => {
  const settings = useStore(state => state.settings);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (settings?.auto_update_enabled && settings.update_feed_url) {
      checkUpdate(settings.update_feed_url);
    }
  }, [settings?.auto_update_enabled, settings?.update_feed_url]);

  const checkUpdate = async (feedUrl: string) => {
    try {
      // Stub current version since we don't have tauri getVersion injected
      const currentVersion = "0.1.0"; 
      const info = await api.checkUpdate({
        current_version: currentVersion,
        feed_url: feedUrl
      });
      if (info.update_available) {
        setUpdateInfo(info);
        setIsOpen(true);
      }
    } catch (e) {
      console.error('Failed to check for updates', e);
    }
  };

  if (!isOpen || !updateInfo) return null;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)', width: '400px', borderRadius: 'var(--radius-lg)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} /> Update Available!
          </h2>
          <X size={16} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setIsOpen(false)} />
        </div>
        
        <div style={{ padding: '16px', fontSize: '13px', color: 'var(--text-primary)' }}>
          <p>A new version of Typist is available.</p>
          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-md)', margin: '12px 0' }}>
            <strong>Current Version:</strong> {updateInfo.current_version}<br />
            <strong>Latest Version:</strong> {updateInfo.latest_version}
          </div>
          {updateInfo.notes && (
            <div style={{ marginBottom: '12px', color: 'var(--text-secondary)', maxHeight: '100px', overflowY: 'auto' }}>
              <strong>Release Notes:</strong><br/>
              {updateInfo.notes}
            </div>
          )}
        </div>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={() => setIsOpen(false)} style={{ padding: '8px 16px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>
            Later
          </button>
          <button style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DownloadCloud size={16} /> Download
          </button>
        </div>
      </div>
    </div>
  );
};
