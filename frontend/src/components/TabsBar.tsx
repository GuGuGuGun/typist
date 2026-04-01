import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { X } from 'lucide-react';
import { api } from '../api';
import { runRegisteredPluginCommand } from '../sdk/TypistAPI';

export const TabsBar: React.FC = () => {
  const tabs = useStore(state => state.tabs);
  const activeTabId = useStore(state => state.activeTabId);
  const switchTab = useStore(state => state.switchTab);
  const requestCloseTab = useStore(state => state.requestCloseTab);
  const closeOtherTabs = useStore(state => state.closeOtherTabs);
  const saveFile = useStore(state => state.saveFile);
  const pluginCommands = useStore(state => state.pluginCommands);

  const [menu, setMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

  useEffect(() => {
    const closeMenu = () => setMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="tabs-bar">
      {tabs.map((tab) => (
        <div
          key={tab.tab_id}
          className={`tab ${activeTabId === tab.tab_id ? 'active' : ''}`}
          onClick={() => switchTab(tab.tab_id)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, tabId: tab.tab_id });
          }}
          title={tab.path}
        >
          <span className="tab-title">{tab.title}</span>
          {tab.is_dirty && <span className="tab-dirty">*</span>}
          <div
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              requestCloseTab(tab.tab_id);
            }}
          >
            <X size={12} />
          </div>
        </div>
      ))}

      {menu && (
        <div
          className="context-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="context-menu-item"
            onClick={async () => {
              await saveFile(menu.tabId);
              setMenu(null);
            }}
          >
            保存
          </button>
          <button
            className="context-menu-item"
            onClick={async () => {
              await requestCloseTab(menu.tabId);
              setMenu(null);
            }}
          >
            关闭标签
          </button>
          <button
            className="context-menu-item"
            onClick={async () => {
              await closeOtherTabs(menu.tabId);
              setMenu(null);
            }}
          >
            关闭其他（逐个确认）
          </button>
          {pluginCommands.length > 0 && <div className="context-menu-separator" />}
          {pluginCommands.map((command) => (
            <button
              key={command.id}
              className="context-menu-item"
              onClick={async () => {
                const handled = await runRegisteredPluginCommand(command.id);
                if (!handled) {
                  await api.emitPluginEvent(command.pluginId, 'command', JSON.stringify({ commandId: command.id }));
                }
                setMenu(null);
              }}
            >
              插件: {command.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
