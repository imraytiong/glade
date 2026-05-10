import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import CommandPalette from '../CommandPalette';
import { FileNode } from '../../utils/fs';
import { Command } from '../../utils/commands';

describe('CommandPalette', () => {
  const files: FileNode[] = [
    { name: 'file1.md', path: '/file1.md', isDirectory: false },
    { name: 'file2.md', path: '/file2.md', isDirectory: false },
  ];

  const commands: Command[] = [
    { id: 'cmd.1', name: 'Command 1', action: vi.fn() },
    { id: 'cmd.2', name: 'Command 2', action: vi.fn(), requiresInput: true },
  ];

  const hotkeys = {
    'cmd.1': 'Cmd+Shift+P'
  };

  test('renders files mode correctly', () => {
    render(
      <CommandPalette 
        isOpen={true} 
        initialMode="files" 
        onClose={vi.fn()} 
        files={files} 
        commands={commands} 
        onFileSelect={vi.fn()} 
        hotkeys={hotkeys} 
      />
    );
    expect(screen.getByPlaceholderText('Search files by name... (Type > for commands)')).toBeTruthy();
    expect(screen.getByText('file1.md')).toBeTruthy();
  });

  test('switches to command mode with >', () => {
    render(
      <CommandPalette 
        isOpen={true} 
        initialMode="files" 
        onClose={vi.fn()} 
        files={files} 
        commands={commands} 
        onFileSelect={vi.fn()} 
        hotkeys={hotkeys} 
      />
    );
    const input = screen.getByPlaceholderText('Search files by name... (Type > for commands)');
    fireEvent.change(input, { target: { value: '>com' } });
    
    expect(screen.getByText('Command 1')).toBeTruthy();
    expect(screen.getByText('⌘⇧P')).toBeTruthy(); // formatted hotkey
  });
  
  test('backspace on empty commands falls back to files', () => {
    render(
      <CommandPalette 
        isOpen={true} 
        initialMode="commands" 
        onClose={vi.fn()} 
        files={files} 
        commands={commands} 
        onFileSelect={vi.fn()} 
        hotkeys={hotkeys} 
      />
    );
    const input = screen.getByPlaceholderText('Type a command...');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Backspace' });

    expect(screen.getByPlaceholderText('Search files by name... (Type > for commands)')).toBeTruthy();
  });

  test('handles keyboard navigation and selection for files', () => {
    const onFileSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandPalette 
        isOpen={true} 
        initialMode="files" 
        onClose={onClose} 
        files={files} 
        commands={commands} 
        onFileSelect={onFileSelect} 
        hotkeys={hotkeys} 
      />
    );
    
    const input = screen.getByPlaceholderText('Search files by name... (Type > for commands)');
    
    // Arrow Down
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Arrow Up
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    // Enter
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onFileSelect).toHaveBeenCalledWith(files[0]);
    expect(onClose).toHaveBeenCalled();
  });

  test('handles keyboard navigation and selection for commands', () => {
    const onClose = vi.fn();
    render(
      <CommandPalette 
        isOpen={true} 
        initialMode="commands" 
        onClose={onClose} 
        files={files} 
        commands={commands} 
        onFileSelect={vi.fn()} 
        hotkeys={hotkeys} 
      />
    );
    
    const input = screen.getByPlaceholderText('Type a command...');
    
    // Arrow Down to second command
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Enter
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(commands[1].action).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('handles Escape key to close', () => {
    const onClose = vi.fn();
    render(
      <CommandPalette 
        isOpen={true} 
        initialMode="files" 
        onClose={onClose} 
        files={files} 
        commands={commands} 
        onFileSelect={vi.fn()} 
        hotkeys={hotkeys} 
      />
    );
    
    const input = screen.getByPlaceholderText('Search files by name... (Type > for commands)');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  test('clicking overlay closes palette', () => {
    const onClose = vi.fn();
    const { container } = render(
      <CommandPalette 
        isOpen={true} 
        initialMode="files" 
        onClose={onClose} 
        files={files} 
        commands={commands} 
        onFileSelect={vi.fn()} 
        hotkeys={hotkeys} 
      />
    );
    
    const overlay = container.querySelector('.palette-overlay');
    if (overlay) {
      fireEvent.click(overlay);
    }
    expect(onClose).toHaveBeenCalled();
  });
});
