import React, { useState } from 'react';
import { useStore } from '../store';
import { api, type GlobalSearchMatch } from '../api';
import { Search, X, FolderSearch } from 'lucide-react';

export const GlobalSearchPanel: React.FC = () => {
  const isOpen = useStore(state => state.isGlobalSearchOpen);
  const toggleOpen = useStore(state => state.toggleGlobalSearch);
  const workspaceRoot = useStore(state => state.workspaceRoot);
  const openFile = useStore(state => state.openFile);

  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<GlobalSearchMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!workspaceRoot || !query) return;
    try {
      const res = await api.globalSearch({
        workspace_path: workspaceRoot,
        query,
        is_regex: false,
        case_sensitive: false
      });
      setMatches(res.matches);
      setHasSearched(true);
    } catch (e) {
      console.error('Global search error', e);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-window large" style={{ height: '75vh' }}>
        <div className="modal-header">
          <h2 className="modal-title">
            <FolderSearch size={18} /> Global Workspace Search
          </h2>
          <div className="modal-close" onClick={toggleOpen}>
            <X size={16} />
          </div>
        </div>
        
        <div style={{ padding: '16px 20px', borderBottom: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)', display: 'flex', gap: '8px', background: 'color-mix(in srgb, var(--bg-secondary) 30%, transparent)' }}>
          <input 
            style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
            placeholder="Search across all files in workspace..." 
            value={query} 
            onChange={e => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="primary-btn">
            <Search size={16} /> Search
          </button>
        </div>

        <div className="modal-content" style={{ padding: '0', gap: 0 }}>
          {!workspaceRoot && <div style={{ color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>Please open a workspace folder first to use global search.</div>}
          {workspaceRoot && hasSearched && matches.length === 0 && <div style={{ color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>No matches found.</div>}
          
          {matches.map((match, idx) => (
            <div 
              key={idx} 
              onClick={() => { openFile(match.path); toggleOpen(); }} 
              style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)', transition: 'background-color var(--transition-fast)' }} 
              className="sidebar-item"
            >
              <div style={{ fontSize: '13px', color: 'var(--accent)', marginBottom: '6px', fontWeight: 500 }}>
                {match.path.split(/[/\\]/).pop()} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({match.line}:{match.column})</span>
              </div>
              <div style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>
                {match.line_text.substring(0, 150)}{match.line_text.length > 150 ? '...' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
