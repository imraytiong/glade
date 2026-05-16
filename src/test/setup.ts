import '@testing-library/jest-dom';
import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

HTMLElement.prototype.scrollIntoView = vi.fn();

// Emulate Tauri environment so our api wrapper uses the invoke mock instead of fetch
Object.defineProperty(window, '__TAURI_INTERNALS__', {
  value: {
    transformCallback: vi.fn(),
    invoke: vi.fn(),
  },
});

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((_cmd, _args) => {
    return Promise.resolve();
  }),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn().mockImplementation(async (path) => {
    if (path === '/vault') {
      return [
        { name: 'folder1', isDirectory: true, isFile: false, isSymlink: false },
        { name: 'file1.md', isDirectory: false, isFile: true, isSymlink: false },
      ];
    } else if (path === '/vault-error') {
      throw new Error('Failed to read directory at /vault-error');
    }
    return [];
  }),
  readTextFile: vi.fn().mockResolvedValue(''),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false),
  rename: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  copyFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn().mockReturnValue({
    listen: vi.fn().mockResolvedValue(vi.fn()),
    once: vi.fn().mockResolvedValue(vi.fn()),
    emit: vi.fn(),
  }),
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: vi.fn().mockReturnValue({
    listen: vi.fn().mockResolvedValue(vi.fn()),
    once: vi.fn().mockResolvedValue(vi.fn()),
    emit: vi.fn(),
    onDragDropEvent: vi.fn().mockResolvedValue(vi.fn()),
  }),
}));
