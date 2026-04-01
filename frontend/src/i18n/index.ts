export type AppLanguage = 'zh' | 'en';

export const LANGUAGE_STORAGE_KEY = 'typist.language.v1';

type LocaleMessages = {
  settings: {
    languageLabel: string;
    languageZh: string;
    languageEn: string;
    themeLabel: string;
    themeSystem: string;
    themeLight: string;
    themeDark: string;
    autosaveLabel: string;
    autosaveDesc: string;
    showLineNumbersLabel: string;
    showLineNumbersDesc: string;
    openNonMdSourceLabel: string;
    openNonMdSourceDesc: string;
  };
  preferences: {
    title: string;
    general: string;
    keybindings: string;
    plugins: string;
    generalSettings: string;
    keyboardShortcuts: string;
    pluginMarketplace: string;
  };
  startup: {
    editorEmptyTitle: string;
    editorEmptyHint: string;
    openMethodsTitle: string;
    openFileLink: string;
    openFolderLink: string;
    recentEmpty: string;
    explorerTab: string;
    recentTab: string;
    randomCopies: string[];
  };
  titlebar: {
    sidebar: string;
    sidebarTitle: string;
    find: string;
    findTitle: string;
    search: string;
    searchTitle: string;
    newWindow: string;
    newWindowTitle: string;
    export: string;
    exportTitle: string;
    source: string;
    wysiwyg: string;
    sourceTitle: string;
    settings: string;
    settingsTitle: string;
    restoreWindow: string;
    maximizeWindow: string;
  };
  sidebar: {
    alertOpenWorkspaceFirst: string;
    promptRename: string;
    dirtyBeforeRename: string;
    renameFailedPrefix: string;
    dirtyBeforeDelete: string;
    confirmDelete: string;
    deleteFailedPrefix: string;
    dirtyBeforeMove: string;
    moveFailedPrefix: string;
    copyFailedPrefix: string;
    openFile: string;
    rename: string;
    moveTo: string;
    copyTo: string;
    delete: string;
    copyPath: string;
    openFolder: string;
    newFile: string;
    newFolder: string;
    refreshPanel: string;
    markdownFilterName: string;
  };
  editorMenu: {
    undo: string;
    redo: string;
    cut: string;
    copy: string;
    paste: string;
    selectAll: string;
    toggleSourceMode: string;
    pluginPrefix: string;
  };
  externalPrompt: {
    title: string;
    deleted: string;
    modified: string;
    deletedHint: string;
    modifiedHint: string;
    keepCurrentVersion: string;
    reloadFromDisk: string;
  };
};

const LOCALES: Record<AppLanguage, LocaleMessages> = {
  zh: {
    settings: {
      languageLabel: '语言',
      languageZh: '中文',
      languageEn: 'English',
      themeLabel: '主题',
      themeSystem: '跟随系统',
      themeLight: '浅色',
      themeDark: '深色',
      autosaveLabel: '启用自动保存',
      autosaveDesc: '在编辑过程中和关闭标签时自动保存文档。',
      showLineNumbersLabel: '非 Markdown 文档显示行号',
      showLineNumbersDesc: '对 txt、json 等源码文档在左侧显示行号和当前行高亮。',
      openNonMdSourceLabel: '非 Markdown 文档默认源码模式',
      openNonMdSourceDesc: '打开非 md 文件时自动使用源码编辑器，避免进入富文本模式。',
    },
    preferences: {
      title: '设置',
      general: '通用',
      keybindings: '快捷键',
      plugins: '插件',
      generalSettings: '通用设置',
      keyboardShortcuts: '键盘快捷键',
      pluginMarketplace: '插件市场',
    },
    startup: {
      editorEmptyTitle: '开始记录你的想法',
      editorEmptyHint: '按 Ctrl+O 打开文件，或从侧栏选择最近项目。',
      openMethodsTitle: '文档打开方式',
      openFileLink: '打开文件',
      openFolderLink: '打开文件夹',
      recentEmpty: '最近没有打开记录。',
      explorerTab: '资源管理',
      recentTab: '最近文件',
      randomCopies: [
        '今天写下的第一句话，往往决定一天的节奏。',
        '先写下粗糙版本，再慢慢雕刻成型。',
        '空白页不是阻力，它只是邀请你开场。',
        '把灵感先记住，结构可以稍后再整理。',
        '小步快写，比等待完美更可靠。',
      ],
    },
    titlebar: {
      sidebar: '侧栏',
      sidebarTitle: '切换侧栏 (Ctrl+Shift+O)',
      find: '查找',
      findTitle: '查找替换 (Ctrl+F / Ctrl+H)',
      search: '搜索',
      searchTitle: '全局搜索',
      newWindow: '新窗',
      newWindowTitle: '新建窗口 (Ctrl+Shift+N)',
      export: '导出',
      exportTitle: '导出',
      source: '源码',
      wysiwyg: '所见即所得',
      sourceTitle: '切换源码模式 (Ctrl+/)',
      settings: '设置',
      settingsTitle: '设置',
      restoreWindow: '还原窗口',
      maximizeWindow: '最大化',
    },
    sidebar: {
      alertOpenWorkspaceFirst: '请先打开一个工作区文件夹',
      promptRename: '请输入新名称',
      dirtyBeforeRename: '该文件存在未保存的打开标签，请先保存并关闭后再重命名。',
      renameFailedPrefix: '重命名失败',
      dirtyBeforeDelete: '该文件存在未保存的打开标签，请先保存并关闭后再删除。',
      confirmDelete: '确认删除该文件吗？',
      deleteFailedPrefix: '删除失败',
      dirtyBeforeMove: '该文件存在未保存的打开标签，请先保存并关闭后再移动。',
      moveFailedPrefix: '移动失败',
      copyFailedPrefix: '复制失败',
      openFile: '打开文件',
      rename: '重命名',
      moveTo: '移动到...',
      copyTo: '复制到...',
      delete: '删除',
      copyPath: '复制路径',
      openFolder: '打开文件夹',
      newFile: '新建文件',
      newFolder: '新建文件夹',
      refreshPanel: '刷新当前面板',
      markdownFilterName: 'Markdown',
    },
    editorMenu: {
      undo: '撤回',
      redo: '重做',
      cut: '剪切',
      copy: '复制',
      paste: '粘贴',
      selectAll: '全选',
      toggleSourceMode: '切换源码模式',
      pluginPrefix: '插件',
    },
    externalPrompt: {
      title: '检测到外部文件变更',
      deleted: '删除',
      modified: '修改',
      deletedHint: '你可以先保留当前标签，稍后手动处理。',
      modifiedHint: '请选择是否重新加载磁盘中的最新内容。',
      keepCurrentVersion: '保留当前版本',
      reloadFromDisk: '重新加载磁盘内容',
    },
  },
  en: {
    settings: {
      languageLabel: 'Language',
      languageZh: 'Chinese',
      languageEn: 'English',
      themeLabel: 'Theme',
      themeSystem: 'System Default',
      themeLight: 'Light',
      themeDark: 'Dark',
      autosaveLabel: 'Enable Autosave',
      autosaveDesc: 'Automatically saves your documents while editing and on tab close.',
      showLineNumbersLabel: 'Show line numbers for non-Markdown files',
      showLineNumbersDesc: 'Show line numbers and active-line highlight for txt/json and other source files.',
      openNonMdSourceLabel: 'Open non-Markdown files in source mode',
      openNonMdSourceDesc: 'Open non-md files in source editor by default to avoid rich-text mode.',
    },
    preferences: {
      title: 'Preferences',
      general: 'General',
      keybindings: 'Keybindings',
      plugins: 'Plugins',
      generalSettings: 'General Settings',
      keyboardShortcuts: 'Keyboard Shortcuts',
      pluginMarketplace: 'Plugin Marketplace',
    },
    startup: {
      editorEmptyTitle: 'Start capturing your ideas',
      editorEmptyHint: 'Press Ctrl+O to open a file, or pick one from the sidebar.',
      openMethodsTitle: 'Open a document by',
      openFileLink: 'Opening a file',
      openFolderLink: 'Opening a folder',
      recentEmpty: 'No recent files yet.',
      explorerTab: 'Explorer',
      recentTab: 'Recent',
      randomCopies: [
        'First draft first, polish later.',
        'A blank page is just a prompt waiting for your voice.',
        'Write one clear sentence, then the next one appears.',
        'Momentum beats perfection on day one.',
        'Capture the thought now; organize it after.',
      ],
    },
    titlebar: {
      sidebar: 'Sidebar',
      sidebarTitle: 'Toggle Sidebar (Ctrl+Shift+O)',
      find: 'Find',
      findTitle: 'Find and Replace (Ctrl+F / Ctrl+H)',
      search: 'Search',
      searchTitle: 'Global Search',
      newWindow: 'Window',
      newWindowTitle: 'New Window (Ctrl+Shift+N)',
      export: 'Export',
      exportTitle: 'Export',
      source: 'Source',
      wysiwyg: 'WYSIWYG',
      sourceTitle: 'Toggle Source Mode (Ctrl+/)',
      settings: 'Settings',
      settingsTitle: 'Settings',
      restoreWindow: 'Restore Window',
      maximizeWindow: 'Maximize',
    },
    sidebar: {
      alertOpenWorkspaceFirst: 'Please open a workspace folder first.',
      promptRename: 'Enter new name',
      dirtyBeforeRename: 'This file has unsaved open tabs. Please save and close them before renaming.',
      renameFailedPrefix: 'Rename failed',
      dirtyBeforeDelete: 'This file has unsaved open tabs. Please save and close them before deleting.',
      confirmDelete: 'Delete this file?',
      deleteFailedPrefix: 'Delete failed',
      dirtyBeforeMove: 'This file has unsaved open tabs. Please save and close them before moving.',
      moveFailedPrefix: 'Move failed',
      copyFailedPrefix: 'Copy failed',
      openFile: 'Open File',
      rename: 'Rename',
      moveTo: 'Move to...',
      copyTo: 'Copy to...',
      delete: 'Delete',
      copyPath: 'Copy Path',
      openFolder: 'Open Folder',
      newFile: 'New File',
      newFolder: 'New Folder',
      refreshPanel: 'Refresh Panel',
      markdownFilterName: 'Markdown',
    },
    editorMenu: {
      undo: 'Undo',
      redo: 'Redo',
      cut: 'Cut',
      copy: 'Copy',
      paste: 'Paste',
      selectAll: 'Select All',
      toggleSourceMode: 'Toggle Source Mode',
      pluginPrefix: 'Plugin',
    },
    externalPrompt: {
      title: 'External file change detected',
      deleted: 'deleted',
      modified: 'modified',
      deletedHint: 'You can keep the current tab for now and handle it later.',
      modifiedHint: 'Choose whether to reload the latest content from disk.',
      keepCurrentVersion: 'Keep Current Version',
      reloadFromDisk: 'Reload from Disk',
    },
  },
};

export const detectDefaultLanguage = (): AppLanguage => {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')) {
    return 'zh';
  }

  return 'en';
};

export const isSupportedLanguage = (value: string | null): value is AppLanguage => value === 'zh' || value === 'en';

export const getLocaleMessages = (language: AppLanguage): LocaleMessages => LOCALES[language] ?? LOCALES.zh;

export const pickRandomStartupCopy = (language: AppLanguage): string => {
  const lines = getLocaleMessages(language).startup.randomCopies;
  return lines[Math.floor(Math.random() * lines.length)] ?? lines[0];
};

export const formatExternalPromptMessage = (
  language: AppLanguage,
  title: string,
  deletedExternally: boolean,
): string => {
  const text = getLocaleMessages(language).externalPrompt;
  const hint = deletedExternally ? text.deletedHint : text.modifiedHint;

  if (language === 'zh') {
    const action = deletedExternally ? text.deleted : text.modified;
    return `${title} 在编辑器外被${action}。${hint}`;
  }

  const action = deletedExternally ? text.deleted : text.modified;
  return `${title} was ${action} outside the editor. ${hint}`;
};