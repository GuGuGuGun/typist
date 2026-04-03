import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type SlotPosition = 'sidebar_bottom' | 'status_bar_left' | 'status_bar_right' | 'toolbar_right';

interface SlotComponent {
  pluginId: string;
  id: string;
  component: React.FC;
}

interface PluginSlotsContextType {
  slots: Record<SlotPosition, SlotComponent[]>;
  registerSlot: (position: SlotPosition, pluginId: string, id: string, component: React.FC) => void;
  unregisterSlot: (position: SlotPosition, pluginId: string, id: string) => void;
  unregisterAllPluginSlots: (pluginId: string) => void;
}

const PluginSlotsContext = createContext<PluginSlotsContextType | null>(null);

export const PluginSlotsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [slots, setSlots] = useState<Record<SlotPosition, SlotComponent[]>>({
    sidebar_bottom: [],
    status_bar_left: [],
    status_bar_right: [],
    toolbar_right: [],
  });

  const registerSlot = (position: SlotPosition, pluginId: string, id: string, component: React.FC) => {
    setSlots(prev => {
      const currentPosSlots = prev[position];
      if (currentPosSlots.some(s => s.id === id && s.pluginId === pluginId)) return prev;
      return {
        ...prev,
        [position]: [...currentPosSlots, { pluginId, id, component }]
      };
    });
  };

  const unregisterSlot = (position: SlotPosition, pluginId: string, id: string) => {
    setSlots(prev => ({
      ...prev,
      [position]: prev[position].filter(s => !(s.pluginId === pluginId && s.id === id))
    }));
  };

  const unregisterAllPluginSlots = (pluginId: string) => {
    setSlots(prev => {
      const next = { ...prev };
      (Object.keys(next) as SlotPosition[]).forEach(pos => {
        next[pos] = next[pos].filter(s => s.pluginId !== pluginId);
      });
      return next;
    });
  };

  return (
    <PluginSlotsContext.Provider value={{ slots, registerSlot, unregisterSlot, unregisterAllPluginSlots }}>
      {children}
    </PluginSlotsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePluginSlots = () => {
  const ctx = useContext(PluginSlotsContext);
  if (!ctx) throw new Error("usePluginSlots must be used within PluginSlotsProvider");
  return ctx;
};

// Component to render slots for a specific position
export const SlotRenderer: React.FC<{ position: SlotPosition; style?: React.CSSProperties }> = ({ position, style }) => {
  const { slots } = usePluginSlots();
  const comps = slots[position] || [];
  
  if (comps.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...style }}>
      {comps.map(SlotItem => (
        <SlotItem.component key={`${SlotItem.pluginId}-${SlotItem.id}`} />
      ))}
    </div>
  );
};
