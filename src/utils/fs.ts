import { readDir } from '@tauri-apps/plugin-fs';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

export async function readVaultRecursive(dirPath: string): Promise<FileNode[]> {
  try {
    const entries = await readDir(dirPath);
    console.log(`readDir(${dirPath}) returned:`, entries);
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      // Ignore hidden files and .git, .obsidian folders
      if (entry.name && entry.name.startsWith('.')) {
        continue;
      }

      const nodePath = `${dirPath}/${entry.name}`;
      
      if (entry.isDirectory) {
        const children = await readVaultRecursive(nodePath);
        nodes.push({
          name: entry.name || 'Untitled',
          path: nodePath,
          isDirectory: true,
          children: children.sort((a, b) => a.name.localeCompare(b.name))
        });
      } else if (entry.isFile && entry.name?.endsWith('.md')) {
        nodes.push({
          name: entry.name,
          path: nodePath,
          isDirectory: false
        });
      }
    }

    // Sort: directories first, then files
    return nodes.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

  } catch (err) {
    console.error(`Failed to read directory at ${dirPath}`, err);
    return [];
  }
}
