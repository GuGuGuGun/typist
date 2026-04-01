import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Clock } from 'lucide-react';
import { FileTree } from './FileTree';

export const Sidebar: React.FC = () => {
  const isSidebarOpen = useStore(state => state.isSidebarOpen);
  const recentFiles = useStore(state => state.recentFiles);
  const loadRecentFiles = useStore(state => state.loadRecentFiles);
  const openFile = useStore(state => state.openFile);
  const loadWorkspace = useStore(state => state.loadWorkspace);

  const [activeTab, setActiveTab] = useState<'explorer' | 'recent'>('explorer');
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const [panelMenu, setPanelMenu] = useState<{ x: number; y: number } | null>(null);
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

  return (
    <div className={`sidebar ${isSidebarOpen ? '' : 'closed'}`}>
      <div className="sidebar-tabs">
        <button 
          onClick={() => setActiveTab('explorer')}
          className={`sidebar-tab-btn ${activeTab === 'explorer' ? 'active' : ''}`}
        >
          Explorer
        </button>
        <button 
          onClick={() => setActiveTab('recent')}
          className={`sidebar-tab-btn ${activeTab === 'recent' ? 'active' : ''}`}
        >
          Recent
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
                No recent files.
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
            打开文件
          </button>
          <button
            className="context-menu-item"
            onClick={async () => {
              await navigator.clipboard.writeText(menu.path);
              setMenu(null);
            }}
          >
            复制路径
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
                filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
              });
              if (selected) {
                await openFile(selected as string);
              }
              setPanelMenu(null);
            }}
          >
            打开文件
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
            打开文件夹
          </button>
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
            刷新当前面板
          </button>
        </div>
      )}
    </div>
  );
};
