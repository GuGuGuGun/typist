import { useEffect, useRef, type CSSProperties } from 'react';
import { Titlebar } from './components/Titlebar';
import { Sidebar } from './components/Sidebar';
import { TabsBar } from './components/TabsBar';
import { EditorWrapper } from './components/Editor';
import { FindReplacePanel } from './components/FindReplacePanel';
import { SettingsModal } from './components/SettingsModal';
import { KeybindingModal } from './components/KeybindingModal';
import { GlobalSearchPanel } from './components/GlobalSearchPanel';
import { ExportModal } from './components/ExportModal';
import { RecoveryModal } from './components/RecoveryModal';
import { UpdaterModal } from './components/UpdaterModal';
import { PluginManager } from './components/PluginManager';
import { UnsavedClosePrompt } from './components/UnsavedClosePrompt';
import { PluginSlotsProvider, SlotRenderer, usePluginSlots } from './context/PluginSlots';
import { injectPluginSDK, removePluginSDK } from './sdk/TypistAPI';
import { mountWordCountPlugin } from './plugins/base/wordCount';
import { mountAdvancedRenderPlugin } from './plugins/base/advancedRender';
import { useStore } from './store';
import { useShortcuts } from './hooks/useShortcuts';
import './index.css';

function AppContent() {
  const loadSettings = useStore(state => state.loadSettings);
  const loadTabs = useStore(state => state.loadTabs);
  const loadKeybindings = useStore(state => state.loadKeybindings);
  const loadBuiltInPluginState = useStore(state => state.loadBuiltInPluginState);
  const builtInPluginState = useStore(state => state.builtInPluginState);
  const isSidebarOpen = useStore(state => state.isSidebarOpen);
  const sidebarWidth = useStore(state => state.sidebarWidth);
  const setSidebarWidth = useStore(state => state.setSidebarWidth);
  const wordCleanupRef = useRef<(() => void) | null>(null);
  const advancedCleanupRef = useRef<(() => void) | null>(null);

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
  }, [loadSettings, loadTabs, loadKeybindings, loadBuiltInPluginState]);

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
      <SettingsModal />
      <KeybindingModal />
      <ExportModal />
      <RecoveryModal />
      <UpdaterModal />
      <PluginManager />
      <UnsavedClosePrompt />
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
