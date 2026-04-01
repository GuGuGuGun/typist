import React, { useState } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { X, FileCode2, FileWarning } from 'lucide-react';

export const ExportModal: React.FC = () => {
  const isOpen = useStore(state => state.isExportOpen);
  const toggleOpen = useStore(state => state.toggleExport);
  const activeContent = useStore(state => state.activeContent);
  
  const [format, setFormat] = useState<'html' | 'pdf'>('pdf');
  const [status, setStatus] = useState<string>('');

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      setStatus('Prompting for save location...');
      const { save } = await import('@tauri-apps/plugin-dialog');
      const targetPath = await save({
        filters: [{
          name: format === 'pdf' ? 'PDF Document' : 'HTML Document',
          extensions: [format]
        }]
      });

      if (!targetPath) {
        setStatus('');
        return;
      }

      setStatus('Exporting...');
      const res = await api.exportDocument({
        markdown: activeContent,
        target_path: targetPath,
        format: format,
        title: 'Exported Document'
      });
      
      setStatus(`Exported successfully to ${res.target_path.split(/[/\\]/).pop()}!`);
      setTimeout(() => {
        setStatus('');
        toggleOpen();
      }, 3000);
    } catch (e) {
      console.error(e);
      setStatus(`Error: ${e}`);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-window">
        <div className="modal-header">
          <h2 className="modal-title">Export Document</h2>
          <div className="modal-close" onClick={toggleOpen}>
            <X size={16} />
          </div>
        </div>
        
        <div className="modal-content">
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <div 
              onClick={() => setFormat('pdf')}
              style={{ flex: 1, padding: '16px', border: `1px solid ${format === 'pdf' ? 'var(--accent)' : 'var(--border-color)'}`, borderRadius: 'var(--radius-lg)', textAlign: 'center', cursor: 'pointer', background: format === 'pdf' ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--bg-secondary)', transition: 'all var(--transition-fast)' }}
            >
              <FileWarning size={24} style={{ margin: '0 auto 8px', display: 'block', color: format === 'pdf' ? 'var(--accent)' : 'var(--text-muted)' }} />
              <div style={{ fontWeight: 600, color: format === 'pdf' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>PDF</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Standard Document</div>
            </div>
            
            <div 
              onClick={() => setFormat('html')}
              style={{ flex: 1, padding: '16px', border: `1px solid ${format === 'html' ? 'var(--accent)' : 'var(--border-color)'}`, borderRadius: 'var(--radius-lg)', textAlign: 'center', cursor: 'pointer', background: format === 'html' ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--bg-secondary)', transition: 'all var(--transition-fast)' }}
            >
              <FileCode2 size={24} style={{ margin: '0 auto 8px', display: 'block', color: format === 'html' ? 'var(--accent)' : 'var(--text-muted)' }} />
              <div style={{ fontWeight: 600, color: format === 'html' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>HTML</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Web Page</div>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: status.startsWith('Error') ? 'red' : 'var(--accent)', minHeight: '16px', textAlign: 'center', marginTop: '8px' }}>
            {status}
          </div>
        </div>

        <div className="modal-footer">
          <button className="default-btn" onClick={toggleOpen}>Cancel</button>
          <button className="primary-btn" onClick={handleExport}>
            Export Now
          </button>
        </div>
      </div>
    </div>
  );
};
