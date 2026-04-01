import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store';
import { eventToShortcut } from '../commands/definitions';

export const KeybindingModal: React.FC = () => {
  const isOpen = useStore(state => state.isKeybindingOpen);
  const toggleOpen = useStore(state => state.toggleKeybinding);
  const keybindings = useStore(state => state.keybindings);
  const getCommandsForKeybinding = useStore(state => state.getCommandsForKeybinding);
  const updateKeybinding = useStore(state => state.updateKeybinding);
  const clearKeybinding = useStore(state => state.clearKeybinding);
  const resetKeybindings = useStore(state => state.resetKeybindings);

  const [editingCommandId, setEditingCommandId] = useState<string | null>(null);
  const [draftShortcut, setDraftShortcut] = useState('');

  const commands = useMemo(() => getCommandsForKeybinding(), [getCommandsForKeybinding, keybindings]);

  if (!isOpen) return null;

  return (
    <div className="overlay-modal" onClick={toggleOpen}>
      <div className="dialog-card keybinding-card" onClick={(e) => e.stopPropagation()}>
        <div className="keybinding-header">
          <h3 className="dialog-title">按键绑定</h3>
          <button className="titlebar-btn" onClick={toggleOpen}>
            <X size={14} />
          </button>
        </div>

        <p className="dialog-desc">点击任意命令后直接按下组合键（如 Ctrl+Shift+P）。</p>

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
                  className="titlebar-btn"
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
                  className="titlebar-btn"
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

        <div className="dialog-actions">
          <button className="titlebar-btn" onClick={resetKeybindings}>恢复默认</button>
          <button className="command-btn active" onClick={toggleOpen}>完成</button>
        </div>
      </div>
    </div>
  );
};
