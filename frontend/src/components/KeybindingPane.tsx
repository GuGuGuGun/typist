import React, { useState } from 'react';
import { useStore } from '../store';
import { eventToShortcut } from '../commands/definitions';

export const KeybindingPane: React.FC = () => {
  const keybindings = useStore(state => state.keybindings);
  const getCommandsForKeybinding = useStore(state => state.getCommandsForKeybinding);
  const updateKeybinding = useStore(state => state.updateKeybinding);
  const clearKeybinding = useStore(state => state.clearKeybinding);
  const resetKeybindings = useStore(state => state.resetKeybindings);

  const [editingCommandId, setEditingCommandId] = useState<string | null>(null);
  const [draftShortcut, setDraftShortcut] = useState('');

  const commands = getCommandsForKeybinding();

  return (
    <div className="preferences-pane-content">
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>点击任意命令后直接按下组合键（如 Ctrl+Shift+P）。</span>
        <button className="default-btn" onClick={resetKeybindings} style={{ padding: '4px 10px', fontSize: '12px' }}>恢复默认</button>
      </p>

      <div className="keybinding-list">
        {commands.map((command) => {
          const isEditing = editingCommandId === command.id;
          const current = keybindings[command.id] || '';
          const inputValue = isEditing ? draftShortcut : current;
          const conflictCommand = inputValue
            ? commands.find((item) => item.id !== command.id && (keybindings[item.id] || '') === inputValue)
            : undefined;

          return (
            <div
              key={command.id}
              className={`keybinding-row ${conflictCommand && isEditing ? 'conflict' : ''}`}
            >
              <div className="keybinding-meta">
                <span className="keybinding-label">{command.label}</span>
                <span className="keybinding-sub">{command.category}{command.pluginId ? ` · ${command.pluginId}` : ''}</span>
                {conflictCommand && isEditing && (
                  <span className="keybinding-conflict">
                    与「{conflictCommand.label}」冲突，应用后会自动覆盖旧绑定。
                  </span>
                )}
              </div>

              <input
                className="keybinding-input"
                value={inputValue}
                placeholder="未设置"
                onFocus={() => {
                  setEditingCommandId(command.id);
                  setDraftShortcut(current);
                }}
                onKeyDown={(e) => {
                  e.preventDefault();
                  const shortcut = eventToShortcut(e.nativeEvent);
                  setDraftShortcut(shortcut);
                }}
              />

              <button
                className="default-btn"
                style={{ padding: '0 8px', height: '26px', fontSize: '12px' }}
                onClick={() => {
                  if (!isEditing) {
                    setEditingCommandId(command.id);
                    setDraftShortcut(current);
                    return;
                  }
                  updateKeybinding(command.id, draftShortcut);
                  setEditingCommandId(null);
                }}
              >
                应用
              </button>

              <button
                className="default-btn"
                style={{ padding: '0 8px', height: '26px', fontSize: '12px' }}
                onClick={() => {
                  clearKeybinding(command.id);
                  if (editingCommandId === command.id) {
                    setDraftShortcut('');
                  }
                }}
              >
                清空
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
