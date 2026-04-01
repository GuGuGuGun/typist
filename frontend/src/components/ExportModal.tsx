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
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)', width: '380px', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-float)', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Export Document</h2>
          <X size={16} style={{ cursor: 'pointer' }} onClick={toggleOpen} />
        </div>
        
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <div 
              onClick={() => setFormat('pdf')}
              style={{ flex: 1, padding: '16px', border: `1px solid ${format === 'pdf' ? 'var(--accent)' : 'var(--border-color)'}`, borderRadius: 'var(--radius-md)', textAlign: 'center', cursor: 'pointer', background: format === 'pdf' ? 'var(--bg-secondary)' : 'var(--bg-primary)' }}
            >
              <FileWarning size={24} style={{ marginBottom: '8px', color: format === 'pdf' ? 'var(--accent)' : 'var(--text-muted)' }} />
              <div style={{ fontWeight: 600 }}>PDF</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Standard Document</div>
            </div>
            
            <div 
              onClick={() => setFormat('html')}
              style={{ flex: 1, padding: '16px', border: `1px solid ${format === 'html' ? 'var(--accent)' : 'var(--border-color)'}`, borderRadius: 'var(--radius-md)', textAlign: 'center', cursor: 'pointer', background: format === 'html' ? 'var(--bg-secondary)' : 'var(--bg-primary)' }}
            >
              <FileCode2 size={24} style={{ marginBottom: '8px', color: format === 'html' ? 'var(--accent)' : 'var(--text-muted)' }} />
              <div style={{ fontWeight: 600 }}>HTML</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Web Page</div>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: status.startsWith('Error') ? 'red' : 'var(--accent)', minHeight: '16px', textAlign: 'center' }}>
            {status}
          </div>

          <button 
            onClick={handleExport}
            style={{ width: '100%', padding: '10px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
          >
            Export Now
          </button>
        </div>
      </div>
    </div>
  );
};
