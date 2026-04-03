import { create, type StateCreator } from 'zustand';
import { api, type TabSummary, type EditorSettings, type WorkspaceNode, type PluginRuntime, type RecoveryDraftMeta } from '../api';
import { detectDefaultLanguage, isSupportedLanguage, LANGUAGE_STORAGE_KEY, type AppLanguage } from '../i18n';
import {
  DEFAULT_KEYBINDINGS,
  type CommandDefinition,
  getBuiltInCommands,
  mergeWithDefaultKeybindings,
  normalizeShortcut,
  UNBOUND_SHORTCUT,
} from '../commands/definitions';

const KEYBINDINGS_STORAGE_KEY = 'typist.keybindings.v1';
const BUILTIN_PLUGIN_STATE_KEY = 'typist.builtin_plugins.v1';
const EDITOR_VIEW_PREFS_STORAGE_KEY = 'typist.editor_view_prefs.v1';

const DEFAULT_BUILTIN_PLUGIN_STATE: Record<string, boolean> = {
  'dev.typist.builtin.wordcount': true,
  'dev.typist.builtin.advanced-render': true,
};

interface EditorViewPrefs {
  showLineNumbersForNonMd: boolean;
  openNonMdInSourceMode: boolean;
  showFloatingTextToolbar: boolean;
}

const DEFAULT_EDITOR_VIEW_PREFS: EditorViewPrefs = {
  showLineNumbersForNonMd: true,
  openNonMdInSourceMode: true,
  showFloatingTextToolbar: true,
};

interface PluginCommand {
  id: string;
  pluginId: string;
  label: string;
  category: string;
}

interface EditorDocumentSlice {
  tabs: TabSummary[];
  recentFiles: { path: string; last_opened_at: string }[];
  activeTabId: string | null;
  activeContent: string;
  tabContents: Record<string, string>;
  recoveryDrafts: RecoveryDraftMeta[];
  dirtyCloseTabId: string | null;
  pendingCloseQueue: string[];

  loadTabs: () => Promise<void>;
  loadRecentFiles: () => Promise<void>;
  openFile: (path: string) => Promise<string | undefined>;
  saveFile: (tabId: string) => Promise<void>;
  saveFileAs: (tabId: string) => Promise<void>;
  closeTab: (tabId: string) => Promise<void>;
  closeOtherTabs: (tabId: string) => Promise<void>;
  requestCloseTab: (tabId: string) => Promise<void>;
  cancelCloseDirtyTab: () => void;
  closeDirtyTabWithoutSave: () => Promise<void>;
  closeDirtyTabWithSave: () => Promise<void>;
  continuePendingCloseQueue: () => Promise<void>;
  switchTab: (tabId: string) => Promise<void>;
  setActiveContent: (content: string) => void;
  markTabDirty: (tabId: string, isDirty: boolean) => Promise<void>;
  loadRecoveryDrafts: () => Promise<void>;
}

interface PreferencesSlice {
  settings: EditorSettings | null;
  plugins: PluginRuntime[];
  keybindings: Record<string, string>;
  pluginCommands: PluginCommand[];
  builtInPluginState: Record<string, boolean>;
  showLineNumbersForNonMd: boolean;
  openNonMdInSourceMode: boolean;
  showFloatingTextToolbar: boolean;
  language: AppLanguage;

  loadSettings: () => Promise<void>;
  loadKeybindings: () => void;
  loadBuiltInPluginState: () => void;
  loadEditorViewPrefs: () => void;
  loadLanguage: () => void;
  setBuiltInPluginEnabled: (pluginId: string, enabled: boolean) => void;
  setShowLineNumbersForNonMd: (enabled: boolean) => void;
  setOpenNonMdInSourceMode: (enabled: boolean) => void;
  setShowFloatingTextToolbar: (enabled: boolean) => void;
  setLanguage: (language: AppLanguage) => void;
  updateKeybinding: (commandId: string, shortcut: string) => void;
  clearKeybinding: (commandId: string) => void;
  resetKeybindings: () => void;
  getCommandsForKeybinding: () => CommandDefinition[];
  registerPluginCommand: (command: PluginCommand) => void;
  unregisterPluginCommands: (pluginId: string) => void;
  loadPlugins: () => Promise<void>;
}

interface WorkspaceSlice {
  workspaceRoot: string | null;
  workspaceTree: WorkspaceNode | null;
  loadWorkspace: (path?: string) => Promise<void>;
}

interface UiSlice {
  isSourceMode: boolean;
  isSidebarOpen: boolean;
  isFindReplaceOpen: boolean;
  isPreferencesOpen: boolean;
  preferencesActiveTab: 'settings' | 'keybindings' | 'plugins';
  isGlobalSearchOpen: boolean;
  isExportOpen: boolean;
  sidebarWidth: number;

  setSidebarWidth: (width: number) => void;
  openPreferences: (tab?: 'settings' | 'keybindings' | 'plugins') => void;
  closePreferences: () => void;
  toggleSourceMode: () => void;
  toggleSidebar: () => void;
  toggleFindReplace: () => void;
  toggleGlobalSearch: () => void;
  toggleExport: () => void;
}

type EditorState = EditorDocumentSlice & PreferencesSlice & WorkspaceSlice & UiSlice;
type StoreSlice<TSlice> = StateCreator<EditorState, [], [], TSlice>;

const createEditorDocumentSlice: StoreSlice<EditorDocumentSlice> = (set, get) => ({
  tabs: [],
  recentFiles: [],
  activeTabId: null,
  activeContent: '',
  tabContents: {},
  recoveryDrafts: [],
  dirtyCloseTabId: null,
  pendingCloseQueue: [],

  loadTabs: async () => {
    try {
      const tabs = await api.listTabs();
      const activeTab = tabs.find(t => t.is_active);
      const { tabContents, activeContent } = get();
      set({
        tabs,
        activeTabId: activeTab ? activeTab.tab_id : null,
        activeContent: activeTab
          ? tabContents[activeTab.tab_id] ?? activeContent
          : '',
      });
    } catch (e) {
      console.error('Failed to load tabs:', e);
    }
  },

  loadRecentFiles: async () => {
    try {
      const recentFiles = await api.listRecentFiles();
      set({ recentFiles });
    } catch (e) {
      console.error('Failed to load recent files:', e);
    }
  },

  openFile: async (path: string) => {
    try {
      const { tab, content } = await api.openFile(path);
      set((state) => ({
        activeContent: content,
        tabContents: {
          ...state.tabContents,
          [tab.tab_id]: content,
        },
      }));
      await get().loadTabs();
      return tab.tab_id;
    } catch (e) {
      console.error('Failed to open file:', e);
      return undefined;
    }
  },

  saveFile: async (tabId: string) => {
    try {
      const state = get();
      const content = state.tabContents[tabId] ?? (state.activeTabId === tabId ? state.activeContent : '');
      await api.saveFile(tabId, content);
      await get().loadTabs();
      await get().markTabDirty(tabId, false);
    } catch (e) {
      console.error('Failed to save file:', e);
    }
  },

  saveFileAs: async (tabId: string) => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const targetPath = await save({ filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }] });
      if (targetPath) {
        const state = get();
        const content =
          state.tabContents[tabId] ?? (state.activeTabId === tabId ? state.activeContent : '');
        await api.saveFileAs(tabId, targetPath, content);
        await get().loadTabs();
        await get().markTabDirty(tabId, false);
      }
    } catch (e) {
      console.error('Failed to save file as:', e);
    }
  },

  closeTab: async (tabId: string) => {
    try {
      await api.closeTab(tabId);
      set((state) => {
        const nextContents = { ...state.tabContents };
        delete nextContents[tabId];
        return {
          tabContents: nextContents,
          dirtyCloseTabId: state.dirtyCloseTabId === tabId ? null : state.dirtyCloseTabId,
          pendingCloseQueue: state.pendingCloseQueue.filter((id) => id !== tabId),
        };
      });
      await get().loadTabs();
    } catch (e) {
      console.error('Failed to close tab:', e);
    }
  },

  closeOtherTabs: async (tabId: string) => {
    const tabIds = get().tabs.map(t => t.tab_id).filter(id => id !== tabId);
    set({ pendingCloseQueue: tabIds });
    await get().continuePendingCloseQueue();
  },

  requestCloseTab: async (tabId: string) => {
    const tab = get().tabs.find(t => t.tab_id === tabId);
    if (!tab) return;

    if (tab.is_dirty) {
      set({ dirtyCloseTabId: tabId });
      return;
    }

    await get().closeTab(tabId);
  },

  cancelCloseDirtyTab: () => set({ dirtyCloseTabId: null, pendingCloseQueue: [] }),

  closeDirtyTabWithoutSave: async () => {
    const tabId = get().dirtyCloseTabId;
    if (!tabId) return;
    await get().closeTab(tabId);
    set({ dirtyCloseTabId: null });
    await get().continuePendingCloseQueue();
  },

  closeDirtyTabWithSave: async () => {
    const tabId = get().dirtyCloseTabId;
    if (!tabId) return;
    await get().saveFile(tabId);
    await get().closeTab(tabId);
    set({ dirtyCloseTabId: null });
    await get().continuePendingCloseQueue();
  },

  continuePendingCloseQueue: async () => {
    while (true) {
      const state = get();
      if (state.dirtyCloseTabId) return;
      if (state.pendingCloseQueue.length === 0) return;

      const [nextId, ...rest] = state.pendingCloseQueue;
      set({ pendingCloseQueue: rest });

      const tab = get().tabs.find(t => t.tab_id === nextId);
      if (!tab) {
        continue;
      }

      if (tab.is_dirty) {
        set({ dirtyCloseTabId: nextId });
        return;
      }

      await get().closeTab(nextId);
    }
  },

  switchTab: async (tabId: string) => {
    try {
      const target = get().tabs.find((tab) => tab.tab_id === tabId);
      let nextContent = get().tabContents[tabId];

      if (nextContent === undefined && target) {
        const opened = await api.openFile(target.path);
        nextContent = opened.content;
        set((state) => ({
          tabContents: {
            ...state.tabContents,
            [opened.tab.tab_id]: opened.content,
          },
        }));
      } else {
        await api.switchTab(tabId);
      }

      await get().loadTabs();
      set({ activeContent: nextContent ?? '' });
    } catch (e) {
      console.error('Failed to switch tab:', e);
    }
  },

  setActiveContent: (content: string) =>
    set((state) => {
      if (!state.activeTabId) {
        return { activeContent: content };
      }

      return {
        activeContent: content,
        tabContents: {
          ...state.tabContents,
          [state.activeTabId]: content,
        },
      };
    }),

  markTabDirty: async (tabId: string, isDirty: boolean) => {
    try {
      await api.markTabDirty(tabId, isDirty);
      set((state) => ({
        tabs: state.tabs.map(tab => 
          tab.tab_id === tabId ? { ...tab, is_dirty: isDirty } : tab
        )
      }));
    } catch (e) {
      console.error('Failed to mark tab dirty:', e);
    }
  },

  loadRecoveryDrafts: async () => {
    try {
      const recoveryDrafts = await api.listRecoveryDrafts();
      set({ recoveryDrafts });
    } catch (e) {
      console.error('Failed to load recovery drafts:', e);
    }
  },

});

const createPreferencesSlice: StoreSlice<PreferencesSlice> = (set, get) => ({
  settings: null,
  plugins: [],
  keybindings: { ...DEFAULT_KEYBINDINGS },
  pluginCommands: [],
  builtInPluginState: { ...DEFAULT_BUILTIN_PLUGIN_STATE },
  showLineNumbersForNonMd: DEFAULT_EDITOR_VIEW_PREFS.showLineNumbersForNonMd,
  openNonMdInSourceMode: DEFAULT_EDITOR_VIEW_PREFS.openNonMdInSourceMode,
  showFloatingTextToolbar: DEFAULT_EDITOR_VIEW_PREFS.showFloatingTextToolbar,
  language: detectDefaultLanguage(),

  loadSettings: async () => {
    try {
      const settings = await api.getSettings();
      const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isSupportedLanguage(storedLanguage)) {
        set({ settings, language: storedLanguage });

        if (settings.language !== storedLanguage) {
          void api.updateSettings({ language: storedLanguage }).catch((error) => {
            console.error('Failed to sync language setting on boot:', error);
          });
        }
      } else {
        set({ settings, language: settings.language });
        localStorage.setItem(LANGUAGE_STORAGE_KEY, settings.language);
      }

      if (settings.theme !== 'system') {
        document.documentElement.setAttribute('data-theme', settings.theme);
      } else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  },

  loadKeybindings: () => {
    try {
      const stored = localStorage.getItem(KEYBINDINGS_STORAGE_KEY);
      if (!stored) {
        set({ keybindings: { ...DEFAULT_KEYBINDINGS } });
        return;
      }

      const parsed = JSON.parse(stored) as Record<string, string>;
      set({ keybindings: mergeWithDefaultKeybindings(parsed) });
    } catch (e) {
      console.error('Failed to load keybindings:', e);
      set({ keybindings: { ...DEFAULT_KEYBINDINGS } });
    }
  },

  loadBuiltInPluginState: () => {
    try {
      const stored = localStorage.getItem(BUILTIN_PLUGIN_STATE_KEY);
      if (!stored) {
        set({ builtInPluginState: { ...DEFAULT_BUILTIN_PLUGIN_STATE } });
        return;
      }

      const parsed = JSON.parse(stored) as Record<string, boolean>;
      set({
        builtInPluginState: {
          ...DEFAULT_BUILTIN_PLUGIN_STATE,
          ...parsed,
        },
      });
    } catch (e) {
      console.error('Failed to load built-in plugin state:', e);
      set({ builtInPluginState: { ...DEFAULT_BUILTIN_PLUGIN_STATE } });
    }
  },

  loadEditorViewPrefs: () => {
    try {
      const stored = localStorage.getItem(EDITOR_VIEW_PREFS_STORAGE_KEY);
      if (!stored) {
        set({ ...DEFAULT_EDITOR_VIEW_PREFS });
        return;
      }

      const parsed = JSON.parse(stored) as Partial<EditorViewPrefs>;
      set({
        showLineNumbersForNonMd: parsed.showLineNumbersForNonMd ?? DEFAULT_EDITOR_VIEW_PREFS.showLineNumbersForNonMd,
        openNonMdInSourceMode: parsed.openNonMdInSourceMode ?? DEFAULT_EDITOR_VIEW_PREFS.openNonMdInSourceMode,
        showFloatingTextToolbar:
          parsed.showFloatingTextToolbar ?? DEFAULT_EDITOR_VIEW_PREFS.showFloatingTextToolbar,
      });
    } catch (e) {
      console.error('Failed to load editor view prefs:', e);
      set({ ...DEFAULT_EDITOR_VIEW_PREFS });
    }
  },

  loadLanguage: () => {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isSupportedLanguage(stored)) {
        set({ language: stored });
        return;
      }

      set({ language: detectDefaultLanguage() });
    } catch (e) {
      console.error('Failed to load language:', e);
      set({ language: detectDefaultLanguage() });
    }
  },

  setBuiltInPluginEnabled: (pluginId: string, enabled: boolean) => {
    set((state) => {
      const next = {
        ...state.builtInPluginState,
        [pluginId]: enabled,
      };

      localStorage.setItem(BUILTIN_PLUGIN_STATE_KEY, JSON.stringify(next));
      return { builtInPluginState: next };
    });
  },

  setShowLineNumbersForNonMd: (enabled: boolean) => {
    set((state) => {
      const next = {
        showLineNumbersForNonMd: enabled,
        openNonMdInSourceMode: state.openNonMdInSourceMode,
        showFloatingTextToolbar: state.showFloatingTextToolbar,
      };
      localStorage.setItem(EDITOR_VIEW_PREFS_STORAGE_KEY, JSON.stringify(next));
      return { showLineNumbersForNonMd: enabled };
    });
  },

  setOpenNonMdInSourceMode: (enabled: boolean) => {
    set((state) => {
      const next = {
        showLineNumbersForNonMd: state.showLineNumbersForNonMd,
        openNonMdInSourceMode: enabled,
        showFloatingTextToolbar: state.showFloatingTextToolbar,
      };
      localStorage.setItem(EDITOR_VIEW_PREFS_STORAGE_KEY, JSON.stringify(next));
      return { openNonMdInSourceMode: enabled };
    });
  },

  setShowFloatingTextToolbar: (enabled: boolean) => {
    set((state) => {
      const next = {
        showLineNumbersForNonMd: state.showLineNumbersForNonMd,
        openNonMdInSourceMode: state.openNonMdInSourceMode,
        showFloatingTextToolbar: enabled,
      };
      localStorage.setItem(EDITOR_VIEW_PREFS_STORAGE_KEY, JSON.stringify(next));
      return { showFloatingTextToolbar: enabled };
    });
  },

  setLanguage: (language: AppLanguage) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    set({ language });
    void api.updateSettings({ language }).catch((error) => {
      console.error('Failed to sync language setting:', error);
    });
  },

  updateKeybinding: (commandId: string, shortcut: string) => {
    const normalized = normalizeShortcut(shortcut);
    if (!normalized) return;

    set((state) => {
      const next = { ...state.keybindings };

      Object.keys(next).forEach((key) => {
        if (next[key] === normalized) {
          next[key] = '';
        }
      });

      next[commandId] = normalized;
      const storagePayload: Record<string, string> = {};
      Object.keys(next).forEach((id) => {
        storagePayload[id] = next[id] || UNBOUND_SHORTCUT;
      });

      localStorage.setItem(KEYBINDINGS_STORAGE_KEY, JSON.stringify(storagePayload));
      return { keybindings: next };
    });
  },

  clearKeybinding: (commandId: string) => {
    set((state) => {
      const next = { ...state.keybindings, [commandId]: '' };
      const storagePayload: Record<string, string> = {};

      Object.keys(next).forEach((id) => {
        storagePayload[id] = next[id] || UNBOUND_SHORTCUT;
      });

      localStorage.setItem(KEYBINDINGS_STORAGE_KEY, JSON.stringify(storagePayload));
      return { keybindings: next };
    });
  },

  resetKeybindings: () => {
    localStorage.setItem(KEYBINDINGS_STORAGE_KEY, JSON.stringify(DEFAULT_KEYBINDINGS));
    set({ keybindings: { ...DEFAULT_KEYBINDINGS } });
  },

  getCommandsForKeybinding: () => {
    const pluginCommands = get().pluginCommands.map((cmd) => ({
      id: cmd.id,
      label: cmd.label,
      category: cmd.category,
      pluginId: cmd.pluginId,
    }));

    return [...getBuiltInCommands(), ...pluginCommands];
  },

  registerPluginCommand: (command: PluginCommand) => {
    set((state) => {
      if (state.pluginCommands.some((item) => item.id === command.id)) {
        return state;
      }

      return { pluginCommands: [...state.pluginCommands, command] };
    });
  },

  unregisterPluginCommands: (pluginId: string) => {
    set((state) => {
      const removedIds = new Set(
        state.pluginCommands
          .filter((cmd) => cmd.pluginId === pluginId)
          .map((cmd) => cmd.id),
      );

      const nextBindings = { ...state.keybindings };
      removedIds.forEach((id) => {
        delete nextBindings[id];
      });

      localStorage.setItem(KEYBINDINGS_STORAGE_KEY, JSON.stringify(nextBindings));

      return {
        pluginCommands: state.pluginCommands.filter((cmd) => cmd.pluginId !== pluginId),
        keybindings: nextBindings,
      };
    });
  },

  loadPlugins: async () => {
    try {
      const plugins = await api.listPlugins();
      set({ plugins });
    } catch (e) {
      console.error('Failed to load plugins:', e);
    }
  },
});

const createWorkspaceSlice: StoreSlice<WorkspaceSlice> = (set) => ({
  workspaceRoot: null,
  workspaceTree: null,

  loadWorkspace: async (path?: string) => {
    try {
      if (path) {
        const res = await api.openWorkspace(path);
        set({ workspaceRoot: res.root_path, workspaceTree: res.tree });
      } else {
        const root = await api.getWorkspacePath();
        if (root) {
          const res = await api.openWorkspace(root);
          set({ workspaceRoot: res.root_path, workspaceTree: res.tree });
        }
      }
    } catch (e) {
      console.error('Failed to load workspace:', e);
    }
  },
});

const createUiSlice: StoreSlice<UiSlice> = (set) => ({
  isSourceMode: false,
  isSidebarOpen: false,
  isFindReplaceOpen: false,
  isPreferencesOpen: false,
  preferencesActiveTab: 'settings',
  isGlobalSearchOpen: false,
  isExportOpen: false,
  sidebarWidth: 260,

  setSidebarWidth: (width: number) => {
    const clamped = Math.min(480, Math.max(180, width));
    set({ sidebarWidth: clamped });
  },

  openPreferences: (tab = 'settings') => set({ isPreferencesOpen: true, preferencesActiveTab: tab }),
  closePreferences: () => set({ isPreferencesOpen: false }),
  toggleSourceMode: () => set(state => ({ isSourceMode: !state.isSourceMode })),
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleFindReplace: () => set(state => ({ isFindReplaceOpen: !state.isFindReplaceOpen })),
  toggleGlobalSearch: () => set(state => ({ isGlobalSearchOpen: !state.isGlobalSearchOpen })),
  toggleExport: () => set(state => ({ isExportOpen: !state.isExportOpen }))
});

export const useStore = create<EditorState>()((...sliceArgs) => ({
  ...createEditorDocumentSlice(...sliceArgs),
  ...createPreferencesSlice(...sliceArgs),
  ...createWorkspaceSlice(...sliceArgs),
  ...createUiSlice(...sliceArgs),
}));
