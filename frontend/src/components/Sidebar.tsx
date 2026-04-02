import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { api } from '../api';
import { Clock } from 'lucide-react';
import { FILE_TREE_START_CREATE_EVENT, FileTree } from './FileTree';
import { getLocaleMessages, pickRandomStartupCopy } from '../i18n';

export const Sidebar: React.FC = () => {
  const {
    isSidebarOpen,
    recentFiles,
    tabs,
    loadRecentFiles,
    openFile,
    closeTab,
    loadWorkspace,
    workspaceRoot,
    language,
  } = useStore(useShallow((state) => ({
    isSidebarOpen: state.isSidebarOpen,
    recentFiles: state.recentFiles,
    tabs: state.tabs,
    loadRecentFiles: state.loadRecentFiles,
    openFile: state.openFile,
    closeTab: state.closeTab,
    loadWorkspace: state.loadWorkspace,
    workspaceRoot: state.workspaceRoot,
    language: state.language,
  })));

  const [activeTab, setActiveTab] = useState<'explorer' | 'recent'>('explorer');
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const [panelMenu, setPanelMenu] = useState<{ x: number; y: number } | null>(null);
  const locale = getLocaleMessages(language);
  const startupText = React.useMemo(() => pickRandomStartupCopy(language), [language]);
  const startupCopy = locale.startup;
  const sidebarText = locale.sidebar;
  const itemMenuRef = React.useRef<HTMLDivElement | null>(null);
  const panelMenuRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isSidebarOpen) {
      loadRecentFiles();
      loadWorkspace();
    }
  }, [isSidebarOpen, loadRecentFiles, loadWorkspace]);

  useEffect(() => {
    const closeMenu = () => {
      setMenu(null);
      setPanelMenu(null);
    };

    const closeOnPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (itemMenuRef.current?.contains(target)) return;
      if (panelMenuRef.current?.contains(target)) return;
      closeMenu();
    };

    const closeOnEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    window.addEventListener('mousedown', closeOnPointerDown, true);
    window.addEventListener('keydown', closeOnEsc, true);
    return () => {
      window.removeEventListener('mousedown', closeOnPointerDown, true);
      window.removeEventListener('keydown', closeOnEsc, true);
    };
  }, []);

  const createEntryInRoot = async (kind: 'file' | 'folder') => {
    if (!workspaceRoot) {
      window.alert(sidebarText.alertOpenWorkspaceFirst);
      setPanelMenu(null);
      return;
    }

    window.dispatchEvent(
      new CustomEvent(FILE_TREE_START_CREATE_EVENT, {
        detail: {
          kind,
          parentPath: workspaceRoot,
        },
      }),
    );
    setPanelMenu(null);
  };

  const normalizePath = (value: string) => value.replace(/\\/g, '/').toLowerCase();
  const getParentPath = (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    const separatorIndex = normalized.lastIndexOf('/');
    if (separatorIndex <= 0) return normalized;
    return normalized.slice(0, separatorIndex);
  };

  const pickDestinationDirectory = async (defaultPath?: string) => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true, defaultPath });
    if (!selected || Array.isArray(selected)) {
      return null;
    }

    return selected as string;
  };

  const renameRecentFile = async (path: string) => {
    const fileName = path.split(/[/\\]/).pop() ?? 'untitled.md';
    const nextName = window.prompt(sidebarText.promptRename, fileName)?.trim();
    if (!nextName) {
      setMenu(null);
      return;
    }

    const affectedTabs = tabs.filter((tab) => normalizePath(tab.path) === normalizePath(path));
    if (affectedTabs.some((tab) => tab.is_dirty)) {
      window.alert(sidebarText.dirtyBeforeRename);
      setMenu(null);
      return;
    }

    try {
      const renamedPath = await api.renameWorkspaceEntry(path, nextName);
      for (const tab of affectedTabs) {
        await closeTab(tab.tab_id);
      }
      await loadWorkspace();
      await loadRecentFiles();
      if (affectedTabs.length > 0) {
        await openFile(renamedPath);
      }
    } catch (error) {
      window.alert(`${sidebarText.renameFailedPrefix}: ${String(error)}`);
    } finally {
      setMenu(null);
    }
  };

  const deleteRecentFile = async (path: string) => {
    const affectedTabs = tabs.filter((tab) => normalizePath(tab.path) === normalizePath(path));
    if (affectedTabs.some((tab) => tab.is_dirty)) {
      window.alert(sidebarText.dirtyBeforeDelete);
      setMenu(null);
      return;
    }

    const confirmed = window.confirm(sidebarText.confirmDelete);
    if (!confirmed) {
      setMenu(null);
      return;
    }

    try {
      await api.deleteWorkspaceEntry(path);
      for (const tab of affectedTabs) {
        await closeTab(tab.tab_id);
      }
      await loadWorkspace();
      await loadRecentFiles();
    } catch (error) {
      window.alert(`${sidebarText.deleteFailedPrefix}: ${String(error)}`);
    } finally {
      setMenu(null);
    }
  };

  const moveRecentFile = async (path: string) => {
    const affectedTabs = tabs.filter((tab) => normalizePath(tab.path) === normalizePath(path));
    if (affectedTabs.some((tab) => tab.is_dirty)) {
      window.alert(sidebarText.dirtyBeforeMove);
      setMenu(null);
      return;
    }

    const selected = await pickDestinationDirectory(getParentPath(path));
    if (!selected) {
      setMenu(null);
      return;
    }

    if (normalizePath(selected) === normalizePath(getParentPath(path))) {
      setMenu(null);
      return;
    }

    try {
      const movedPath = await api.moveWorkspaceEntry(path, selected);
      for (const tab of affectedTabs) {
        await closeTab(tab.tab_id);
      }
      await loadWorkspace();
      await loadRecentFiles();
      if (affectedTabs.length > 0) {
        await openFile(movedPath);
      }
    } catch (error) {
      window.alert(`${sidebarText.moveFailedPrefix}: ${String(error)}`);
    } finally {
      setMenu(null);
    }
  };

  const copyRecentFile = async (path: string) => {
    const selected = await pickDestinationDirectory(getParentPath(path));
    if (!selected) {
      setMenu(null);
      return;
    }

    try {
      await api.copyWorkspaceEntry(path, selected);
      await loadWorkspace();
      await loadRecentFiles();
    } catch (error) {
      window.alert(`${sidebarText.copyFailedPrefix}: ${String(error)}`);
    } finally {
      setMenu(null);
    }
  };

  return (
    <div className={`sidebar ${isSidebarOpen ? '' : 'closed'}`}>
      <div className="sidebar-tabs">
        <button 
          onClick={() => setActiveTab('explorer')}
          className={`sidebar-tab-btn ${activeTab === 'explorer' ? 'active' : ''}`}
        >
          {startupCopy.explorerTab}
        </button>
        <button 
          onClick={() => setActiveTab('recent')}
          className={`sidebar-tab-btn ${activeTab === 'recent' ? 'active' : ''}`}
        >
          {startupCopy.recentTab}
        </button>
      </div>

      <div
        className="sidebar-content"
        onContextMenu={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.sidebar-item')) return;

          e.preventDefault();
          setMenu(null);
          setPanelMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {activeTab === 'explorer' && <FileTree />}
        {activeTab === 'recent' && (
          <div>
            {recentFiles.map((item, idx) => {
              const fileName = item.path.split(/[/\\]/).pop();
              return (
                <div
                  key={idx}
                  className="sidebar-item"
                  title={item.path}
                  onClick={() => openFile(item.path)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPanelMenu(null);
                    setMenu({ x: e.clientX, y: e.clientY, path: item.path });
                  }}
                >
                  <Clock size={14} className="sidebar-item-icon" />
                  {fileName}
                </div>
              );
            })}
            {recentFiles.length === 0 && (
              <div className="sidebar-empty">
                <div>{startupCopy.recentEmpty}</div>
                <div className="sidebar-empty-note">{startupText}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {menu && (
        <div
          ref={itemMenuRef}
          className="context-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button
            className="context-menu-item"
            onClick={async () => {
              await openFile(menu.path);
              setMenu(null);
            }}
          >
            {sidebarText.openFile}
          </button>
          <button
            className="context-menu-item"
            onClick={async () => {
              await renameRecentFile(menu.path);
            }}
          >
            {sidebarText.rename}
          </button>
          <button
            className="context-menu-item"
            onClick={async () => {
              await moveRecentFile(menu.path);
            }}
          >
            {sidebarText.moveTo}
          </button>
          <button
            className="context-menu-item"
            onClick={async () => {
              await copyRecentFile(menu.path);
            }}
          >
            {sidebarText.copyTo}
          </button>
          <button
            className="context-menu-item"
            onClick={async () => {
              await deleteRecentFile(menu.path);
            }}
          >
            {sidebarText.delete}
          </button>
          <button
            className="context-menu-item"
            onClick={async () => {
              await navigator.clipboard.writeText(menu.path);
              setMenu(null);
            }}
          >
            {sidebarText.copyPath}
          </button>
        </div>
      )}

      {panelMenu && (
        <div
          ref={panelMenuRef}
          className="context-menu"
          style={{ left: panelMenu.x, top: panelMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button
            className="context-menu-item"
            onClick={async () => {
              const { open } = await import('@tauri-apps/plugin-dialog');
              const selected = await open({
                multiple: false,
                filters: [{ name: sidebarText.markdownFilterName, extensions: ['md', 'markdown', 'txt'] }],
              });
              if (selected) {
                await openFile(selected as string);
              }
              setPanelMenu(null);
            }}
          >
            {sidebarText.openFile}
          </button>
          <button
            className="context-menu-item"
            onClick={async () => {
              const { open } = await import('@tauri-apps/plugin-dialog');
              const targetPath = await open({ directory: true });
              if (targetPath) {
                await loadWorkspace(targetPath as string);
              }
              setPanelMenu(null);
            }}
          >
            {sidebarText.openFolder}
          </button>
          {activeTab === 'explorer' && (
            <button
              className="context-menu-item"
              onClick={async () => {
                await createEntryInRoot('file');
              }}
            >
              {sidebarText.newFile}
            </button>
          )}
          {activeTab === 'explorer' && (
            <button
              className="context-menu-item"
              onClick={async () => {
                await createEntryInRoot('folder');
              }}
            >
              {sidebarText.newFolder}
            </button>
          )}
          <button
            className="context-menu-item"
            onClick={async () => {
              if (activeTab === 'recent') {
                await loadRecentFiles();
              } else {
                await loadWorkspace();
              }
              setPanelMenu(null);
            }}
          >
            {sidebarText.refreshPanel}
          </button>
        </div>
      )}
    </div>
  );
};
