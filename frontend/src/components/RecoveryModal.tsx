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
      const recovered = await api.restoreRecoveryDraft(draftId);
      const storeRef = useStore.getState();

      let targetTabId: string | null | undefined = storeRef.activeTabId;
      if (recovered.metadata.source_path) {
        targetTabId = await storeRef.openFile(recovered.metadata.source_path);
      }

      if (!targetTabId) {
        await storeRef.loadTabs();
        targetTabId = useStore.getState().activeTabId;
      }

      if (targetTabId) {
        useStore.getState().setActiveContent(recovered.content);
        await useStore.getState().markTabDirty(targetTabId, true);
      }

      await api.deleteRecoveryDraft(draftId);
      await loadRecoveryDrafts();
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
    <div className="modal-overlay">
      <div className="modal-window">
        <div className="modal-header">
          <h2 className="modal-title" style={{ color: 'var(--accent)' }}>
            <AlertTriangle size={18} />
            Unsaved Drafts Recovered
          </h2>
        </div>
        
        <div className="modal-content">
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Typist recovered unsaved drafts from a previous session due to an unexpected crash or force quit. Do you want to restore them?
          </p>

          <div style={{
            maxHeight: '260px',
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {drafts.map((draft, idx) => (
              <div key={idx} style={{ padding: '12px 16px', borderBottom: idx !== drafts.length - 1 ? '1px solid var(--border-color)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {draft.source_path ? draft.source_path.split(/[/\\]/).pop() : 'Untitled Document'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <ClockAlert size={12} /> {new Date(draft.updated_epoch_ms).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleRestore(draft.draft_id)} className="primary-btn">
                    <Check size={14} /> Restore
                  </button>
                  <button onClick={() => handleDiscard(draft.draft_id)} className="default-btn">
                    <X size={14} /> Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
