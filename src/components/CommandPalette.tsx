import React, { useState, useEffect, useRef } from 'react';
import { FileNode } from '../utils/fs';
import { Command } from '../utils/commands';
import { FileText, Search, Terminal } from 'lucide-react';
import './CommandPalette.css';

interface CommandPaletteProps {
  isOpen: boolean;
  initialMode: 'files' | 'commands' | 'link';
  onClose: () => void;
  files: FileNode[];
  commands: Command[];
  onFileSelect: (file: FileNode) => void;
  hotkeys: Record<string, string>;
}

const formatHotkey = (hotkey: string) => {
  return hotkey
    .replace(/Cmd/ig, '⌘')
    .replace(/Ctrl/ig, '⌃')
    .replace(/Shift/ig, '⇧')
    .replace(/Alt/ig, '⌥')
    .replace(/\+/g, '');
};

const CommandPalette: React.FC<CommandPaletteProps> = ({ 
  isOpen, 
  initialMode, 
  onClose, 
  files, 
  commands, 
  onFileSelect,
  hotkeys
}) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'files' | 'commands' | 'link'>(initialMode);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen, initialMode]);

  // Handle prefix parsing
  const displayQuery = query;
  let activeMode = mode;
  let activeQuery = query;

  if (query.startsWith('>')) {
    activeMode = 'commands';
    activeQuery = query.substring(1).trimStart();
  }

  const filteredFiles = (activeMode === 'files' || activeMode === 'link')
    ? files.filter(f => f.name.toLowerCase().includes(activeQuery.toLowerCase()))
    : [];

  const filteredCommands = activeMode === 'commands'
    ? commands.filter(c => c.name.toLowerCase().includes(activeQuery.toLowerCase()))
    : [];

  const itemCount = (activeMode === 'files' || activeMode === 'link') ? filteredFiles.length : filteredCommands.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, itemCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if ((activeMode === 'files' || activeMode === 'link') && filteredFiles[selectedIndex]) {
        onFileSelect(filteredFiles[selectedIndex]);
        onClose();
      } else if (activeMode === 'commands' && filteredCommands[selectedIndex]) {
        const cmd = filteredCommands[selectedIndex];
        if (cmd.requiresInput) {
          // Switch to a visual component mode inside palette (future)
          // For now just execute
          cmd.action();
          onClose();
        } else {
          // Direct execution
          cmd.action();
          onClose();
        }
      }
    } else if (e.key === 'Backspace' && query === '') {
      // Revert mode if backspace on empty
      if (mode === 'commands') {
        setMode('files');
      }
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="palette-overlay" onClick={handleOverlayClick}>
      <div className="palette-modal">
        <div className="palette-search">
          {activeMode === 'commands' ? (
            <Terminal size={18} className="palette-icon" />
          ) : (
            <Search size={18} className="palette-icon" />
          )}
          <input 
            ref={inputRef}
            type="text" 
            placeholder={activeMode === 'commands' ? "Type a command..." : activeMode === 'link' ? "Search files to link..." : "Search files by name... (Type > for commands)"}
            value={displayQuery}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="palette-results">
          {(activeMode === 'files' || activeMode === 'link') && (
            filteredFiles.length > 0 ? (
              filteredFiles.map((file, index) => (
                <div 
                  key={file.path} 
                  className={`palette-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => {
                    onFileSelect(file);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <FileText size={14} className="palette-item-icon" />
                  <span className="palette-item-name">{file.name}</span>
                </div>
              ))
            ) : (
              <div className="palette-empty">No files found.</div>
            )
          )}

          {activeMode === 'commands' && (
            filteredCommands.length > 0 ? (
              filteredCommands.map((cmd, index) => {
                // Find hotkey
                const hotkeyEntry = Object.entries(hotkeys).find(([k]) => k === cmd.id);
                const hotkeyStr = hotkeyEntry ? hotkeyEntry[1] : '';

                return (
                  <div 
                    key={cmd.id} 
                    className={`palette-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={() => {
                      cmd.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <Terminal size={14} className="palette-item-icon" />
                    <span className="palette-item-name">{cmd.name}</span>
                    {hotkeyStr && <span className="palette-item-hotkey">{formatHotkey(hotkeyStr)}</span>}
                  </div>
                );
              })
            ) : (
              <div className="palette-empty">No commands found.</div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
