import { useStore } from '../store';
import { api } from '../api';
import React from 'react';

const pluginCommandHandlers = new Map<string, () => void | Promise<void>>();
const pluginCleanupHandlers = new Map<string, Set<() => void | Promise<void>>>();
const pluginSandboxWorkers = new Map<string, Worker>();
const pluginSandboxPermissions = new Map<string, Set<string>>();

type SlotPosition = 'sidebar_bottom' | 'status_bar_left' | 'status_bar_right' | 'toolbar_right';

type SlotsContextLike = {
  registerSlot: (position: SlotPosition, pluginId: string, id: string, component: React.FC) => void;
  unregisterSlot: (position: SlotPosition, pluginId: string, id: string) => void;
  unregisterAllPluginSlots: (pluginId: string) => void;
};

type TypistApiLike = {
  getActiveFile?: () => { path: string | undefined; content: string };
  editor?: {
    getContent?: () => string;
    setContent?: (content: string) => void;
    insertTextAtCursor?: (text: string) => void;
  };
  ui?: {
    registerSlot?: (position: string, pluginId: string, id: string, component: React.FC) => void;
    unregisterSlot?: (position: string, pluginId: string, id: string) => void;
    unregisterAllSlots?: (pluginId: string) => void;
  };
  commands?: {
    registerCommand?: (
      pluginId: string,
      commandKey: string,
      label: string,
      category?: string,
      handler?: () => void | Promise<void>,
    ) => void;
    unregisterCommands?: (pluginId: string) => void;
    execute?: (commandId: string) => Promise<boolean>;
  };
  lifecycle?: {
    registerCleanup?: (pluginId: string, cleanup: () => void | Promise<void>) => () => void;
    runCleanup?: (pluginId: string) => Promise<void>;
  };
  backend?: {
    emitEvent?: (pluginId: string, event: string, payload: unknown) => Promise<unknown>;
    pasteImage?: (base64Data: string, mimeType: string) => Promise<{ local_path: string }>;
  };
  React?: typeof React;
};

const isSlotPosition = (value: string): value is SlotPosition =>
  value === 'sidebar_bottom'
  || value === 'status_bar_left'
  || value === 'status_bar_right'
  || value === 'toolbar_right';

declare global {
  interface Window {
    TypistAPI?: TypistApiLike;
  }
}

let slotsContextRef: SlotsContextLike | null = null;

type SandboxWorkerRequest = {
  type: 'request';
  id: number;
  action:
    | 'getActiveFile'
    | 'getContent'
    | 'setContent'
    | 'insertText'
    | 'emitEvent'
    | 'pasteImage'
    | 'uiRegisterSlot'
    | 'uiUnregisterSlot'
    | 'uiUnregisterAllSlots';
  payload?: Record<string, unknown>;
};

type SandboxWorkerMessage =
  | {
      type: 'registerCommand';
      pluginId: string;
      commandId: string;
      label: string;
      category: string;
    }
  | { type: 'unregisterCommands'; pluginId: string }
  | { type: 'ready'; pluginId: string }
  | { type: 'runtimeError'; pluginId: string; message: string; stack?: string }
  | SandboxWorkerRequest;

const hasPluginPermission = (pluginId: string, permission: string) => {
  const permissions = pluginSandboxPermissions.get(pluginId);
  if (!permissions) return false;
  return permissions.has(permission);
};

const postSandboxResponse = (
  worker: Worker,
  id: number,
  ok: boolean,
  result?: unknown,
  error?: string,
) => {
  worker.postMessage({ type: 'response', id, ok, result, error });
};

const asString = (value: unknown) => (typeof value === 'string' ? value : '');

const handleSandboxRequest = async (
  pluginId: string,
  worker: Worker,
  message: SandboxWorkerRequest,
) => {
  const payload = message.payload ?? {};

  try {
    let result: unknown;

    switch (message.action) {
      case 'getActiveFile': {
        const state = useStore.getState();
        const tab = state.tabs.find((item) => item.tab_id === state.activeTabId);
        result = { path: tab?.path ?? null, content: state.activeContent };
        break;
      }
      case 'getContent': {
        result = useStore.getState().activeContent;
        break;
      }
      case 'setContent': {
        const content = asString(payload.content);
        updateContent(content);
        result = true;
        break;
      }
      case 'insertText': {
        const text = asString(payload.text);
        window.TypistAPI?.editor?.insertTextAtCursor?.(text);
        result = true;
        break;
      }
      case 'emitEvent': {
        if (!hasPluginPermission(pluginId, 'events.emit')) {
          throw new Error('permission denied: events.emit');
        }

        const event = asString(payload.event);
        result = await api.emitPluginEvent(
          pluginId,
          event,
          payload.payload ? JSON.stringify(payload.payload) : null,
        );
        break;
      }
      case 'pasteImage': {
        if (!hasPluginPermission(pluginId, 'images.paste')) {
          throw new Error('permission denied: images.paste');
        }

        const base64Data = asString(payload.base64Data);
        const mimeType = asString(payload.mimeType);
        result = await api.pasteImage({ base64_data: base64Data, mime_type: mimeType });
        break;
      }
      case 'uiRegisterSlot':
      case 'uiUnregisterSlot':
      case 'uiUnregisterAllSlots': {
        throw new Error('ui slot APIs are not available in sandboxed plugins');
      }
      default: {
        throw new Error(`unsupported sandbox action: ${String(message.action)}`);
      }
    }

    postSandboxResponse(worker, message.id, true, result);
  } catch (error) {
    postSandboxResponse(worker, message.id, false, null, String(error));
  }
};

const unregisterSandboxPluginCommands = (pluginId: string) => {
  useStore.getState().unregisterPluginCommands(pluginId);
  Array.from(pluginCommandHandlers.keys()).forEach((id) => {
    if (id.startsWith(`plugin.${pluginId}.`)) {
      pluginCommandHandlers.delete(id);
    }
  });
};

export const setPluginSandboxPermissions = (pluginId: string, permissions: string[]) => {
  pluginSandboxPermissions.set(pluginId, new Set(permissions));
};

export const mountSandboxedPlugin = (pluginId: string, entry: string | null | undefined) => {
  if (!pluginId || !entry) return;

  const existing = pluginSandboxWorkers.get(pluginId);
  if (existing) {
    try {
      existing.postMessage({ type: 'destroy' });
    } finally {
      existing.terminate();
    }
    pluginSandboxWorkers.delete(pluginId);
  }

  const worker = new Worker(new URL('../workers/pluginSandboxWorker.ts', import.meta.url), {
    type: 'module',
  });

  worker.addEventListener('message', (event: MessageEvent<SandboxWorkerMessage>) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'registerCommand') {
      useStore.getState().registerPluginCommand({
        id: data.commandId,
        pluginId: data.pluginId,
        label: data.label,
        category: data.category,
      });
      pluginCommandHandlers.set(data.commandId, async () => {
        worker.postMessage({ type: 'executeCommand', commandId: data.commandId });
      });
      return;
    }

    if (data.type === 'unregisterCommands') {
      unregisterSandboxPluginCommands(data.pluginId);
      return;
    }

    if (data.type === 'request') {
      void handleSandboxRequest(pluginId, worker, data);
      return;
    }

    if (data.type === 'runtimeError') {
      console.error(`[Plugin sandbox] ${data.pluginId}: ${data.message}`);
      if (data.stack) {
        console.error(data.stack);
      }
      return;
    }

    if (data.type === 'ready') {
      console.log(`[Plugin sandbox] ${data.pluginId} ready`);
    }
  });

  worker.addEventListener('error', (event) => {
    console.error(`[Plugin sandbox] ${pluginId} worker error`, event.error || event.message);
  });

  worker.postMessage({ type: 'init', pluginId, entry });
  pluginSandboxWorkers.set(pluginId, worker);
};

export const unmountSandboxedPlugin = (pluginId: string) => {
  const worker = pluginSandboxWorkers.get(pluginId);
  if (worker) {
    try {
      worker.postMessage({ type: 'destroy' });
    } finally {
      worker.terminate();
    }
  }

  pluginSandboxWorkers.delete(pluginId);
  pluginSandboxPermissions.delete(pluginId);
  unregisterSandboxPluginCommands(pluginId);
};

const registerPluginCleanup = (pluginId: string, cleanup: () => void | Promise<void>) => {
  if (!pluginId || typeof cleanup !== 'function') {
    return () => {};
  }

  const existing = pluginCleanupHandlers.get(pluginId) ?? new Set<() => void | Promise<void>>();
  existing.add(cleanup);
  pluginCleanupHandlers.set(pluginId, existing);

  return () => {
    const handlers = pluginCleanupHandlers.get(pluginId);
    if (!handlers) return;
    handlers.delete(cleanup);
    if (handlers.size === 0) {
      pluginCleanupHandlers.delete(pluginId);
    }
  };
};

export const runPluginCleanup = async (pluginId: string) => {
  unmountSandboxedPlugin(pluginId);

  const handlers = Array.from(pluginCleanupHandlers.get(pluginId) ?? []);

  for (const handler of handlers) {
    try {
      await handler();
    } catch (error) {
      console.error(`[Plugin cleanup] ${pluginId} failed:`, error);
    }
  }

  pluginCleanupHandlers.delete(pluginId);
  slotsContextRef?.unregisterAllPluginSlots?.(pluginId);
  useStore.getState().unregisterPluginCommands(pluginId);
};

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

export const injectPluginSDK = (slotsCtx: SlotsContextLike) => {
  slotsContextRef = slotsCtx;

  // We create a global object `TypistAPI` that third-party JS can access.
  window.TypistAPI = {
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
        if (!isSlotPosition(position)) {
          throw new Error(`invalid slot position: ${position}`);
        }
        slotsCtx.registerSlot(position, pluginId, id, component);
      },
      unregisterSlot: (position: string, pluginId: string, id: string) => {
        if (!isSlotPosition(position)) {
          throw new Error(`invalid slot position: ${position}`);
        }
        slotsCtx.unregisterSlot(position, pluginId, id);
      },
      unregisterAllSlots: (pluginId: string) => {
        slotsCtx.unregisterAllPluginSlots(pluginId);
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

    // 5. Plugin Lifecycle Cleanup
    lifecycle: {
      registerCleanup: (pluginId: string, cleanup: () => void | Promise<void>) => {
        return registerPluginCleanup(pluginId, cleanup);
      },
      runCleanup: async (pluginId: string) => runPluginCleanup(pluginId),
    },

    // 6. Backend IPC via permissions
    backend: {
      // Plugins should use this. The backend `plugin_permission_check_cmd` acts as a guard.
      // This MVP SDK just exposes safe wrapper methods.
      emitEvent: async (pluginId: string, event: string, payload: unknown) => {
        return await api.emitPluginEvent(pluginId, event, JSON.stringify(payload));
      },
      pasteImage: async (base64Data: string, mimeType: string) => {
        return await api.pasteImage({ base64_data: base64Data, mime_type: mimeType });
      }
    },

    // 7. Utilities
    React: React
  };
};

export const removePluginSDK = () => {
  Array.from(pluginSandboxWorkers.keys()).forEach((pluginId) => {
    unmountSandboxedPlugin(pluginId);
  });
  const pluginIds = Array.from(pluginCleanupHandlers.keys());
  pluginIds.forEach((pluginId) => {
    void runPluginCleanup(pluginId);
  });
  pluginCleanupHandlers.clear();
  pluginCommandHandlers.clear();
  slotsContextRef = null;
  delete window.TypistAPI;
};
