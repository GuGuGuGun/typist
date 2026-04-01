import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Titlebar } from './components/Titlebar';
import { Sidebar } from './components/Sidebar';
import { TabsBar } from './components/TabsBar';
import { EditorWrapper } from './components/Editor';
import { FindReplacePanel } from './components/FindReplacePanel';
import { GlobalSearchPanel } from './components/GlobalSearchPanel';
import { ExportModal } from './components/ExportModal';
import { RecoveryModal } from './components/RecoveryModal';
import { UpdaterModal } from './components/UpdaterModal';
import { PreferencesModal } from './components/PreferencesModal';
import { UnsavedClosePrompt } from './components/UnsavedClosePrompt';
import { PluginSlotsProvider, SlotRenderer, usePluginSlots } from './context/PluginSlots';
import { injectPluginSDK, removePluginSDK } from './sdk/TypistAPI';
import { mountWordCountPlugin } from './plugins/base/wordCount';
import { mountAdvancedRenderPlugin } from './plugins/base/advancedRender';
import { useStore } from './store';
import { useShortcuts } from './hooks/useShortcuts';
import { api } from './api';
import { formatExternalPromptMessage, getLocaleMessages } from './i18n';
import './index.css';

interface ExternalChangePrompt {
  tabId: string;
  path: string;
  title: string;
  snapshotKey: string;
  deletedExternally: boolean;
}

function AppContent() {
  const loadSettings = useStore(state => state.loadSettings);
  const loadTabs = useStore(state => state.loadTabs);
  const loadKeybindings = useStore(state => state.loadKeybindings);
  const loadBuiltInPluginState = useStore(state => state.loadBuiltInPluginState);
  const loadEditorViewPrefs = useStore(state => state.loadEditorViewPrefs);
  const loadLanguage = useStore(state => state.loadLanguage);
  const builtInPluginState = useStore(state => state.builtInPluginState);
  const isSidebarOpen = useStore(state => state.isSidebarOpen);
  const sidebarWidth = useStore(state => state.sidebarWidth);
  const setSidebarWidth = useStore(state => state.setSidebarWidth);
  const settings = useStore(state => state.settings);
  const language = useStore(state => state.language);
  const externalText = getLocaleMessages(language).externalPrompt;
  const wordCleanupRef = useRef<(() => void) | null>(null);
  const advancedCleanupRef = useRef<(() => void) | null>(null);
  const isAutosavingRef = useRef(false);
  const isCheckingExternalRef = useRef(false);
  const ignoredExternalSnapshotRef = useRef<Record<string, string>>({});
  const [externalPrompt, setExternalPrompt] = useState<ExternalChangePrompt | null>(null);

  const isWordCountEnabled = builtInPluginState['dev.typist.builtin.wordcount'] ?? true;
  const isAdvancedRenderEnabled = builtInPluginState['dev.typist.builtin.advanced-render'] ?? true;

  // Initialize global shortcuts
  useShortcuts();

  const pluginSlotsCtx = usePluginSlots();

  useEffect(() => {
    // Inject global SDK for plugins
    injectPluginSDK(pluginSlotsCtx);

    return () => {
      wordCleanupRef.current?.();
      advancedCleanupRef.current?.();
      wordCleanupRef.current = null;
      advancedCleanupRef.current = null;
      removePluginSDK();
    };
  }, []);

  useEffect(() => {
    let timer: number | null = null;

    if (isWordCountEnabled) {
      timer = window.setTimeout(() => {
        if (!wordCleanupRef.current) {
          const cleanup = mountWordCountPlugin();
          if (typeof cleanup === 'function') {
            wordCleanupRef.current = cleanup;
          }
        }
      }, 120);
    } else {
      wordCleanupRef.current?.();
      wordCleanupRef.current = null;
    }

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [isWordCountEnabled]);

  useEffect(() => {
    let timer: number | null = null;

    if (isAdvancedRenderEnabled) {
      timer = window.setTimeout(() => {
        if (!advancedCleanupRef.current) {
          const cleanup = mountAdvancedRenderPlugin();
          if (typeof cleanup === 'function') {
            advancedCleanupRef.current = cleanup;
          }
        }
      }, 120);
    } else {
      advancedCleanupRef.current?.();
      advancedCleanupRef.current = null;
    }

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [isAdvancedRenderEnabled]);

  useEffect(() => {
    // Initialize state from backend
    loadSettings();
    loadTabs();
    loadKeybindings();
    loadBuiltInPluginState();
    loadEditorViewPrefs();
    loadLanguage();
  }, [loadSettings, loadTabs, loadKeybindings, loadBuiltInPluginState, loadEditorViewPrefs, loadLanguage]);

  useEffect(() => {
    let disposed = false;

    const openLaunchFiles = async () => {
      try {
        const launchPaths = await api.getLaunchFilePaths();
        if (disposed || launchPaths.length === 0) {
          return;
        }

        for (const path of launchPaths) {
          await useStore.getState().openFile(path);
        }
      } catch (error) {
        console.error('Open launch files failed:', error);
      }
    };

    void openLaunchFiles();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    void listen<string[]>('app://open-files', async (event) => {
      const paths = event.payload ?? [];
      for (const path of paths) {
        await useStore.getState().openFile(path);
      }
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!settings?.autosave_enabled) {
      return;
    }

    const intervalSecs = Math.max(1, settings.autosave_interval_secs || 30);

    const runAutosave = async () => {
      if (externalPrompt) {
        return;
      }

      if (isAutosavingRef.current) {
        return;
      }

      const state = useStore.getState();
      const tabId = state.activeTabId;
      if (!tabId) {
        return;
      }

      const tab = state.tabs.find((item) => item.tab_id === tabId);
      if (!tab?.is_dirty) {
        return;
      }

      isAutosavingRef.current = true;
      try {
        await state.saveFile(tabId);
      } catch (error) {
        console.error('Autosave failed:', error);
      } finally {
        isAutosavingRef.current = false;
      }
    };

    const timer = window.setInterval(() => {
      void runAutosave();
    }, intervalSecs * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [settings?.autosave_enabled, settings?.autosave_interval_secs, externalPrompt]);

  useEffect(() => {
    const runRecoverySnapshot = async () => {
      const state = useStore.getState();
      const tabId = state.activeTabId;
      if (!tabId) {
        return;
      }

      const tab = state.tabs.find((item) => item.tab_id === tabId);
      if (!tab?.is_dirty) {
        return;
      }

      const content = state.tabContents[tabId] ?? state.activeContent;

      try {
        await api.saveRecoveryDraft({
          tab_id: tabId,
          source_path: tab.path || null,
          content,
        });
      } catch (error) {
        console.error('Save recovery draft failed:', error);
      }
    };

    const timer = window.setInterval(() => {
      void runRecoverySnapshot();
    }, 10000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (externalPrompt) {
      return;
    }

    let disposed = false;

    const runExternalCheck = async () => {
      if (disposed || externalPrompt || isCheckingExternalRef.current) {
        return;
      }

      const state = useStore.getState();
      const tabId = state.activeTabId;
      if (!tabId) {
        return;
      }

      const tab = state.tabs.find((item) => item.tab_id === tabId);
      if (!tab || tab.is_dirty) {
        return;
      }

      isCheckingExternalRef.current = true;
      try {
        const status = await api.checkExternalModification(tabId);

        if (!status.changed) {
          delete ignoredExternalSnapshotRef.current[tabId];
          return;
        }

        const snapshotKey = status.latest_snapshot
          ? `${status.latest_snapshot.modified_epoch_ms}:${status.latest_snapshot.size_bytes}:${status.latest_snapshot.content_hash}`
          : 'deleted';

        if (ignoredExternalSnapshotRef.current[tabId] === snapshotKey) {
          return;
        }

        setExternalPrompt({
          tabId,
          path: tab.path,
          title: tab.title,
          snapshotKey,
          deletedExternally: !status.latest_snapshot,
        });
      } catch (error) {
        console.error('Check external modification failed:', error);
      } finally {
        isCheckingExternalRef.current = false;
      }
    };

    void runExternalCheck();

    const timer = window.setInterval(() => {
      void runExternalCheck();
    }, 5000);

    const onFocus = () => {
      void runExternalCheck();
    };

    window.addEventListener('focus', onFocus);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [externalPrompt]);

  const keepCurrentVersion = () => {
    if (!externalPrompt) {
      return;
    }

    ignoredExternalSnapshotRef.current[externalPrompt.tabId] = externalPrompt.snapshotKey;
    setExternalPrompt(null);
  };

  const reloadFromDisk = async () => {
    if (!externalPrompt) {
      return;
    }

    const prompt = externalPrompt;
    setExternalPrompt(null);

    try {
      await useStore.getState().openFile(prompt.path);
      delete ignoredExternalSnapshotRef.current[prompt.tabId];
    } catch (error) {
      ignoredExternalSnapshotRef.current[prompt.tabId] = prompt.snapshotKey;
      console.error('Reload file after external change failed:', error);
    }
  };

  const beginResizeSidebar = (e: React.MouseEvent) => {
    e.preventDefault();

    const onMouseMove = (event: MouseEvent) => {
      setSidebarWidth(event.clientX);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      className="app-container"
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <Titlebar />

      <div className="app-main">
        <Sidebar />
        {isSidebarOpen && <div className="sidebar-resizer" onMouseDown={beginResizeSidebar} />}
        <div className={`editor-wrapper ${isSidebarOpen ? 'sidebar-open' : ''}`}>
          <TabsBar />
          <EditorWrapper />
          <FindReplacePanel />
        </div>
      </div>
      
      <div className="status-bar">
        <SlotRenderer position="status_bar_left" />
        <div className="status-spacer" />
        <div className="status-right">
          <SlotRenderer position="toolbar_right" />
          <span>Typist MVP</span>
          <SlotRenderer position="status_bar_right" />
        </div>
      </div>

      <GlobalSearchPanel />
      <PreferencesModal />
      <ExportModal />
      <RecoveryModal />
      <UpdaterModal />
      <UnsavedClosePrompt />

      {externalPrompt && (
        <div className="modal-overlay">
          <div className="modal-window" style={{ width: '460px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{externalText.title}</h3>
            </div>
            <div className="modal-content">
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                {formatExternalPromptMessage(language, externalPrompt.title, externalPrompt.deletedExternally)}
              </p>
            </div>
            <div className="modal-footer">
              <button className="default-btn" onClick={keepCurrentVersion}>{externalText.keepCurrentVersion}</button>
              {!externalPrompt.deletedExternally && (
                <button className="primary-btn active" onClick={() => void reloadFromDisk()}>
                  {externalText.reloadFromDisk}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <PluginSlotsProvider>
      <AppContent />
    </PluginSlotsProvider>
  );
}
