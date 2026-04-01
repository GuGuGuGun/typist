import React, { useEffect } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { AlertTriangle, ClockAlert, Check, X } from 'lucide-react';

export const RecoveryModal: React.FC = () => {
  const drafts = useStore(state => state.recoveryDrafts);
  const loadRecoveryDrafts = useStore(state => state.loadRecoveryDrafts);

  useEffect(() => {
    loadRecoveryDrafts();
  }, [loadRecoveryDrafts]);

  if (drafts.length === 0) return null;

  const handleRestore = async (draftId: string) => {
    try {
      await api.restoreRecoveryDraft(draftId);
      // Backend automatically promotes it to an open tab and returns content
      // We'll trust openFile to sync the current state. But wait, `restore` doesn't call `open_file`.
      // The PRD says restore creates a tab. We can just reload tabs.
      const useStoreRef = useStore.getState();
      await useStoreRef.loadTabs();
      // Also open it if we have a way. The backend `restore_recovery_draft_cmd` returns `RecoveryDraftContent`. 
      // To show it we can just reload tabs and let the backend select it.
      await loadRecoveryDrafts(); // refresh list
    } catch (e) {
      console.error('Failed to restore draft', e);
    }
  };

  const handleDiscard = async (draftId: string) => {
    try {
      await api.deleteRecoveryDraft(draftId);
      await loadRecoveryDrafts();
    } catch (e) {
      console.error('Failed to discard draft', e);
    }
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)', width: '480px', borderRadius: 'var(--radius-lg)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
          <AlertTriangle size={18} />
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Unsaved Drafts Recovered</h2>
        </div>
        
        <div style={{ padding: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Typist recovered unsaved drafts from a previous session due to an unexpected crash or force quit. Do you want to restore them?
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto', borderTop: '1px solid var(--border-color)' }}>
          {drafts.map((draft, idx) => (
            <div key={idx} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {draft.source_path ? draft.source_path.split(/[/\\]/).pop() : 'Untitled Document'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  <ClockAlert size={12} /> {new Date(draft.updated_epoch_ms).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleRestore(draft.draft_id)} style={{ padding: '6px 10px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} color="var(--accent)" /> Restore
                </button>
                <button onClick={() => handleDiscard(draft.draft_id)} style={{ padding: '6px 10px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <X size={14} /> Discard
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
