import { useCallback, useEffect } from 'react';
import { useStore } from '../store';
import { open, save } from '@tauri-apps/plugin-dialog';
import { api } from '../api';
import { eventToShortcut } from '../commands/definitions';
import { openNewAppWindow } from '../commands/windowActions';
import { runRegisteredPluginCommand } from '../sdk/TypistAPI';

export const useShortcuts = () => {
  const activeTabId = useStore(state => state.activeTabId);
  const isFindReplaceOpen = useStore(state => state.isFindReplaceOpen);
  const isSourceMode = useStore(state => state.isSourceMode);
  const workspaceRoot = useStore(state => state.workspaceRoot);
  const loadWorkspace = useStore(state => state.loadWorkspace);
  const openFile = useStore(state => state.openFile);
  const requestCloseTab = useStore(state => state.requestCloseTab);
  const saveFile = useStore(state => state.saveFile);
  const saveFileAs = useStore(state => state.saveFileAs);
  const keybindings = useStore(state => state.keybindings);
  const pluginCommands = useStore(state => state.pluginCommands);
  const toggleFindReplace = useStore(state => state.toggleFindReplace);
  const toggleSourceMode = useStore(state => state.toggleSourceMode);
  const toggleSidebar = useStore(state => state.toggleSidebar);
  const toggleGlobalSearch = useStore(state => state.toggleGlobalSearch);

  const applySourceFormatting = useCallback((prefix: string, suffix: string = prefix) => {
    const textarea = document.querySelector('.source-textarea') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const selected = value.slice(start, end);
    const next = `${value.slice(0, start)}${prefix}${selected}${suffix}${value.slice(end)}`;

    textarea.value = next;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    requestAnimationFrame(() => {
      const cursor = end + prefix.length + suffix.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }, []);

  const applyLinkFormatting = useCallback(() => {
    const textarea = document.querySelector('.source-textarea') as HTMLTextAreaElement | null;
    const url = window.prompt('输入链接 URL');
    if (!url) return;

    if (!textarea) {
      document.execCommand('createLink', false, url);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const selected = value.slice(start, end) || '链接文字';
    const markdown = `[${selected}](${url})`;
    const next = `${value.slice(0, start)}${markdown}${value.slice(end)}`;

    textarea.value = next;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  const runPluginCommand = useCallback(async (commandId: string) => {
    const command = pluginCommands.find((item) => item.id === commandId);
    if (!command) return;

    const handled = await runRegisteredPluginCommand(commandId);
    if (handled) return;

    await api.emitPluginEvent(command.pluginId, 'command', JSON.stringify({ commandId }));
  }, [pluginCommands]);

  const runCommand = useCallback(async (commandId: string) => {
    switch (commandId) {
      case 'file.open': {
        const selected = await open({
          multiple: false,
          filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
        });
        if (selected) {
          await openFile(selected as string);
        }
        return;
      }
      case 'file.new': {
        if (!workspaceRoot) {
          window.alert('请先打开一个工作区文件夹再新建文件。');
          return;
        }

        const targetPath = await save({
          defaultPath: `${workspaceRoot.replace(/[\\/]$/, '')}/new-file.md`,
          filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
        });

        if (!targetPath || Array.isArray(targetPath)) {
          return;
        }

        const normalized = targetPath.replace(/\\/g, '/');
        const separatorIndex = normalized.lastIndexOf('/');
        if (separatorIndex <= 0 || separatorIndex >= normalized.length - 1) {
          window.alert('新建文件失败：目标路径无效。');
          return;
        }

        const parentPath = normalized.slice(0, separatorIndex);
        const name = normalized.slice(separatorIndex + 1);

        try {
          const createdPath = await api.createWorkspaceFile(parentPath, name);
          await loadWorkspace();
          await openFile(createdPath);
        } catch (error) {
          window.alert(`新建文件失败: ${String(error)}`);
        }
        return;
      }
      case 'file.newWindow': {
        await openNewAppWindow();
        return;
      }
      case 'file.save': {
        if (activeTabId) {
          await saveFile(activeTabId);
        }
        return;
      }
      case 'file.saveAs': {
        if (activeTabId) {
          await saveFileAs(activeTabId);
        }
        return;
      }
      case 'file.closeTab': {
        if (activeTabId) {
          await requestCloseTab(activeTabId);
        }
        return;
      }
      case 'edit.find': {
        if (!isFindReplaceOpen) {
          toggleFindReplace();
        }
        return;
      }
      case 'edit.replace': {
        if (!isFindReplaceOpen) {
          toggleFindReplace();
        }
        return;
      }
      case 'edit.undo': {
        document.execCommand('undo');
        return;
      }
      case 'edit.redo': {
        document.execCommand('redo');
        return;
      }
      case 'format.bold': {
        if (isSourceMode) {
          applySourceFormatting('**');
        } else {
          document.execCommand('bold');
        }
        return;
      }
      case 'format.italic': {
        if (isSourceMode) {
          applySourceFormatting('*');
        } else {
          document.execCommand('italic');
        }
        return;
      }
      case 'format.link': {
        applyLinkFormatting();
        return;
      }
      case 'view.toggleSourceMode': {
        toggleSourceMode();
        return;
      }
      case 'view.toggleSidebar': {
        toggleSidebar();
        return;
      }
      case 'search.global': {
        toggleGlobalSearch();
        return;
      }
      default: {
        if (commandId.startsWith('plugin.')) {
          await runPluginCommand(commandId);
          return;
        }
      }
    }
  }, [
    activeTabId,
    isFindReplaceOpen,
    isSourceMode,
    workspaceRoot,
    loadWorkspace,
    openFile,
    requestCloseTab,
    saveFile,
    saveFileAs,
    toggleFindReplace,
    toggleSourceMode,
    toggleSidebar,
    toggleGlobalSearch,
    applySourceFormatting,
    applyLinkFormatting,
    runPluginCommand,
  ]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const shortcut = eventToShortcut(e);
      if (!shortcut) return;

      const commandEntry = Object.entries(keybindings).find(([, value]) => value === shortcut);
      if (!commandEntry) return;

      const [commandId] = commandEntry;

      const isKnownCommand =
        commandId.startsWith('plugin.') ||
        [
          'file.open',
          'file.new',
          'file.newWindow',
          'file.save',
          'file.saveAs',
          'file.closeTab',
          'edit.find',
          'edit.replace',
          'edit.undo',
          'edit.redo',
          'format.bold',
          'format.italic',
          'format.link',
          'view.toggleSourceMode',
          'view.toggleSidebar',
          'search.global',
        ].includes(commandId);

      if (!isKnownCommand) return;

      // No active tab scenario: only allow a subset to execute.
      if (!activeTabId && ['file.open', 'file.new', 'file.newWindow', 'view.toggleSidebar'].every(id => id !== commandId)) {
        return;
      }

      e.preventDefault();

      await runCommand(commandId);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTabId,
    keybindings,
    runCommand,
  ]);
};
