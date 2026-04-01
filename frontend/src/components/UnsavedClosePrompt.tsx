import React from 'react';
import { useStore } from '../store';

export const UnsavedClosePrompt: React.FC = () => {
  const dirtyCloseTabId = useStore(state => state.dirtyCloseTabId);
  const tabs = useStore(state => state.tabs);
  const cancelCloseDirtyTab = useStore(state => state.cancelCloseDirtyTab);
  const closeDirtyTabWithoutSave = useStore(state => state.closeDirtyTabWithoutSave);
  const closeDirtyTabWithSave = useStore(state => state.closeDirtyTabWithSave);

  if (!dirtyCloseTabId) return null;

  const tab = tabs.find(item => item.tab_id === dirtyCloseTabId);

  return (
    <div className="modal-overlay">
      <div className="modal-window" style={{ width: '400px' }}>
        <div className="modal-header">
          <h3 className="modal-title">关闭前保存更改？</h3>
        </div>
        <div className="modal-content">
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
            {tab?.title ?? '当前文件'} 包含未保存修改。请选择一个操作。
          </p>
        </div>
        <div className="modal-footer">
            <button className="default-btn" onClick={cancelCloseDirtyTab}>取消</button>
            <button className="danger-btn" onClick={() => void closeDirtyTabWithoutSave()}>不保存</button>
            <button className="primary-btn active" onClick={() => void closeDirtyTabWithSave()}>保存并关闭</button>
        </div>
      </div>
    </div>
  );
};
