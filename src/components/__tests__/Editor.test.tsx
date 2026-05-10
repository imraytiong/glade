import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Editor from '../Editor';

// Mock settings
vi.mock('../../utils/settings', () => ({
  useSettings: () => ({
    settings: {
      lineNumbers: true,
      wordWrap: true,
      hotkeys: {}
    }
  })
}));

// Mock tauri API
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path) => path)
}));

describe('Editor', () => {
  it('renders correctly with given fileName', () => {
    const onSave = vi.fn();
    render(
      <Editor 
        initialContent="# Hello" 
        onSave={onSave} 
        fileName="test.md" 
        filePath="/test.md" 
      />
    );
    
    expect(screen.getByText('test.md')).toBeInTheDocument();
  });

  // Note: testing exact CodeMirror cursor position via react-testing-library
  // is quite difficult without a fully mocked DOM environment.
  // We rely on integration tests for precise cursor mechanics,
  // but we can verify the component accepts the prop without throwing.
  it('accepts initialCursorPos without crashing', () => {
    const onSave = vi.fn();
    const onCursorChange = vi.fn();
    
    expect(() => {
      render(
        <Editor 
          initialContent="Content" 
          onSave={onSave} 
          fileName="test2.md" 
          filePath="/test2.md" 
          initialCursorPos={4}
          onCursorChange={onCursorChange}
        />
      );
    }).not.toThrow();
  });
});
