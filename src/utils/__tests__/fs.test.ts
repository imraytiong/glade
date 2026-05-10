import { describe, it, expect, vi } from 'vitest';
import { flattenFiles, FileNode, readVaultRecursive } from '../fs';
import * as fsPlugin from '@tauri-apps/plugin-fs';

vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn(),
}));

describe('fs utils', () => {
  it('should readVaultRecursive successfully', async () => {
    vi.mocked(fsPlugin.readDir).mockImplementation(async (path) => {
      if (path === '/vault') {
        return [
          { name: 'folder1', isDirectory: true, isFile: false, isSymlink: false },
          { name: 'file1.md', isDirectory: false, isFile: true, isSymlink: false },
          { name: '.hidden', isDirectory: false, isFile: true, isSymlink: false }
        ];
      } else if (path === '/vault/folder1') {
        return [
          { name: 'subfile.md', isDirectory: false, isFile: true, isSymlink: false }
        ];
      }
      return [];
    });

    const result = await readVaultRecursive('/vault');
    expect(result.length).toBe(2); // folder1, file1.md (hidden ignored)
    
    // Sort logic makes folder1 come first
    expect(result[0].name).toBe('folder1');
    expect(result[0].isDirectory).toBe(true);
    expect(result[0].children?.length).toBe(1);
    expect(result[0].children?.[0].name).toBe('subfile.md');
    
    expect(result[1].name).toBe('file1.md');
    expect(result[1].isDirectory).toBe(false);
  });

  it('should handle readVaultRecursive errors', async () => {
    vi.mocked(fsPlugin.readDir).mockRejectedValue(new Error('Permission denied'));
    const result = await readVaultRecursive('/vault-error');
    expect(result).toEqual([]);
  });

  it('should flatten nested file trees correctly', () => {
    const tree: FileNode[] = [
      {
        name: 'folder1',
        path: '/folder1',
        isDirectory: true,
        children: [
          { name: 'file1.md', path: '/folder1/file1.md', isDirectory: false },
        ]
      },
      {
        name: 'file2.md',
        path: '/file2.md',
        isDirectory: false
      }
    ];

    const flat = flattenFiles(tree);
    expect(flat.length).toBe(2);
    expect(flat.map(f => f.name)).toEqual(['file1.md', 'file2.md']);
  });

  it('should handle empty trees', () => {
    expect(flattenFiles([])).toEqual([]);
  });
});
