import React, { useState } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { type WorkspaceNode } from '../api';
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown } from 'lucide-react';

export const FILE_TREE_START_CREATE_EVENT = 'typist:file-tree:start-create';

type DraftType = 'create-file' | 'create-folder' | 'rename';

interface OperationDraft {
  type: DraftType;
  parentPath: string;
  targetPath?: string;
  targetIsDir?: boolean;
  value: string;
  error: string | null;
}

interface DraftInputRowProps {
  depth: number;
  value: string;
  error: string | null;
  icon: React.ReactNode;
  selectStem: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const DraftInputRow: React.FC<DraftInputRowProps> = ({
  depth,
  value,
  error,
  icon,
  selectStem,
  onChange,
  onSubmit,
  onCancel,
}) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const isSubmittingRef = React.useRef(false);

  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    if (!selectStem) {
      input.select();
      return;
    }

    const lastDotIndex = value.lastIndexOf('.');
    if (lastDotIndex > 0) {
      input.setSelectionRange(0, lastDotIndex);
    } else {
      input.select();
    }
  }, [selectStem, value]);

  return (
    <div className="inline-entry-wrap">
      <div
        className="sidebar-item sidebar-item-inline-entry"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <div style={{ paddingLeft: '18px', display: 'flex', alignItems: 'center' }}>{icon}</div>
        <input
          ref={inputRef}
          value={value}
          className="sidebar-inline-input"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              isSubmittingRef.current = true;
              onSubmit();
              return;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
          onBlur={() => {
            if (isSubmittingRef.current) {
              isSubmittingRef.current = false;
              return;
            }
            onCancel();
          }}
        />
      </div>
      {error && <div className="sidebar-inline-error">{error}</div>}
    </div>
  );
};

interface FileTreeNodeProps {
  node: WorkspaceNode;
  depth: number;
  draft: OperationDraft | null;
  normalizePath: (value: string) => string;
  onNodeContextMenu: (e: React.MouseEvent, node: WorkspaceNode) => void;
  onNodeDragStart: (e: React.DragEvent, node: WorkspaceNode) => void;
  onNodeDragEnd: () => void;
  onNodeDragOverDirectory: (e: React.DragEvent, node: WorkspaceNode) => void;
  onNodeDropDirectory: (e: React.DragEvent, node: WorkspaceNode) => void;
  onDraftChange: (value: string) => void;
  onDraftSubmit: () => void;
  onDraftCancel: () => void;
  isDropTarget: (path: string) => boolean;
  isDragging: (path: string) => boolean;
  isRootPath: (path: string) => boolean;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  node,
  depth,
  draft,
  normalizePath,
  onNodeContextMenu,
  onNodeDragStart,
  onNodeDragEnd,
  onNodeDragOverDirectory,
  onNodeDropDirectory,
  onDraftChange,
  onDraftSubmit,
  onDraftCancel,
  isDropTarget,
  isDragging,
  isRootPath,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const openFile = useStore(state => state.openFile);

  const isRenameDraft =
    !!draft && draft.type === 'rename' && normalizePath(draft.targetPath ?? '') === normalizePath(node.path);
  const isCreateDraftForDirectory =
    !!draft &&
    node.is_dir &&
    draft.type !== 'rename' &&
    normalizePath(draft.parentPath) === normalizePath(node.path);

  React.useEffect(() => {
    if (isCreateDraftForDirectory && node.is_dir) {
      setIsOpen(true);
    }
  }, [isCreateDraftForDirectory, node.is_dir]);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleClick = () => {
    if (isRenameDraft) {
      return;
    }

    if (node.is_dir) {
      setIsOpen(!isOpen);
    } else {
      openFile(node.path);
    }
  };

  return (
    <div>
      {isRenameDraft ? (
        <DraftInputRow
          depth={depth}
          value={draft.value}
          error={draft.error}
          icon={node.is_dir ? <Folder size={14} /> : <FileText size={14} />}
          selectStem={!node.is_dir}
          onChange={onDraftChange}
          onSubmit={onDraftSubmit}
          onCancel={onDraftCancel}
        />
      ) : (
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
          className={`sidebar-item${isDropTarget(node.path) ? ' sidebar-item-drop-target' : ''}${isDragging(node.path) ? ' sidebar-item-dragging' : ''}`}
          title={node.path}
          draggable={!isRootPath(node.path)}
          onDragStart={(e) => onNodeDragStart(e, node)}
          onDragEnd={onNodeDragEnd}
          onDragOver={(e) => {
            if (!node.is_dir) return;
            onNodeDragOverDirectory(e, node);
          }}
          onDrop={(e) => {
            if (!node.is_dir) return;
            onNodeDropDirectory(e, node);
          }}
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
      )}

      {isOpen && isCreateDraftForDirectory && draft && (
        <DraftInputRow
          depth={depth + 1}
          value={draft.value}
          error={draft.error}
          icon={draft.type === 'create-folder' ? <Folder size={14} /> : <FileText size={14} />}
          selectStem={draft.type === 'create-file'}
          onChange={onDraftChange}
          onSubmit={onDraftSubmit}
          onCancel={onDraftCancel}
        />
      )}

      {isOpen && node.is_dir && node.children.map((child) => (
        <FileTreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          draft={draft}
          normalizePath={normalizePath}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDragStart={onNodeDragStart}
          onNodeDragEnd={onNodeDragEnd}
          onNodeDragOverDirectory={onNodeDragOverDirectory}
          onNodeDropDirectory={onNodeDropDirectory}
          onDraftChange={onDraftChange}
          onDraftSubmit={onDraftSubmit}
          onDraftCancel={onDraftCancel}
          isDropTarget={isDropTarget}
          isDragging={isDragging}
          isRootPath={isRootPath}
        />
      ))}
    </div>
  );
};

export const FileTree: React.FC = () => {
  const workspaceTree = useStore(state => state.workspaceTree);
  const workspaceRoot = useStore(state => state.workspaceRoot);
  const tabs = useStore(state => state.tabs);
  const loadWorkspace = useStore(state => state.loadWorkspace);
  const openFile = useStore(state => state.openFile);
  const closeTab = useStore(state => state.closeTab);
  const [menu, setMenu] = useState<{ x: number; y: number; node: WorkspaceNode } | null>(null);
  const [draft, setDraft] = useState<OperationDraft | null>(null);
  const [draggingNode, setDraggingNode] = useState<WorkspaceNode | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const isRootPath = (path: string) => !!workspaceRoot && normalizePath(path) === normalizePath(workspaceRoot);

  const getParentPath = (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    const separatorIndex = normalized.lastIndexOf('/');
    if (separatorIndex <= 0) return normalized;
    return normalized.slice(0, separatorIndex);
  };

  const collectAffectedTabs = (targetPath: string, isDir: boolean) => {
    const normalizedTarget = normalizePath(targetPath);
    return tabs.filter((tab) => {
      const normalizedTabPath = normalizePath(tab.path);
      if (!isDir) {
        return normalizedTabPath === normalizedTarget;
      }
      return normalizedTabPath === normalizedTarget || normalizedTabPath.startsWith(`${normalizedTarget}/`);
    });
  };

  const closeAffectedTabs = async (targetPath: string, isDir: boolean) => {
    const affectedTabs = collectAffectedTabs(targetPath, isDir);
    for (const tab of affectedTabs) {
      await closeTab(tab.tab_id);
    }
    return affectedTabs;
  };

  const hasDirtyTabs = (targetPath: string, isDir: boolean) => {
    const affectedTabs = collectAffectedTabs(targetPath, isDir);
    return affectedTabs.some((tab) => tab.is_dirty);
  };

  const pickDestinationDirectory = async (defaultPath?: string) => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true, defaultPath });
    if (!selected || Array.isArray(selected)) {
      return null;
    }

    return selected as string;
  };

  const startCreateDraft = (parentPath: string, kind: 'file' | 'folder') => {
    setMenu(null);
    setDraft({
      type: kind === 'file' ? 'create-file' : 'create-folder',
      parentPath,
      value: kind === 'file' ? 'new-file.md' : 'new-folder',
      error: null,
    });
  };

  const startRenameDraft = (node: WorkspaceNode) => {
    setMenu(null);
    setDraft({
      type: 'rename',
      parentPath: getParentPath(node.path),
      targetPath: node.path,
      targetIsDir: node.is_dir,
      value: node.name,
      error: null,
    });
  };

  const extractErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return String(error);
  };

  const validateName = (rawValue: string): string | null => {
    const value = rawValue.trim();
    if (!value) return '名称不能为空';
    if (value.includes('/') || value.includes('\\')) {
      return '名称不能包含路径分隔符';
    }
    return null;
  };

  const submitDraft = async () => {
    if (!draft) return;

    const validationMessage = validateName(draft.value);
    if (validationMessage) {
      setDraft({ ...draft, error: validationMessage });
      return;
    }

    try {
      if (draft.type === 'create-file') {
        const createdPath = await api.createWorkspaceFile(draft.parentPath, draft.value.trim());
        setDraft(null);
        await loadWorkspace();
        await openFile(createdPath);
        return;
      }

      if (draft.type === 'create-folder') {
        await api.createWorkspaceFolder(draft.parentPath, draft.value.trim());
        setDraft(null);
        await loadWorkspace();
        return;
      }

      const targetPath = draft.targetPath;
      if (!targetPath) {
        setDraft({ ...draft, error: '缺少重命名目标路径' });
        return;
      }

      const affectedTabs = collectAffectedTabs(targetPath, !!draft.targetIsDir);
      if (affectedTabs.some((tab) => tab.is_dirty)) {
        setDraft({ ...draft, error: '该条目存在未保存标签，请先保存并关闭后再重命名。' });
        return;
      }

      const renamedPath = await api.renameWorkspaceEntry(targetPath, draft.value.trim());
      for (const tab of affectedTabs) {
        await closeTab(tab.tab_id);
      }
      setDraft(null);
      await loadWorkspace();
      if (!draft.targetIsDir && affectedTabs.length > 0) {
        await openFile(renamedPath);
      }
    } catch (error) {
      setDraft({ ...draft, error: extractErrorMessage(error) });
    }
  };

  const moveEntryTo = async (node: WorkspaceNode, destinationParentPath: string) => {
    if (hasDirtyTabs(node.path, node.is_dir)) {
      window.alert('该条目存在未保存的打开标签，请先保存并关闭后再移动。');
      return;
    }

    const sameParent = normalizePath(getParentPath(node.path)) === normalizePath(destinationParentPath);
    if (sameParent) {
      return;
    }

    try {
      const movedPath = await api.moveWorkspaceEntry(node.path, destinationParentPath);
      const affectedTabs = await closeAffectedTabs(node.path, node.is_dir);
      await loadWorkspace();
      if (!node.is_dir && affectedTabs.length > 0) {
        await openFile(movedPath);
      }
    } catch (error) {
      window.alert(`移动失败: ${String(error)}`);
    }
  };

  const copyEntryTo = async (node: WorkspaceNode, destinationParentPath: string) => {
    try {
      await api.copyWorkspaceEntry(node.path, destinationParentPath);
      await loadWorkspace();
    } catch (error) {
      window.alert(`复制失败: ${String(error)}`);
    }
  };

  const deleteEntry = async (node: WorkspaceNode) => {
    const affectedTabs = collectAffectedTabs(node.path, node.is_dir);
    if (affectedTabs.some((tab) => tab.is_dirty)) {
      window.alert('该条目存在未保存的打开标签，请先保存并关闭后再删除。');
      setMenu(null);
      return;
    }

    const confirmed = window.confirm(
      node.is_dir ? `确认删除文件夹 "${node.name}" 及其所有内容吗？` : `确认删除文件 "${node.name}" 吗？`,
    );
    if (!confirmed) {
      setMenu(null);
      return;
    }

    try {
      await api.deleteWorkspaceEntry(node.path);
      for (const tab of affectedTabs) {
        await closeTab(tab.tab_id);
      }
      await loadWorkspace();
    } catch (error) {
      window.alert(`删除失败: ${String(error)}`);
    } finally {
      setMenu(null);
    }
  };

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

  React.useEffect(() => {
    const handleStartCreate = (event: Event) => {
      const customEvent = event as CustomEvent<{ kind: 'file' | 'folder'; parentPath: string }>;
      if (!customEvent.detail?.parentPath) {
        return;
      }
      startCreateDraft(customEvent.detail.parentPath, customEvent.detail.kind);
    };

    window.addEventListener(FILE_TREE_START_CREATE_EVENT, handleStartCreate as EventListener);
    return () => {
      window.removeEventListener(FILE_TREE_START_CREATE_EVENT, handleStartCreate as EventListener);
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
        draft={draft}
        normalizePath={normalizePath}
        onNodeContextMenu={(e, node) => setMenu({ x: e.clientX, y: e.clientY, node })}
        onNodeDragStart={(e, node) => {
          if (isRootPath(node.path)) return;
          setDraggingNode(node);
          setDropTargetPath(null);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', node.path);
        }}
        onNodeDragEnd={() => {
          setDraggingNode(null);
          setDropTargetPath(null);
        }}
        onNodeDragOverDirectory={(e, node) => {
          if (!draggingNode) return;
          if (normalizePath(draggingNode.path) === normalizePath(node.path)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropTargetPath(node.path);
        }}
        onNodeDropDirectory={(e, node) => {
          e.preventDefault();
          e.stopPropagation();
          if (!draggingNode) return;
          if (normalizePath(draggingNode.path) === normalizePath(node.path)) return;

          void (async () => {
            await moveEntryTo(draggingNode, node.path);
            setDraggingNode(null);
            setDropTargetPath(null);
          })();
        }}
        onDraftChange={(value) => {
          setDraft((previous) => (previous ? { ...previous, value, error: null } : previous));
        }}
        onDraftSubmit={() => {
          void submitDraft();
        }}
        onDraftCancel={() => setDraft(null)}
        isDropTarget={(path) => !!dropTargetPath && normalizePath(path) === normalizePath(dropTargetPath)}
        isDragging={(path) => !!draggingNode && normalizePath(path) === normalizePath(draggingNode.path)}
        isRootPath={isRootPath}
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
          {(() => {
            const isRootNode = isRootPath(menu.node.path);
            return !isRootNode ? (
              <>
                <button
                  className="context-menu-item"
                  onClick={async () => {
                    startRenameDraft(menu.node);
                  }}
                >
                  重命名
                </button>
                <button
                  className="context-menu-item"
                  onClick={async () => {
                    const selected = await pickDestinationDirectory(getParentPath(menu.node.path));
                    if (!selected) {
                      setMenu(null);
                      return;
                    }
                    await moveEntryTo(menu.node, selected);
                    setMenu(null);
                  }}
                >
                  移动到...
                </button>
                <button
                  className="context-menu-item"
                  onClick={async () => {
                    const selected = await pickDestinationDirectory(getParentPath(menu.node.path));
                    if (!selected) {
                      setMenu(null);
                      return;
                    }
                    await copyEntryTo(menu.node, selected);
                    setMenu(null);
                  }}
                >
                  复制到...
                </button>
                <button
                  className="context-menu-item"
                  onClick={async () => {
                    await deleteEntry(menu.node);
                  }}
                >
                  删除
                </button>
              </>
            ) : null;
          })()}

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
            <>
              <button
                className="context-menu-item"
                onClick={async () => {
                  startCreateDraft(menu.node.path, 'file');
                }}
              >
                新建文件
              </button>
              <button
                className="context-menu-item"
                onClick={async () => {
                  startCreateDraft(menu.node.path, 'folder');
                }}
              >
                新建文件夹
              </button>
            </>
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
