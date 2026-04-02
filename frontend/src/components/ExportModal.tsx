import React, { useState } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { X, FileCode2, FileWarning, FileType2, BookOpenText, Presentation } from 'lucide-react';

type ExportFormat = 'pdf' | 'html' | 'docx' | 'latex' | 'epub' | 'reveal_js';

const FORMAT_META: Record<ExportFormat, {
  label: string;
  hint: string;
  extension: string;
  filterName: string;
  icon: React.ReactNode;
}> = {
  pdf: {
    label: 'PDF',
    hint: 'Pandoc PDF',
    extension: 'pdf',
    filterName: 'PDF Document',
    icon: <FileWarning size={24} />,
  },
  html: {
    label: 'HTML',
    hint: 'Web Page',
    extension: 'html',
    filterName: 'HTML Document',
    icon: <FileCode2 size={24} />,
  },
  docx: {
    label: 'DOCX',
    hint: 'Word Document',
    extension: 'docx',
    filterName: 'Word Document',
    icon: <FileType2 size={24} />,
  },
  latex: {
    label: 'LaTeX',
    hint: 'TeX Source',
    extension: 'tex',
    filterName: 'LaTeX Document',
    icon: <FileType2 size={24} />,
  },
  epub: {
    label: 'EPUB',
    hint: 'E-Book',
    extension: 'epub',
    filterName: 'EPUB Book',
    icon: <BookOpenText size={24} />,
  },
  reveal_js: {
    label: 'Reveal.js',
    hint: 'Slides',
    extension: 'html',
    filterName: 'Reveal.js Slides',
    icon: <Presentation size={24} />,
  },
};

export const ExportModal: React.FC = () => {
  const isOpen = useStore(state => state.isExportOpen);
  const toggleOpen = useStore(state => state.toggleExport);
  const activeContent = useStore(state => state.activeContent);
  
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [status, setStatus] = useState<string>('');

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      setStatus('Prompting for save location...');
      const { save } = await import('@tauri-apps/plugin-dialog');
      const selectedMeta = FORMAT_META[format];
      const targetPath = await save({
        filters: [{
          name: selectedMeta.filterName,
          extensions: [selectedMeta.extension]
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
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', width: '100%' }}
            >
              {(Object.keys(FORMAT_META) as ExportFormat[]).map((item) => {
                const selected = format === item;
                const meta = FORMAT_META[item];
                return (
                  <div
                    key={item}
                    onClick={() => setFormat(item)}
                    style={{
                      padding: '14px',
                      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-color)'}`,
                      borderRadius: 'var(--radius-lg)',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: selected ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--bg-secondary)',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <div style={{ margin: '0 auto 8px', display: 'block', color: selected ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {meta.icon}
                    </div>
                    <div style={{ fontWeight: 600, color: selected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{meta.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{meta.hint}</div>
                  </div>
                );
              })}
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
