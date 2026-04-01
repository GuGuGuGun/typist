import React, { useState } from 'react';
import { useStore } from '../store';
import { type WorkspaceNode } from '../api';
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown } from 'lucide-react';

interface FileTreeNodeProps {
  node: WorkspaceNode;
  depth: number;
  onNodeContextMenu: (e: React.MouseEvent, node: WorkspaceNode) => void;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, depth, onNodeContextMenu }) => {
  const [isOpen, setIsOpen] = useState(false);
  const openFile = useStore(state => state.openFile);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleClick = () => {
    if (node.is_dir) {
      setIsOpen(!isOpen);
    } else {
      openFile(node.path);
    }
  };

  return (
    <div>
      <div 
        onClick={handleClick}
        style={{ 
          paddingLeft: `${depth * 16}px`, 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
          paddingTop: '6px',
          paddingBottom: '6px',
          paddingRight: '16px',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: '13px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
        className="sidebar-item"
        title={node.path}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onNodeContextMenu(e, node);
        }}
      >
        {node.is_dir ? (
          <div onClick={toggleOpen} style={{ display: 'flex', alignItems: 'center' }}>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {isOpen ? <FolderOpen size={14} style={{ marginLeft: 4, color: 'var(--accent)' }}/> : <Folder size={14} style={{ marginLeft: 4 }}/>}
          </div>
        ) : (
          <div style={{ paddingLeft: '18px' }}>
            <FileText size={14} />
          </div>
        )}
        <span style={{ marginLeft: '4px' }}>{node.name}</span>
      </div>
      {isOpen && node.is_dir && node.children.map((child, i) => (
        <FileTreeNode key={i} node={child} depth={depth + 1} onNodeContextMenu={onNodeContextMenu} />
      ))}
    </div>
  );
};

export const FileTree: React.FC = () => {
  const workspaceTree = useStore(state => state.workspaceTree);
  const loadWorkspace = useStore(state => state.loadWorkspace);
  const openFile = useStore(state => state.openFile);
  const [menu, setMenu] = useState<{ x: number; y: number; node: WorkspaceNode } | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const closeMenu = () => setMenu(null);
    const closeOnPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
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
  
  if (!workspaceTree) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No folder opened.</span>
        <button 
          onClick={async () => {
            const { open } = await import('@tauri-apps/plugin-dialog');
            const targetPath = await open({ directory: true });
            if (targetPath) {
              await loadWorkspace(targetPath as string);
            }
          }}
          className="primary-btn"
        >
          Open Folder
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      <FileTreeNode
        node={workspaceTree}
        depth={1}
        onNodeContextMenu={(e, node) => setMenu({ x: e.clientX, y: e.clientY, node })}
      />

      {menu && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {!menu.node.is_dir && (
            <button
              className="context-menu-item"
              onClick={async () => {
                await openFile(menu.node.path);
                setMenu(null);
              }}
            >
              打开文件
            </button>
          )}

          {menu.node.is_dir && (
            <button
              className="context-menu-item"
              onClick={async () => {
                await loadWorkspace(menu.node.path);
                setMenu(null);
              }}
            >
              设为工作区根目录
            </button>
          )}

          <button
            className="context-menu-item"
            onClick={async () => {
              await navigator.clipboard.writeText(menu.node.path);
              setMenu(null);
            }}
          >
            复制路径
          </button>
        </div>
      )}
    </div>
  );
};
