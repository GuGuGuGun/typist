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
    <div className="overlay-modal">
      <div className="dialog-card">
        <h3 className="dialog-title">关闭前保存更改？</h3>
        <p className="dialog-desc">
          {tab?.title ?? '当前文件'} 包含未保存修改。请选择一个操作。
        </p>
        <div className="dialog-actions">
            <button className="default-btn" onClick={cancelCloseDirtyTab}>取消</button>
            <button className="danger-btn" onClick={() => void closeDirtyTabWithoutSave()}>不保存</button>
            <button className="primary-btn active" onClick={() => void closeDirtyTabWithSave()}>保存并关闭</button>
        </div>
      </div>
    </div>
  );
};
