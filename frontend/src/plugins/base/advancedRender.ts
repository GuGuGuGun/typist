import { useStore } from '../../store';

const PLUGIN_ID = 'dev.typist.builtin.advanced-render';
const FLOATING_BUTTON_CLASS = 'floating-code-copy-btn';

interface TypistApiLike {
  editor: {
    insertTextAtCursor: (text: string) => void;
  };
  backend: {
    pasteImage: (base64Data: string, mimeType: string) => Promise<{ local_path: string }>;
  };
  commands: {
    registerCommand: (
      pluginId: string,
      commandKey: string,
      label: string,
      category: string,
      handler: () => void | Promise<void>,
    ) => void;
    unregisterCommands: (pluginId: string) => void;
  };
}

type AdvancedRenderWindow = Window & {
  TypistAPI?: TypistApiLike;
  __typistAdvancedRenderMounted?: boolean;
};

const appWindow = window as unknown as AdvancedRenderWindow;

const getEventElement = (event: Event) => {
  const rawTarget = event.target as Node | null;
  if (!rawTarget) return null;
  return rawTarget instanceof Element ? rawTarget : rawTarget.parentElement;
};

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || '');
      const base64 = data.includes(',') ? data.split(',')[1] : '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const insertImageMarkdown = (localPath: string, fileName: string) => {
  const typistApi = appWindow.TypistAPI;
  if (!typistApi) return;

  const alt = fileName.replace(/\.[^/.]+$/, '') || 'image';
  const markdown = `\n![${alt}](${localPath})\n`;
  typistApi.editor.insertTextAtCursor(markdown);
};

const getCodeBlockFromElement = (target: Element | null) => {
  if (!target) return null;
  return target.closest('.milkdown .ProseMirror pre') as HTMLElement | null;
};

const getCodeText = (pre: HTMLElement | null) => {
  if (!pre) return '';
  const code = pre.querySelector('code');
  return (code?.textContent ?? pre.textContent ?? '').trim();
};

export const mountAdvancedRenderPlugin = () => {
  if (appWindow.__typistAdvancedRenderMounted) {
    return;
  }

  const typistApi = appWindow.TypistAPI;
  if (!typistApi) {
    console.error('TypistAPI SDK not found. Cannot mount advanced-render plugin.');
    return;
  }

  appWindow.__typistAdvancedRenderMounted = true;

  let activeCodeBlock: HTMLElement | null = null;
  let moveRafId: number | null = null;

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = FLOATING_BUTTON_CLASS;
  copyBtn.textContent = '复制代码';
  copyBtn.style.display = 'none';
  document.body.appendChild(copyBtn);

  const hideCopyButton = () => {
    activeCodeBlock = null;
    copyBtn.style.display = 'none';
  };

  const positionCopyButton = () => {
    if (!activeCodeBlock) {
      hideCopyButton();
      return;
    }

    const rect = activeCodeBlock.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      hideCopyButton();
      return;
    }

    const margin = 8;
    const top = Math.max(8, rect.top + margin);
    const left = Math.max(8, rect.right - 88 - margin);

    copyBtn.style.top = `${Math.round(top)}px`;
    copyBtn.style.left = `${Math.round(left)}px`;
    copyBtn.style.display = 'inline-flex';
  };

  const schedulePosition = () => {
    if (moveRafId !== null) return;
    moveRafId = window.requestAnimationFrame(() => {
      moveRafId = null;
      positionCopyButton();
    });
  };

  const onMouseMove = (e: MouseEvent) => {
    const target = getEventElement(e);
    if (!target) {
      hideCopyButton();
      return;
    }

    if (useStore.getState().isSourceMode) {
      hideCopyButton();
      return;
    }

    const block = getCodeBlockFromElement(target);
    if (!block) {
      hideCopyButton();
      return;
    }

    activeCodeBlock = block;
    schedulePosition();
  };

  const onScrollOrResize = () => {
    if (!activeCodeBlock) return;
    schedulePosition();
  };

  copyBtn.addEventListener('mousedown', (e) => {
    // Keep the current editor selection stable when clicking the floating button.
    e.preventDefault();
  });

  copyBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const content = getCodeText(activeCodeBlock);
    if (!content) {
      copyBtn.textContent = '无可复制代码';
      window.setTimeout(() => {
        copyBtn.textContent = '复制代码';
      }, 1000);
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      copyBtn.textContent = '已复制';
    } catch {
      copyBtn.textContent = '复制失败';
    }

    window.setTimeout(() => {
      copyBtn.textContent = '复制代码';
    }, 1200);
  });

  const onClick = (e: MouseEvent) => {
    const target = getEventElement(e);
    if (!target) return;

    const mermaidHit = target.closest('.milkdown .mermaid, .milkdown svg[id^="mermaid"]');
    if (!mermaidHit) return;

    const state = useStore.getState();
    if (!state.isSourceMode) {
      state.toggleSourceMode();
    }
  };

  const onPaste = async (e: ClipboardEvent) => {
    const target = getEventElement(e);
    if (!target?.closest('.editor-area')) return;
    if (!useStore.getState().activeTabId) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    e.preventDefault();

    try {
      const base64 = await readFileAsBase64(file);
      const result = await typistApi.backend.pasteImage(base64, file.type);
      insertImageMarkdown(result.local_path, file.name || 'image');
    } catch (error) {
      console.error('Advanced render plugin paste image failed:', error);
    }
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize);
  document.addEventListener('click', onClick);
  document.addEventListener('paste', onPaste);

  typistApi.commands.registerCommand(
    PLUGIN_ID,
    'insert-time',
    '插入当前时间戳',
    '进阶渲染',
    () => {
      const now = new Date().toISOString();
      typistApi.editor.insertTextAtCursor(`\n${now}\n`);
    },
  );

  console.log('[Plugin] advanced-render loaded.');

  return () => {
    if (moveRafId !== null) {
      window.cancelAnimationFrame(moveRafId);
      moveRafId = null;
    }

    copyBtn.remove();
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize);
    document.removeEventListener('click', onClick);
    document.removeEventListener('paste', onPaste);
    typistApi.commands.unregisterCommands(PLUGIN_ID);
    appWindow.__typistAdvancedRenderMounted = false;
  };
};
