type ParentRequestAction =
  | 'getActiveFile'
  | 'getContent'
  | 'setContent'
  | 'insertText'
  | 'emitEvent'
  | 'pasteImage'
  | 'uiRegisterSlot'
  | 'uiUnregisterSlot'
  | 'uiUnregisterAllSlots';

type ParentRequestMessage = {
  type: 'request';
  id: number;
  action: ParentRequestAction;
  payload?: Record<string, unknown>;
};

type ParentResponseMessage = {
  type: 'response';
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
};

type WorkerInboundMessage =
  | { type: 'init'; pluginId: string; entry: string }
  | { type: 'executeCommand'; commandId: string }
  | { type: 'destroy' }
  | ParentResponseMessage;

type WorkerOutboundMessage =
  | ParentRequestMessage
  | {
      type: 'registerCommand';
      pluginId: string;
      commandId: string;
      label: string;
      category: string;
    }
  | { type: 'unregisterCommands'; pluginId: string }
  | { type: 'ready'; pluginId: string }
  | { type: 'runtimeError'; pluginId: string; message: string; stack?: string };

type CommandHandler = () => void | Promise<void>;
type CleanupHandler = () => void | Promise<void>;

const commandHandlers = new Map<string, CommandHandler>();
const cleanupHandlers = new Map<string, Set<CleanupHandler>>();

const pendingRequests = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }
>();

let currentPluginId = '';
let requestSeq = 1;

const postToParent = (message: WorkerOutboundMessage) => {
  self.postMessage(message);
};

const requestParent = (action: ParentRequestAction, payload?: Record<string, unknown>) => {
  const id = requestSeq++;
  const message: ParentRequestMessage = { type: 'request', id, action, payload };
  postToParent(message);

  return new Promise<unknown>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
  });
};

const registerCleanup = (pluginId: string, cleanup: CleanupHandler) => {
  if (!pluginId || typeof cleanup !== 'function') {
    return () => {};
  }

  const handlers = cleanupHandlers.get(pluginId) ?? new Set<CleanupHandler>();
  handlers.add(cleanup);
  cleanupHandlers.set(pluginId, handlers);

  return () => {
    const target = cleanupHandlers.get(pluginId);
    if (!target) return;
    target.delete(cleanup);
    if (target.size === 0) {
      cleanupHandlers.delete(pluginId);
    }
  };
};

const runCleanup = async (pluginId: string) => {
  const handlers = Array.from(cleanupHandlers.get(pluginId) ?? []);
  for (const handler of handlers) {
    try {
      await handler();
    } catch (error) {
      postToParent({
        type: 'runtimeError',
        pluginId,
        message: `cleanup failed: ${String(error)}`,
      });
    }
  }

  cleanupHandlers.delete(pluginId);
  postToParent({ type: 'unregisterCommands', pluginId });
};

const buildTypistApi = () => ({
  getActiveFile: async () => requestParent('getActiveFile'),
  editor: {
    getContent: async () => requestParent('getContent'),
    setContent: async (content: string) => requestParent('setContent', { content }),
    insertTextAtCursor: async (text: string) => requestParent('insertText', { text }),
  },
  ui: {
    registerSlot: async (position: string, pluginId: string, id: string) => {
      return requestParent('uiRegisterSlot', { position, pluginId, id });
    },
    unregisterSlot: async (position: string, pluginId: string, id: string) => {
      return requestParent('uiUnregisterSlot', { position, pluginId, id });
    },
    unregisterAllSlots: async (pluginId: string) => {
      return requestParent('uiUnregisterAllSlots', { pluginId });
    },
  },
  commands: {
    registerCommand: (
      pluginId: string,
      commandKey: string,
      label: string,
      category = '插件命令',
      handler?: CommandHandler,
    ) => {
      const commandId = `plugin.${pluginId}.${commandKey}`;
      if (handler) {
        commandHandlers.set(commandId, handler);
      }
      postToParent({ type: 'registerCommand', pluginId, commandId, label, category });
    },
    unregisterCommands: (pluginId: string) => {
      Array.from(commandHandlers.keys()).forEach((id) => {
        if (id.startsWith(`plugin.${pluginId}.`)) {
          commandHandlers.delete(id);
        }
      });
      postToParent({ type: 'unregisterCommands', pluginId });
    },
  },
  lifecycle: {
    registerCleanup: (pluginId: string, cleanup: CleanupHandler) => registerCleanup(pluginId, cleanup),
    runCleanup: (pluginId: string) => runCleanup(pluginId),
  },
  backend: {
    emitEvent: async (pluginId: string, event: string, payload: unknown) =>
      requestParent('emitEvent', { pluginId, event, payload }),
    pasteImage: async (base64Data: string, mimeType: string) =>
      requestParent('pasteImage', { base64Data, mimeType }),
  },
  React: null,
});

const globalScope = self as unknown as {
  window?: unknown;
  TypistAPI?: unknown;
};
globalScope.window = globalScope;
globalScope.TypistAPI = buildTypistApi();

const onResponse = (message: ParentResponseMessage) => {
  const pending = pendingRequests.get(message.id);
  if (!pending) return;

  pendingRequests.delete(message.id);
  if (message.ok) {
    pending.resolve(message.result);
    return;
  }

  pending.reject(new Error(message.error || 'unknown parent error'));
};

const onInit = async (pluginId: string, entry: string) => {
  currentPluginId = pluginId;

  try {
    await import(/* @vite-ignore */ entry);
    postToParent({ type: 'ready', pluginId });
  } catch (error) {
    postToParent({
      type: 'runtimeError',
      pluginId,
      message: `failed to load plugin entry: ${String(error)}`,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};

const onExecuteCommand = async (commandId: string) => {
  const handler = commandHandlers.get(commandId);
  if (!handler) return;

  try {
    await handler();
  } catch (error) {
    postToParent({
      type: 'runtimeError',
      pluginId: currentPluginId,
      message: `command execution failed: ${String(error)}`,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};

self.addEventListener('message', async (event: MessageEvent<WorkerInboundMessage>) => {
  const message = event.data;

  if (message.type === 'response') {
    onResponse(message);
    return;
  }

  if (message.type === 'init') {
    await onInit(message.pluginId, message.entry);
    return;
  }

  if (message.type === 'executeCommand') {
    await onExecuteCommand(message.commandId);
    return;
  }

  if (message.type === 'destroy') {
    if (currentPluginId) {
      await runCleanup(currentPluginId);
    }
    self.close();
  }
});
