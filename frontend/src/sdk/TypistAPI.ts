import { useStore } from '../store';
import { api } from '../api';
import React from 'react';

const pluginCommandHandlers = new Map<string, () => void | Promise<void>>();

const touchActiveTabDirty = () => {
  const state = useStore.getState();
  if (!state.activeTabId) return;

  const tab = state.tabs.find((item) => item.tab_id === state.activeTabId);
  if (tab && !tab.is_dirty) {
    void state.markTabDirty(state.activeTabId, true);
  }
};

const updateContent = (content: string) => {
  const state = useStore.getState();
  state.setActiveContent(content);
  touchActiveTabDirty();
};

export const runRegisteredPluginCommand = async (commandId: string) => {
  const handler = pluginCommandHandlers.get(commandId);
  if (!handler) return false;

  await handler();
  return true;
};

export const injectPluginSDK = (slotsCtx: any) => {
  // We create a global object `TypistAPI` that third-party JS can access.
  (window as any).TypistAPI = {
    // 1. Data Store Context
    getActiveFile: () => {
      const state = useStore.getState();
      const tab = state.tabs.find(t => t.tab_id === state.activeTabId);
      return {
        path: tab?.path,
        content: state.activeContent
      };
    },
    
    // 2. Editor Operations (Placeholder API map)
    editor: {
      getContent: () => useStore.getState().activeContent,
      setContent: (content: string) => updateContent(content),
      insertTextAtCursor: (text: string) => {
        const textarea = document.querySelector('.source-textarea') as HTMLTextAreaElement | null;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const value = textarea.value;
          const next = `${value.slice(0, start)}${text}${value.slice(end)}`;
          textarea.value = next;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          const cursor = start + text.length;
          textarea.focus();
          textarea.setSelectionRange(cursor, cursor);
          return;
        }

        const proseMirror = document.querySelector('.milkdown .ProseMirror') as HTMLElement | null;
        if (proseMirror) {
          proseMirror.focus();
          document.execCommand('insertText', false, text);
          return;
        }

        const current = useStore.getState().activeContent;
        updateContent(`${current}${text}`);
      },
    },

    // 3. UI Slots Injection
    ui: {
      registerSlot: (position: string, pluginId: string, id: string, component: React.FC) => {
        slotsCtx.registerSlot(position, pluginId, id, component);
      },
      unregisterSlot: (position: string, pluginId: string, id: string) => {
        slotsCtx.unregisterSlot(position, pluginId, id);
      }
    },

    // 4. Command Registration (for keybindings and command palette-like usage)
    commands: {
      registerCommand: (
        pluginId: string,
        commandKey: string,
        label: string,
        category = '插件命令',
        handler?: () => void | Promise<void>,
      ) => {
        const commandId = `plugin.${pluginId}.${commandKey}`;

        useStore.getState().registerPluginCommand({
          id: commandId,
          pluginId,
          label,
          category,
        });

        if (handler) {
          pluginCommandHandlers.set(commandId, handler);
        }
      },
      unregisterCommands: (pluginId: string) => {
        useStore.getState().unregisterPluginCommands(pluginId);

        Array.from(pluginCommandHandlers.keys()).forEach((id) => {
          if (id.startsWith(`plugin.${pluginId}.`)) {
            pluginCommandHandlers.delete(id);
          }
        });
      },
      execute: async (commandId: string) => runRegisteredPluginCommand(commandId),
    },

    // 5. Backend IPC via permissions
    backend: {
      // Plugins should use this. The backend `plugin_permission_check_cmd` acts as a guard.
      // This MVP SDK just exposes safe wrapper methods.
      emitEvent: async (pluginId: string, event: string, payload: any) => {
        return await api.emitPluginEvent(pluginId, event, JSON.stringify(payload));
      },
      pasteImage: async (base64Data: string, mimeType: string) => {
        return await api.pasteImage({ base64_data: base64Data, mime_type: mimeType });
      }
    },

    // 6. Utilities
    React: React
  };
};

export const removePluginSDK = () => {
  pluginCommandHandlers.clear();
  delete (window as any).TypistAPI;
};
