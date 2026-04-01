import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export const openNewAppWindow = async () => {
  const label = `typist-window-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const webview = new WebviewWindow(label, {
    url: '/',
    title: 'TauriTypist',
    decorations: false,
  });

  await new Promise<void>((resolve, reject) => {
    webview.once('tauri://created', () => resolve());
    webview.once('tauri://error', (error) => reject(error));
  });
};
