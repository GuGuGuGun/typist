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
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)', width: '600px', height: '80vh', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-float)', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderSearch size={18} /> Global Workspace Search
          </h2>
          <X size={16} style={{ cursor: 'pointer' }} onClick={toggleOpen} />
        </div>
        
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
          <input 
            style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            placeholder="Search across all files in workspace..." 
            value={query} 
            onChange={e => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button 
            onClick={handleSearch} 
            style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Search size={16} /> Search
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {!workspaceRoot && <div style={{ color: 'var(--text-muted)' }}>Please open a workspace folder first to use global search.</div>}
          {workspaceRoot && hasSearched && matches.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No matches found.</div>}
          
          {matches.map((match, idx) => (
            <div key={idx} onClick={() => { openFile(match.path); toggleOpen(); }} style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} className="sidebar-item">
              <div style={{ fontSize: '12px', color: 'var(--accent)', marginBottom: '4px' }}>
                {match.path.split(/[/\\]/).pop()} <span style={{ color: 'var(--text-muted)' }}>({match.line}:{match.column})</span>
              </div>
              <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                {match.line_text.substring(0, 100)}{match.line_text.length > 100 ? '...' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
