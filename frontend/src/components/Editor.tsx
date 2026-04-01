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
import { getLocaleMessages, pickRandomStartupCopy } from '../i18n';

// Styles for plugins
import 'prismjs/themes/prism-tomorrow.css';
import 'katex/dist/katex.min.css';

const isMarkdownFile = (filePath?: string) => {
  if (!filePath) return false;
  const lower = filePath.toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.markdown');
};

const getLineByCursor = (content: string, cursor: number) => {
  const safeCursor = Math.max(0, Math.min(cursor, content.length));
  return content.slice(0, safeCursor).split(/\r?\n/).length;
};

const EmptyEditorState: React.FC = () => {
  const language = useStore(state => state.language);
  const openFile = useStore(state => state.openFile);
  const loadWorkspace = useStore(state => state.loadWorkspace);
  const startup = getLocaleMessages(language).startup;
  const randomCopy = React.useMemo(() => pickRandomStartupCopy(language), [language]);

  const openFileFromDialog = async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });

    if (!selected || Array.isArray(selected)) {
      return;
    }

    await openFile(selected);
  };

  const openFolderFromDialog = async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true });
    if (!selected || Array.isArray(selected)) {
      return;
    }

    await loadWorkspace(selected);
  };

  return (
    <div className="editor-empty-state">
      <p className="editor-empty-title">{startup.editorEmptyTitle}</p>
      <p className="editor-empty-copy">{randomCopy}</p>
      <div className="editor-empty-actions" role="group" aria-label={startup.openMethodsTitle}>
        <span className="editor-empty-actions-label">{startup.openMethodsTitle}</span>
        <button className="editor-empty-link" onClick={() => void openFileFromDialog()}>
          {startup.openFileLink}
        </button>
        <span className="editor-empty-dot">•</span>
        <button className="editor-empty-link" onClick={() => void openFolderFromDialog()}>
          {startup.openFolderLink}
        </button>
      </div>
      <p className="editor-empty-hint">{startup.editorEmptyHint}</p>
    </div>
  );
};

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
    return <EmptyEditorState />;
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
  const showLineNumbersForNonMd = useStore(state => state.showLineNumbersForNonMd);
  const showLineNumbers = Boolean(showLineNumbersForNonMd && activeTab?.path && !isMarkdownFile(activeTab.path));

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const cursorByTabRef = React.useRef<Record<string, number>>({});
  const [activeLine, setActiveLine] = React.useState(1);
  const [scrollTop, setScrollTop] = React.useState(0);
  const lineCount = React.useMemo(() => Math.max(1, activeContent.split(/\r?\n/).length), [activeContent]);
  const lineNumbers = React.useMemo(() => Array.from({ length: lineCount }, (_, idx) => idx + 1), [lineCount]);

  useEffect(() => {
    if (!activeTabId || !textareaRef.current) return;

    const cursor = cursorByTabRef.current[activeTabId] ?? 0;
    const nextCursor = Math.min(cursor, activeContent.length);
    setActiveLine(getLineByCursor(activeContent, nextCursor));
    setScrollTop(0);

    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }, [activeTabId]);

  const cacheCursor = (cursor: number) => {
    if (!activeTabId) return;
    cursorByTabRef.current[activeTabId] = cursor;
    setActiveLine(getLineByCursor(activeContent, cursor));
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
    return <EmptyEditorState />;
  }

  return (
    <div className={`source-editor ${showLineNumbers ? 'with-gutter' : ''}`}>
      {showLineNumbers && (
        <div className="source-gutter" aria-hidden="true">
          <div className="source-gutter-content" style={{ transform: `translateY(-${scrollTop}px)` }}>
            {lineNumbers.map((lineNo) => (
              <div key={lineNo} className={`source-line-number ${lineNo === activeLine ? 'active' : ''}`}>
                {lineNo}
              </div>
            ))}
          </div>
        </div>
      )}
      <textarea
        ref={textareaRef}
        className="source-textarea"
        value={activeContent}
        spellCheck={false}
        wrap="off"
        onChange={handleChange}
        onClick={(e) => cacheCursor(e.currentTarget.selectionStart)}
        onKeyUp={(e) => cacheCursor(e.currentTarget.selectionStart)}
        onSelect={(e) => cacheCursor(e.currentTarget.selectionStart)}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      />
    </div>
  );
};

export const EditorWrapper: React.FC = () => {
  const activeTabId = useStore(state => state.activeTabId);
  const activeTab = useStore(state => state.tabs.find(t => t.tab_id === activeTabId));
  const settings = useStore(state => state.settings);
  const isSourceMode = useStore(state => state.isSourceMode);
  const openNonMdInSourceMode = useStore(state => state.openNonMdInSourceMode);
  const toggleSourceMode = useStore(state => state.toggleSourceMode);
  const pluginCommands = useStore(state => state.pluginCommands);
  const language = useStore(state => state.language);
  const menuText = getLocaleMessages(language).editorMenu;
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const forceSourceMode = Boolean(openNonMdInSourceMode && activeTab?.path && !isMarkdownFile(activeTab.path));
  const shouldUseSourceMode = isSourceMode || forceSourceMode;

  const focusActiveEditor = () => {
    if (shouldUseSourceMode) {
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
  }, [menu, shouldUseSourceMode]);

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
      {shouldUseSourceMode ? (
        <SourceEditor />
      ) : (
        <MilkdownProvider key={`${activeTabId || 'empty'}-${shouldUseSourceMode ? 'source' : 'wys'}`}>
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
          <button className="context-menu-item" onClick={() => void runMenuAction(() => document.execCommand('undo'))}>{menuText.undo}</button>
          <button className="context-menu-item" onClick={() => void runMenuAction(() => document.execCommand('redo'))}>{menuText.redo}</button>
          <button className="context-menu-item" onClick={() => void runMenuAction(() => document.execCommand('cut'))}>{menuText.cut}</button>
          <button className="context-menu-item" onClick={() => void runMenuAction(() => document.execCommand('copy'))}>{menuText.copy}</button>
          <button className="context-menu-item" onClick={() => void runMenuAction(() => document.execCommand('paste'))}>{menuText.paste}</button>
          <button className="context-menu-item" onClick={() => void runMenuAction(() => document.execCommand('selectAll'))}>{menuText.selectAll}</button>
          <button className="context-menu-item" onClick={() => void runMenuAction(() => toggleSourceMode())}>{menuText.toggleSourceMode}</button>
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
              {menuText.pluginPrefix}: {command.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
