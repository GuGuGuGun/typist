import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Code,
  FileOutput,
  FileSearch,
  Menu,
  Minus,
  Search,
  Settings2,
  SquarePlus,
  Square,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { openNewAppWindow } from '../commands/windowActions';
import { getLocaleMessages } from '../i18n';

const appWindow = getCurrentWindow();

export const Titlebar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const toggleSidebar = useStore(state => state.toggleSidebar);
  const openPreferences = useStore(state => state.openPreferences);
  const toggleFindReplace = useStore(state => state.toggleFindReplace);
  const toggleGlobalSearch = useStore(state => state.toggleGlobalSearch);
  const toggleExport = useStore(state => state.toggleExport);
  const isSourceMode = useStore(state => state.isSourceMode);
  const toggleSourceMode = useStore(state => state.toggleSourceMode);
  const language = useStore(state => state.language);
  const text = getLocaleMessages(language).titlebar;

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
        <button className="command-btn titlebar-no-drag" onClick={toggleSidebar} title={text.sidebarTitle}>
          <Menu size={14} />
          <span>{text.sidebar}</span>
        </button>
        <button className="command-btn titlebar-no-drag" onClick={toggleFindReplace} title={text.findTitle}>
          <FileSearch size={14} />
          <span>{text.find}</span>
        </button>
        <button className="command-btn titlebar-no-drag" onClick={toggleGlobalSearch} title={text.searchTitle}>
          <Search size={14} />
          <span>{text.search}</span>
        </button>
        <button className="command-btn titlebar-no-drag" onClick={() => void openNewAppWindow()} title={text.newWindowTitle}>
          <SquarePlus size={14} />
          <span>{text.newWindow}</span>
        </button>
        <button className="command-btn titlebar-no-drag" onClick={toggleExport} title={text.exportTitle}>
          <FileOutput size={14} />
          <span>{text.export}</span>
        </button>
        <button
          className={`command-btn titlebar-no-drag ${isSourceMode ? 'active' : ''}`}
          onClick={toggleSourceMode}
          title={text.sourceTitle}
        >
          <Code size={14} />
          <span>{isSourceMode ? text.wysiwyg : text.source}</span>
        </button>
        <button className="command-btn titlebar-no-drag" onClick={() => openPreferences('settings')} title={text.settingsTitle}>
          <Settings2 size={14} />
          <span>{text.settings}</span>
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
          title={isMaximized ? text.restoreWindow : text.maximizeWindow}
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
