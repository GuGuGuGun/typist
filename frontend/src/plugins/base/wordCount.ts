import React, { useEffect, useState } from 'react';

/**
 * Proof of Concept: Built-in Word Count Plugin
 * This demonstrates how external plugins will use the global `TypistAPI`
 * to interact with the environment.
 */
export const mountWordCountPlugin = () => {
  if ((window as any).__typistWordCountMounted) {
    return;
  }

  const api = (window as any).TypistAPI;
  if (!api) {
    console.error("TypistAPI SDK not found. Cannot mount plugin.");
    return;
  }

  (window as any).__typistWordCountMounted = true;

  const PLUGIN_ID = 'dev.typist.builtin.wordcount';
  const SLOT_POSITION = 'status_bar_right';
  const SLOT_ID = 'word-count-widget';

  const WordCountComponent: React.FC = () => {
    const [stats, setStats] = useState({ words: 0, chars: 0 });

    useEffect(() => {
      // In a real plugin, we would subscribe to an event bus.
      // For MVP, we'll just poll or rely on the host's active file state which is reactive if we were inside the context.
      // But since this is injected React code, it can use the global API.
      const updateStats = () => {
        const content = api.editor.getContent() || '';
        const words = content.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
        const chars = content.length;
        setStats({ words, chars });
      };

      updateStats();
      const interval = setInterval(updateStats, 1000);
      return () => clearInterval(interval);
    }, []);

    return React.createElement(
      'div',
      { style: { display: 'flex', gap: '8px', fontSize: '11px' } },
      React.createElement('span', null, `${stats.words} Words`),
      React.createElement('span', null, `${stats.chars} Chars`)
    );
  };

  // Register into the status bar slot
  api.ui.registerSlot(SLOT_POSITION, PLUGIN_ID, SLOT_ID, WordCountComponent);

  console.log(`[Plugin] ${PLUGIN_ID} loaded successfully.`);

  return () => {
    api.ui.unregisterSlot(SLOT_POSITION, PLUGIN_ID, SLOT_ID);
    (window as any).__typistWordCountMounted = false;
  };
};
