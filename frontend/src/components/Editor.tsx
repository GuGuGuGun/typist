import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { defaultValueCtx, editorViewCtx, Editor, rootCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { clipboard } from '@milkdown/plugin-clipboard';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { prism } from '@milkdown/plugin-prism';
import { math } from '@milkdown/plugin-math';
import { diagram } from '@milkdown/plugin-diagram';
import React, { useEffect } from 'react';
import { setBlockType, toggleMark } from 'prosemirror-commands';
import { addColumnAfter, addRowAfter, deleteColumn, deleteRow } from 'prosemirror-tables';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { api } from '../api';
import { runRegisteredPluginCommand } from '../sdk/TypistAPI';
import { getLocaleMessages, pickRandomStartupCopy } from '../i18n';
import katex from 'katex';
import type { Command, Selection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';

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

const getLineStartOffsets = (content: string) => {
  const offsets = [0];
  for (let idx = 0; idx < content.length; idx += 1) {
    if (content[idx] === '\n') {
      offsets.push(idx + 1);
    }
  }
  return offsets;
};

const splitTableRow = (line: string) => {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((item) => item.trim());
};

const formatTableRow = (cells: string[]) => `| ${cells.join(' | ')} |`;

const isDividerRow = (line: string) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());

type TableContext = {
  startLine: number;
  endLine: number;
  currentRow: number;
  currentCol: number;
  colCount: number;
  lines: string[];
};

const getCurrentLineIndex = (content: string, cursor: number) => {
  const safeCursor = Math.max(0, Math.min(cursor, content.length));
  return content.slice(0, safeCursor).split(/\r?\n/).length - 1;
};

const getCurrentColumnIndex = (line: string, cursorInLine: number, colCount: number) => {
  const pipePositions: number[] = [-1];
  for (let idx = 0; idx < line.length; idx += 1) {
    if (line[idx] === '|') pipePositions.push(idx);
  }
  pipePositions.push(line.length);

  for (let index = 0; index < pipePositions.length - 1; index += 1) {
    if (cursorInLine > pipePositions[index] && cursorInLine <= pipePositions[index + 1]) {
      return Math.max(0, Math.min(colCount - 1, index));
    }
  }

  return 0;
};

const detectTableContext = (content: string, cursor: number): TableContext | null => {
  const lines = content.split(/\r?\n/);
  const lineIndex = getCurrentLineIndex(content, cursor);
  if (lineIndex < 0 || lineIndex >= lines.length) return null;
  if (!lines[lineIndex].includes('|')) return null;

  let start = lineIndex;
  while (start > 0 && lines[start - 1].includes('|')) {
    start -= 1;
  }

  let end = lineIndex;
  while (end < lines.length - 1 && lines[end + 1].includes('|')) {
    end += 1;
  }

  if (end - start < 1) return null;
  const tableLines = lines.slice(start, end + 1);
  if (!isDividerRow(tableLines[1] ?? '')) return null;

  const colCount = Math.max(1, splitTableRow(tableLines[0]).length);
  const lineOffsets = getLineStartOffsets(content);
  const cursorInLine = cursor - (lineOffsets[lineIndex] ?? 0);
  const currentCol = getCurrentColumnIndex(lines[lineIndex], cursorInLine, colCount);

  return {
    startLine: start,
    endLine: end,
    currentRow: lineIndex - start,
    currentCol,
    colCount,
    lines: tableLines,
  };
};

type ActiveBlock = {
  type: 'mermaid' | 'katex' | 'code';
  language: string;
  content: string;
  rangeStart: number;
  rangeEnd: number;
  header: string;
  footer: string;
};

const detectActiveBlock = (content: string, cursor: number): ActiveBlock | null => {
  const lines = content.split(/\r?\n/);
  const lineOffsets = getLineStartOffsets(content);
  const lineIndex = getCurrentLineIndex(content, cursor);

  for (let idx = lineIndex; idx >= 0; idx -= 1) {
    const line = lines[idx] ?? '';
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim().toLowerCase();
      let endFence = -1;

      for (let probe = idx + 1; probe < lines.length; probe += 1) {
        if ((lines[probe] ?? '').trim().startsWith('```')) {
          endFence = probe;
          break;
        }
      }

      if (endFence <= idx || lineIndex > endFence) return null;

      const blockContent = lines.slice(idx + 1, endFence).join('\n');
      const rangeStart = lineOffsets[idx] ?? 0;
      const rangeEnd =
        endFence + 1 < lineOffsets.length
          ? (lineOffsets[endFence + 1] ?? content.length)
          : content.length;

      return {
        type:
          language === 'mermaid'
            ? 'mermaid'
            : language === 'latex' || language === 'math'
              ? 'katex'
              : 'code',
        language: language || 'code',
        content: blockContent,
        rangeStart,
        rangeEnd,
        header: lines[idx],
        footer: lines[endFence],
      };
    }

    if (trimmed === '$$') {
      let endMath = -1;
      for (let probe = idx + 1; probe < lines.length; probe += 1) {
        if ((lines[probe] ?? '').trim() === '$$') {
          endMath = probe;
          break;
        }
      }

      if (endMath <= idx || lineIndex > endMath) return null;

      const blockContent = lines.slice(idx + 1, endMath).join('\n');
      const rangeStart = lineOffsets[idx] ?? 0;
      const rangeEnd =
        endMath + 1 < lineOffsets.length
          ? (lineOffsets[endMath + 1] ?? content.length)
          : content.length;

      return {
        type: 'katex',
        language: 'katex',
        content: blockContent,
        rangeStart,
        rangeEnd,
        header: '$$',
        footer: '$$',
      };
    }
  }

  return null;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

type WysiwygFloatingToolbarState = {
  visible: boolean;
  top: number;
  left: number;
};

const DEFAULT_FLOATING_TOOLBAR_STATE: WysiwygFloatingToolbarState = {
  visible: false,
  top: 0,
  left: 0,
};

let milkdownEditorViewRef: EditorView | null = null;

const isSelectionInTable = (selection: Selection) => {
  const { $from } = selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') {
      return true;
    }
  }
  return false;
};

const resolveMilkdownEditorView = () => {
  if (!milkdownEditorViewRef) {
    const proseMirror = document.querySelector('.milkdown .ProseMirror') as
      | (HTMLElement & { pmViewDesc?: { view?: EditorView } })
      | null;
    milkdownEditorViewRef = proseMirror?.pmViewDesc?.view ?? null;
  }

  return milkdownEditorViewRef;
};

const runTableCommandInWysiwyg = (command: Command) => {
  const view = resolveMilkdownEditorView();
  if (!view) return;

  command(view.state, view.dispatch, view);
};

const runTextCommandInWysiwyg = (resolver: (view: EditorView) => Command | null) => {
  const view = resolveMilkdownEditorView();
  if (!view) return;

  const command = resolver(view);
  if (!command) return;
  command(view.state, view.dispatch, view);
  view.focus();
};

const EmptyEditorState: React.FC = () => {
  const { language, openFile, loadWorkspace } = useStore(useShallow((state) => ({
    language: state.language,
    openFile: state.openFile,
    loadWorkspace: state.loadWorkspace,
  })));
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
  const { activeTabId, activeTab, activeContent, markTabDirty, setActiveContent } = useStore(useShallow((state) => ({
    activeTabId: state.activeTabId,
    activeTab: state.tabs.find((tab) => tab.tab_id === state.activeTabId),
    activeContent: state.activeContent,
    markTabDirty: state.markTabDirty,
    setActiveContent: state.setActiveContent,
  })));
  
  // Ref to track if we're programmatically updating to avoid self-triggering listener
  const isInternalUpdate = React.useRef(false);

  useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, activeContent || '');
        ctx.get(listenerCtx)
          .mounted((ctx) => {
            milkdownEditorViewRef = ctx.get(editorViewCtx);
          })
          .markdownUpdated((_ctx, markdown, prevMarkdown) => {
            if (isInternalUpdate.current) return;
            setActiveContent(markdown);
            if (activeTabId && markdown !== prevMarkdown && !activeTab?.is_dirty) {
              markTabDirty(activeTabId, true);
            }
          })
          .selectionUpdated((ctx, selection) => {
            const view = ctx.get(editorViewCtx);
            milkdownEditorViewRef = view;

            if (!isSelectionInTable(selection)) return;

            const proseMirror = document.querySelector('.milkdown .ProseMirror') as
              | (HTMLElement & { pmViewDesc?: { view?: EditorView } })
              | null;
            milkdownEditorViewRef = proseMirror?.pmViewDesc?.view ?? view;
          })
          .destroy(() => {
            milkdownEditorViewRef = null;
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
  const { activeTabId, activeTab, activeContent, setActiveContent, markTabDirty, showLineNumbersForNonMd } = useStore(useShallow((state) => ({
    activeTabId: state.activeTabId,
    activeTab: state.tabs.find((tab) => tab.tab_id === state.activeTabId),
    activeContent: state.activeContent,
    setActiveContent: state.setActiveContent,
    markTabDirty: state.markTabDirty,
    showLineNumbersForNonMd: state.showLineNumbersForNonMd,
  })));
  const showLineNumbers = Boolean(showLineNumbersForNonMd && activeTab?.path && !isMarkdownFile(activeTab.path));

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const cursorByTabRef = React.useRef<Record<string, number>>({});
  const [activeLine, setActiveLine] = React.useState(1);
  const [activeCursor, setActiveCursor] = React.useState(0);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);
  const [dualLayerFocused, setDualLayerFocused] = React.useState(true);
  const [blockPreviewHtml, setBlockPreviewHtml] = React.useState<string>('');
  const lineCount = React.useMemo(() => Math.max(1, activeContent.split(/\r?\n/).length), [activeContent]);
  const lineHeight = 24;
  const gutterOverscan = 20;

  const tableContext = React.useMemo(
    () => detectTableContext(activeContent, activeCursor),
    [activeContent, activeCursor],
  );

  const activeBlock = React.useMemo(
    () => detectActiveBlock(activeContent, activeCursor),
    [activeContent, activeCursor],
  );

  const firstVisibleLine = Math.max(1, Math.floor(scrollTop / lineHeight) - gutterOverscan);
  const visibleLineCount = Math.ceil((viewportHeight || 600) / lineHeight) + gutterOverscan * 2;
  const lastVisibleLine = Math.min(lineCount, firstVisibleLine + visibleLineCount - 1);
  const lineNumbers = React.useMemo(
    () =>
      Array.from(
        { length: Math.max(0, lastVisibleLine - firstVisibleLine + 1) },
        (_, idx) => firstVisibleLine + idx,
      ),
    [firstVisibleLine, lastVisibleLine],
  );

  useEffect(() => {
    if (!activeTabId || !textareaRef.current) return;

    const cursor = cursorByTabRef.current[activeTabId] ?? 0;
    const nextCursor = Math.min(cursor, activeContent.length);
    setActiveCursor(nextCursor);
    setActiveLine(getLineByCursor(activeContent, nextCursor));
    setScrollTop(0);

    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      setViewportHeight(textareaRef.current?.clientHeight ?? 0);
    });
  }, [activeTabId]);

  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(textareaRef.current?.clientHeight ?? 0);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setDualLayerFocused(true);
  }, [activeBlock?.rangeStart, activeBlock?.rangeEnd]);

  useEffect(() => {
    let disposed = false;

    const renderPreview = async () => {
      if (!activeBlock) {
        setBlockPreviewHtml('');
        return;
      }

      if (activeBlock.type === 'katex') {
        const html = katex.renderToString(activeBlock.content || '\\text{ }', {
          throwOnError: false,
          displayMode: true,
        });
        if (!disposed) setBlockPreviewHtml(html);
        return;
      }

      if (activeBlock.type === 'mermaid') {
        try {
          const mermaid = (await import('mermaid')).default;
          mermaid.initialize({ startOnLoad: false, theme: 'default' });
          const id = `typist-mermaid-preview-${Date.now()}`;
          const { svg } = await mermaid.render(id, activeBlock.content || 'graph TD\\nA-->B');
          if (!disposed) setBlockPreviewHtml(svg);
        } catch {
          if (!disposed) {
            setBlockPreviewHtml(`<pre>${escapeHtml(activeBlock.content)}</pre>`);
          }
        }
        return;
      }

      setBlockPreviewHtml(`<pre><code>${escapeHtml(activeBlock.content)}</code></pre>`);
    };

    void renderPreview();

    return () => {
      disposed = true;
    };
  }, [activeBlock]);

  const cacheCursor = (cursor: number) => {
    if (!activeTabId) return;
    cursorByTabRef.current[activeTabId] = cursor;
    setActiveCursor(cursor);
    setActiveLine(getLineByCursor(activeContent, cursor));
  };

  const markDirtyIfNeeded = () => {
    if (activeTabId && !activeTab?.is_dirty) {
      void markTabDirty(activeTabId, true);
    }
  };

  const updateContentAndDirty = (nextContent: string) => {
    setActiveContent(nextContent);
    markDirtyIfNeeded();
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    updateContentAndDirty(content);
    cacheCursor(e.target.selectionStart);
  };

  const updateTable = (updater: (tableLines: string[], context: TableContext) => string[]) => {
    if (!tableContext) return;

    const allLines = activeContent.split(/\r?\n/);
    const nextTableLines = updater([...tableContext.lines], tableContext);
    const nextLines = [
      ...allLines.slice(0, tableContext.startLine),
      ...nextTableLines,
      ...allLines.slice(tableContext.endLine + 1),
    ];
    updateContentAndDirty(nextLines.join('\n'));
  };

  const addRowAfter = () => {
    updateTable((tableLines, context) => {
      const row = Array.from({ length: context.colCount }, () => '');
      const insertAt = Math.max(2, context.currentRow + 1);
      tableLines.splice(insertAt, 0, formatTableRow(row));
      return tableLines;
    });
  };

  const deleteRow = () => {
    updateTable((tableLines, context) => {
      if (context.currentRow < 2 || tableLines.length <= 3) {
        return tableLines;
      }

      tableLines.splice(context.currentRow, 1);
      return tableLines;
    });
  };

  const addColumnAfter = () => {
    updateTable((tableLines, context) => {
      const insertIndex = context.currentCol + 1;
      return tableLines.map((line, index) => {
        const cells = splitTableRow(line);
        const value = index === 1 ? '---' : '';
        cells.splice(Math.min(insertIndex, cells.length), 0, value);
        return formatTableRow(cells);
      });
    });
  };

  const deleteColumn = () => {
    updateTable((tableLines, context) => {
      if (context.colCount <= 1) return tableLines;

      return tableLines.map((line) => {
        const cells = splitTableRow(line);
        cells.splice(Math.min(context.currentCol, cells.length - 1), 1);
        return formatTableRow(cells);
      });
    });
  };

  const alignColumn = (mode: 'left' | 'center' | 'right') => {
    updateTable((tableLines, context) => {
      const divider = splitTableRow(tableLines[1] ?? '');
      const marker = mode === 'left' ? ':---' : mode === 'center' ? ':---:' : '---:';
      divider[Math.min(context.currentCol, divider.length - 1)] = marker;
      tableLines[1] = formatTableRow(divider);
      return tableLines;
    });
  };

  const replaceActiveBlockContent = (nextBlockContent: string) => {
    if (!activeBlock) return;

    const rebuilt = `${activeBlock.header}\n${nextBlockContent}\n${activeBlock.footer}`;
    const next =
      activeContent.slice(0, activeBlock.rangeStart) +
      rebuilt +
      activeContent.slice(activeBlock.rangeEnd);
    updateContentAndDirty(next);
  };

  if (!activeTabId) {
    return <EmptyEditorState />;
  }

  return (
    <div className={`source-editor ${showLineNumbers ? 'with-gutter' : ''}`}>
      {showLineNumbers && (
        <div className="source-gutter" aria-hidden="true">
          <div className="source-gutter-content" style={{ height: `${lineCount * lineHeight}px`, position: 'relative' }}>
            {lineNumbers.map((lineNo) => (
              <div
                key={lineNo}
                className={`source-line-number ${lineNo === activeLine ? 'active' : ''}`}
                style={{
                  position: 'absolute',
                  top: `${(lineNo - 1) * lineHeight}px`,
                  left: 0,
                  right: 0,
                  height: `${lineHeight}px`,
                  lineHeight: `${lineHeight}px`,
                }}
              >
                {lineNo}
              </div>
            ))}
          </div>
        </div>
      )}

      {tableContext && (
        <div className="source-table-toolbar">
          <button className="default-btn" onClick={addRowAfter}>+Row</button>
          <button className="default-btn" onClick={deleteRow}>-Row</button>
          <button className="default-btn" onClick={addColumnAfter}>+Col</button>
          <button className="default-btn" onClick={deleteColumn}>-Col</button>
          <button className="default-btn" onClick={() => alignColumn('left')}>L</button>
          <button className="default-btn" onClick={() => alignColumn('center')}>C</button>
          <button className="default-btn" onClick={() => alignColumn('right')}>R</button>
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
        onScroll={(e) => {
          setScrollTop(e.currentTarget.scrollTop);
          setViewportHeight(e.currentTarget.clientHeight);
        }}
      />

      {activeBlock && (
        <div className={`dual-layer-panel ${dualLayerFocused ? 'focused' : ''}`}>
          <div className="dual-layer-preview" dangerouslySetInnerHTML={{ __html: blockPreviewHtml }} />
          <textarea
            className="dual-layer-source"
            value={activeBlock.content}
            onFocus={() => setDualLayerFocused(true)}
            onBlur={() => setDualLayerFocused(false)}
            onChange={(e) => replaceActiveBlockContent(e.target.value)}
            spellCheck={false}
          />
          {!dualLayerFocused && (
            <button className="default-btn dual-layer-edit" onClick={() => setDualLayerFocused(true)}>
              Edit Source
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const EditorWrapper: React.FC = () => {
  const {
    activeTabId,
    activeTab,
    activeContent,
    settings,
    isSourceMode,
    openNonMdInSourceMode,
    showFloatingTextToolbar,
    toggleSourceMode,
    pluginCommands,
    language,
  } = useStore(useShallow((state) => ({
    activeTabId: state.activeTabId,
    activeTab: state.tabs.find((tab) => tab.tab_id === state.activeTabId),
    activeContent: state.activeContent,
    settings: state.settings,
    isSourceMode: state.isSourceMode,
    openNonMdInSourceMode: state.openNonMdInSourceMode,
    showFloatingTextToolbar: state.showFloatingTextToolbar,
    toggleSourceMode: state.toggleSourceMode,
    pluginCommands: state.pluginCommands,
    language: state.language,
  })));
  const menuText = getLocaleMessages(language).editorMenu;
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null);
  const [tableToolbar, setTableToolbar] = React.useState<WysiwygFloatingToolbarState>(
    DEFAULT_FLOATING_TOOLBAR_STATE,
  );
  const [textToolbar, setTextToolbar] = React.useState<WysiwygFloatingToolbarState>(
    DEFAULT_FLOATING_TOOLBAR_STATE,
  );
  const editorAreaRef = React.useRef<HTMLDivElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const forceSourceMode = Boolean(openNonMdInSourceMode && activeTab?.path && !isMarkdownFile(activeTab.path));
  const activeLineCount = React.useMemo(
    () => Math.max(1, activeContent.split(/\r?\n/).length),
    [activeContent],
  );
  const largeDocMode = activeLineCount > 2000;
  const autoSourceForLargeDoc = Boolean(largeDocMode && activeTab?.path && isMarkdownFile(activeTab.path));
  const shouldUseSourceMode = isSourceMode || forceSourceMode || autoSourceForLargeDoc;

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
    if (shouldUseSourceMode) {
      setTableToolbar(DEFAULT_FLOATING_TOOLBAR_STATE);
      setTextToolbar(DEFAULT_FLOATING_TOOLBAR_STATE);
      return;
    }

    const updateFromSelection = () => {
      const selection = document.getSelection();
      const anchor = selection?.anchorNode ?? null;
      const area = editorAreaRef.current;
      const proseMirror = document.querySelector('.milkdown .ProseMirror');

      if (!anchor || !area || !proseMirror || !proseMirror.contains(anchor)) {
        setTableToolbar(DEFAULT_FLOATING_TOOLBAR_STATE);
        setTextToolbar(DEFAULT_FLOATING_TOOLBAR_STATE);
        return;
      }

      const element = anchor instanceof Element ? anchor : anchor.parentElement;
      const table = element?.closest('table');
      const areaRect = area.getBoundingClientRect();

      if (!table) {
        setTableToolbar(DEFAULT_FLOATING_TOOLBAR_STATE);

        if (!showFloatingTextToolbar || !selection || selection.isCollapsed || selection.rangeCount === 0) {
          setTextToolbar(DEFAULT_FLOATING_TOOLBAR_STATE);
          return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect.width && !rect.height) {
          setTextToolbar(DEFAULT_FLOATING_TOOLBAR_STATE);
          return;
        }

        setTextToolbar({
          visible: true,
          top: rect.top - areaRect.top - 42,
          left: rect.left - areaRect.left,
        });
        return;
      }

      const tableRect = table.getBoundingClientRect();
      setTableToolbar({
        visible: true,
        top: tableRect.top - areaRect.top + 6,
        left: tableRect.left - areaRect.left + 8,
      });
      setTextToolbar(DEFAULT_FLOATING_TOOLBAR_STATE);
    };

    updateFromSelection();
    document.addEventListener('selectionchange', updateFromSelection);
    window.addEventListener('scroll', updateFromSelection, true);

    return () => {
      document.removeEventListener('selectionchange', updateFromSelection);
      window.removeEventListener('scroll', updateFromSelection, true);
    };
  }, [shouldUseSourceMode, activeTabId, showFloatingTextToolbar]);

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
    <div ref={editorAreaRef} className={`editor-area ${focusClass} ${typewriterClass} ${largeDocMode ? 'large-doc-mode' : ''}`}>
      {shouldUseSourceMode ? (
        <SourceEditor />
      ) : (
        <MilkdownProvider key={`${activeTabId || 'empty'}-${shouldUseSourceMode ? 'source' : 'wys'}`}>
          <EditorContent />
        </MilkdownProvider>
      )}

      {!shouldUseSourceMode && tableToolbar.visible && (
        <div
          className="wysiwyg-table-toolbar"
          style={{ top: tableToolbar.top, left: tableToolbar.left }}
        >
          <button className="default-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => runTableCommandInWysiwyg(addRowAfter)}>+Row</button>
          <button className="default-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => runTableCommandInWysiwyg(deleteRow)}>-Row</button>
          <button className="default-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => runTableCommandInWysiwyg(addColumnAfter)}>+Col</button>
          <button className="default-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => runTableCommandInWysiwyg(deleteColumn)}>-Col</button>
        </div>
      )}

      {!shouldUseSourceMode && textToolbar.visible && showFloatingTextToolbar && (
        <div className="wysiwyg-text-toolbar" style={{ top: textToolbar.top, left: textToolbar.left }}>
          <button
            className="default-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runTextCommandInWysiwyg((view) => {
              const strong = view.state.schema.marks.strong;
              return strong ? toggleMark(strong) : null;
            })}
          >
            B
          </button>
          <button
            className="default-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runTextCommandInWysiwyg((view) => {
              const em = view.state.schema.marks.em;
              return em ? toggleMark(em) : null;
            })}
          >
            I
          </button>
          <button
            className="default-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runTextCommandInWysiwyg((view) => {
              const code = view.state.schema.marks.code;
              return code ? toggleMark(code) : null;
            })}
          >
            Code
          </button>
          <button
            className="default-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runTextCommandInWysiwyg((view) => {
              const heading = view.state.schema.nodes.heading;
              return heading ? setBlockType(heading, { level: 2 }) : null;
            })}
          >
            H2
          </button>
        </div>
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
