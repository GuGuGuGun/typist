export interface CommandDefinition {
  id: string;
  label: string;
  category: string;
  pluginId?: string;
}

export const UNBOUND_SHORTCUT = '__UNBOUND__';

export const BUILT_IN_COMMANDS: CommandDefinition[] = [
  { id: 'file.open', label: '打开文件', category: '文件' },
  { id: 'file.new', label: '新建文件', category: '文件' },
  { id: 'file.save', label: '保存', category: '文件' },
  { id: 'file.saveAs', label: '另存为', category: '文件' },
  { id: 'file.closeTab', label: '关闭标签', category: '文件' },
  { id: 'edit.find', label: '查找', category: '编辑' },
  { id: 'edit.replace', label: '替换', category: '编辑' },
  { id: 'edit.undo', label: '撤回', category: '编辑' },
  { id: 'edit.redo', label: '重做', category: '编辑' },
  { id: 'format.bold', label: '加粗', category: '格式' },
  { id: 'format.italic', label: '斜体', category: '格式' },
  { id: 'format.link', label: '插入链接', category: '格式' },
  { id: 'view.toggleSourceMode', label: '切换源码模式', category: '视图' },
  { id: 'view.toggleSidebar', label: '切换侧栏', category: '视图' },
  { id: 'search.global', label: '全局搜索', category: '搜索' },
];

export const DEFAULT_KEYBINDINGS: Record<string, string> = {
  'file.open': 'Ctrl+O',
  'file.new': 'Ctrl+N',
  'file.save': 'Ctrl+S',
  'file.saveAs': 'Ctrl+Shift+S',
  'file.closeTab': 'Ctrl+W',
  'edit.find': 'Ctrl+F',
  'edit.replace': 'Ctrl+H',
  'edit.undo': 'Ctrl+Z',
  'edit.redo': 'Ctrl+Shift+Z',
  'format.bold': 'Ctrl+B',
  'format.italic': 'Ctrl+I',
  'format.link': 'Ctrl+K',
  'view.toggleSourceMode': 'Ctrl+/',
  'view.toggleSidebar': 'Ctrl+Shift+O',
  'search.global': 'Ctrl+Shift+F',
};

export const getBuiltInCommands = () => BUILT_IN_COMMANDS;

export const normalizeShortcut = (value: string) => {
  const raw = value.trim();
  if (!raw) return '';

  const parts = raw
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === 'control' || lower === 'ctrl' || lower === 'cmd' || lower === 'meta') return 'Ctrl';
      if (lower === 'shift') return 'Shift';
      if (lower === 'alt' || lower === 'option') return 'Alt';
      if (lower === '/' || lower === 'slash') return '/';
      if (lower.length === 1) return lower.toUpperCase();
      if (lower.startsWith('f') && !Number.isNaN(Number(lower.slice(1)))) return lower.toUpperCase();
      return part.length > 1 ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : part.toUpperCase();
    });

  const mods: string[] = [];
  const keys: string[] = [];

  parts.forEach((part) => {
    if (part === 'Ctrl' || part === 'Shift' || part === 'Alt') {
      if (!mods.includes(part)) mods.push(part);
    } else {
      keys.push(part);
    }
  });

  return [...mods, ...keys].join('+');
};

export const eventToShortcut = (e: KeyboardEvent) => {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  let key = e.key;
  if (key === ' ') key = 'Space';
  if (key === 'Escape') key = 'Esc';
  if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') {
    return normalizeShortcut(parts.join('+'));
  }

  if (key.length === 1) {
    key = key === '/' ? '/' : key.toUpperCase();
  }

  return normalizeShortcut([...parts, key].join('+'));
};

export const mergeWithDefaultKeybindings = (custom: Record<string, string>) => {
  const merged = { ...DEFAULT_KEYBINDINGS, ...custom };
  const next: Record<string, string> = {};

  Object.keys(merged).forEach((commandId) => {
    if (merged[commandId] === UNBOUND_SHORTCUT) {
      next[commandId] = '';
      return;
    }

    const normalized = normalizeShortcut(merged[commandId] ?? '');
    next[commandId] = normalized;
  });

  return next;
};
