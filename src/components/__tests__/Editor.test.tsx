import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Editor from '../Editor';

// Mock tauri API
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path) => path)
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: vi.fn(() => ({
    onDragDropEvent: vi.fn().mockResolvedValue(vi.fn())
  }))
}));

// Mock Milkdown useEditor hook to prevent it from crashing the test environment
vi.mock('../useGladeEditor', () => ({
  useGladeEditor: vi.fn(() => ({ get: vi.fn() })),
}));

// Mock ResizeObserver for Milkdown
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Editor', () => {
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
