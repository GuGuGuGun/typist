import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { defaultValueCtx, Editor, rootCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { clipboard } from '@milkdown/plugin-clipboard';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { prism } from '@milkdown/plugin-prism';
import { math } from '@milkdown/plugin-math';
import { diagram } from '@milkdown/plugin-diagram';
import React, { useEffect } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { runRegisteredPluginCommand } from '../sdk/TypistAPI';

// Styles for plugins
import 'prismjs/themes/prism-tomorrow.css';
import 'katex/dist/katex.min.css';

const EditorContent: React.FC = () => {
  const activeTabId = useStore(state => state.activeTabId);
  const activeTab = useStore(state => state.tabs.find(t => t.tab_id === activeTabId));
  const activeContent = useStore(state => state.activeContent);
  const markTabDirty = useStore(state => state.markTabDirty);
  const setActiveContent = useStore(state => state.setActiveContent);
  
  // Ref to track if we're programmatically updating to avoid self-triggering listener
  const isInternalUpdate = React.useRef(false);

  useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, activeContent || '');
        ctx.get(listenerCtx)
          .markdownUpdated((_ctx, markdown, prevMarkdown) => {
            if (isInternalUpdate.current) return;
            setActiveContent(markdown);
            if (activeTabId && markdown !== prevMarkdown && !activeTab?.is_dirty) {
              markTabDirty(activeTabId, true);
            }
          });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(listener)
      .use(prism)
      .use(math)
      .use(diagram);
  }, [activeTabId, activeTab?.is_dirty]);

  if (!activeTabId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Press Ctrl+O to open a file or use the Sidebar.
      </div>
    );
  }

  // To properly reset milkdown content across tabs, we could key the provider to activeTabId
  // which forces a remount and cleanly parses `activeContent` as initial.
  // We'll manage that at the Wrapper level.

  return <Milkdown />;
};

const SourceEditor: React.FC = () => {
  const activeTabId = useStore(state => state.activeTabId);
  const activeTab = useStore(state => state.tabs.find(t => t.tab_id === activeTabId));
  const activeContent = useStore(state => state.activeContent);
  const setActiveContent = useStore(state => state.setActiveContent);
  const markTabDirty = useStore(state => state.markTabDirty);

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const cursorByTabRef = React.useRef<Record<string, number>>({});

  useEffect(() => {
    if (!activeTabId || !textareaRef.current) return;

    const cursor = cursorByTabRef.current[activeTabId] ?? 0;
    const nextCursor = Math.min(cursor, activeContent.length);

    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }, [activeTabId]);

  const cacheCursor = (cursor: number) => {
    if (!activeTabId) return;
    cursorByTabRef.current[activeTabId] = cursor;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    setActiveContent(content);
    cacheCursor(e.target.selectionStart);

    if (activeTabId && !activeTab?.is_dirty) {
      void markTabDirty(activeTabId, true);
    }
  };

  if (!activeTabId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Press Ctrl+O to open a file or use the Sidebar.
      </div>
    );
  }

  return (
    <div className="source-editor">
      <textarea
        ref={textareaRef}
        className="source-textarea"
        value={activeContent}
        spellCheck={false}
        onChange={handleChange}
        onClick={(e) => cacheCursor(e.currentTarget.selectionStart)}
        onKeyUp={(e) => cacheCursor(e.currentTarget.selectionStart)}
        onSelect={(e) => cacheCursor(e.currentTarget.selectionStart)}
      />
    </div>
  );
};

export const EditorWrapper: React.FC = () => {
  const activeTabId = useStore(state => state.activeTabId);
  const settings = useStore(state => state.settings);
  const isSourceMode = useStore(state => state.isSourceMode);
  const toggleSourceMode = useStore(state => state.toggleSourceMode);
  const pluginCommands = useStore(state => state.pluginCommands);
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const focusActiveEditor = () => {
    if (isSourceMode) {
      const textarea = document.querySelector('.source-textarea') as HTMLTextAreaElement | null;
      textarea?.focus();
      return;
    }

    const proseMirror = document.querySelector('.milkdown .ProseMirror') as HTMLElement | null;
    proseMirror?.focus();
  };

  useEffect(() => {
    if (!menu) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;

      setMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control' || event.key === 'Shift' || event.key === 'Alt' || event.key === 'Meta') return;
      if (!['Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;

      setMenu(null);
      requestAnimationFrame(() => focusActiveEditor());
    };

    window.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [menu, isSourceMode]);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const rawTarget = event.target as Node | null;
      const target =
        rawTarget instanceof Element
          ? rawTarget
          : rawTarget?.parentElement ?? null;

      if (!target) return;
      if (!activeTabId) return;

      if (target.closest('.context-menu')) {
        return;
      }

      if (!target.closest('.editor-area')) {
        return;
      }

      event.preventDefault();
      setMenu({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener('contextmenu', handleContextMenu, true);
    return () => window.removeEventListener('contextmenu', handleContextMenu, true);
  }, [activeTabId]);

  const runMenuAction = async (action: () => unknown | Promise<unknown>) => {
    await action();
    setMenu(null);
    requestAnimationFrame(() => focusActiveEditor());
  };

  // Focus & Typewriter toggles
  const focusClass = settings?.focus_mode_enabled ? 'focus-mode-active' : '';
  const typewriterClass = settings?.typewriter_mode_enabled ? 'typewriter-mode-active' : '';

  // By keying MilkdownProvider with the activeTabId and optionally Content, 
  // we ensure it parses the initial value fresh when switching tabs.
  return (
    <div className={`editor-area ${focusClass} ${typewriterClass}`}>
      {isSourceMode ? (
        <SourceEditor />
      ) : (
        <MilkdownProvider key={`${activeTabId || 'empty'}-${isSourceMode ? 'source' : 'wys'}`}>
          <EditorContent />
        </MilkdownProvider>
      )}

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
          <button className="context-menu-item" onClick={() => void runMenuAction(() => document.execCommand('undo'))}>撤回</button>
          <button className="context-menu-item" onClick={() => void runMenuAction(() => document.execCommand('redo'))}>重做</button>
          <button className="context-menu-item" onClick={() => void runMenuAction(() => document.execCommand('cut'))}>剪切</button>
          <button className="context-menu-item" onClick={() => void runMenuAction(() => document.execCommand('copy'))}>复制</button>
          <button className="context-menu-item" onClick={() => void runMenuAction(() => document.execCommand('paste'))}>粘贴</button>
          <button className="context-menu-item" onClick={() => void runMenuAction(() => document.execCommand('selectAll'))}>全选</button>
          <button className="context-menu-item" onClick={() => void runMenuAction(() => toggleSourceMode())}>切换源码模式</button>
          {pluginCommands.length > 0 && <div className="context-menu-separator" />}
          {pluginCommands.map((command) => (
            <button
              key={command.id}
              className="context-menu-item"
              onClick={() => void runMenuAction(async () => {
                const handled = await runRegisteredPluginCommand(command.id);
                if (!handled) {
                  await api.emitPluginEvent(command.pluginId, 'command', JSON.stringify({ commandId: command.id }));
                }
              })}
            >
              插件: {command.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
