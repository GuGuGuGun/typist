import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Code,
  FileOutput,
  FileSearch,
  Menu,
  Minus,
  Plug,
  Search,
  Settings2,
  Square,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useStore } from '../store';

const appWindow = getCurrentWindow();

export const Titlebar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const toggleSidebar = useStore(state => state.toggleSidebar);
  const toggleSettings = useStore(state => state.toggleSettings);
  const toggleFindReplace = useStore(state => state.toggleFindReplace);
  const toggleGlobalSearch = useStore(state => state.toggleGlobalSearch);
  const toggleExport = useStore(state => state.toggleExport);
  const togglePlugins = useStore(state => state.togglePlugins);
  const isSourceMode = useStore(state => state.isSourceMode);
  const toggleSourceMode = useStore(state => state.toggleSourceMode);

  useEffect(() => {
    // Check initial state
    appWindow.isMaximized().then(setIsMaximized);

    // Listen for resize events to update icon
    let unlisten: () => void;
    appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    }).then(u => {
      unlisten = u;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const runWindowAction = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      console.error('Window action failed:', error);
    }
  };

  const handleTitlebarMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest('.titlebar-no-drag')) {
      return;
    }

    void runWindowAction(() => appWindow.startDragging());
  };

  return (
    <div
      className="app-titlebar titlebar-drag-region"
      data-tauri-drag-region
      onMouseDown={handleTitlebarMouseDown}
    >
      <div className="titlebar-brand titlebar-drag-region" data-tauri-drag-region>
        <span className="titlebar-app-name">Typist</span>
        <span className="titlebar-app-stage">MVP</span>
      </div>

      <div className="titlebar-commandbar">
        <button className="command-btn titlebar-no-drag" onClick={toggleSidebar} title="切换侧栏 (Ctrl+Shift+O)">
          <Menu size={14} />
          <span>侧栏</span>
        </button>
        <button className="command-btn titlebar-no-drag" onClick={toggleSettings} title="设置">
          <Settings2 size={14} />
          <span>设置</span>
        </button>
        <button className="command-btn titlebar-no-drag" onClick={toggleFindReplace} title="查找替换 (Ctrl+F / Ctrl+H)">
          <FileSearch size={14} />
          <span>查找</span>
        </button>
        <button className="command-btn titlebar-no-drag" onClick={toggleGlobalSearch} title="全局搜索">
          <Search size={14} />
          <span>搜索</span>
        </button>
        <button className="command-btn titlebar-no-drag" onClick={toggleExport} title="导出">
          <FileOutput size={14} />
          <span>导出</span>
        </button>
        <button className="command-btn titlebar-no-drag" onClick={togglePlugins} title="插件管理">
          <Plug size={14} />
          <span>插件</span>
        </button>
        <button
          className={`command-btn titlebar-no-drag ${isSourceMode ? 'active' : ''}`}
          onClick={toggleSourceMode}
          title="切换源码模式 (Ctrl+/)"
        >
          <Code size={14} />
          <span>{isSourceMode ? '所见即所得' : '源码'}</span>
        </button>
      </div>

      <div className="titlebar-actions titlebar-no-drag">
        <button
          className="window-btn titlebar-no-drag"
          onClick={() => void runWindowAction(() => appWindow.minimize())}
        >
          <Minus size={14} />
        </button>
        <button
          className="window-btn titlebar-no-drag"
          onClick={() => void runWindowAction(() => appWindow.toggleMaximize())}
          title={isMaximized ? '还原窗口' : '最大化'}
        >
          <Square size={13} />
        </button>
        <button
          className="window-btn close titlebar-no-drag"
          onClick={() => void runWindowAction(() => appWindow.close())}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
