import * as tauriFs from '@tauri-apps/plugin-fs';
import { invoke } from './api';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function readDir(path: string, options?: any): Promise<{name?: string, isDirectory: boolean, isFile: boolean, isSymlink: boolean}[]> {
  if (isTauri) return tauriFs.readDir(path, options);
  return invoke('fs_read_dir', { path, options });
}

export async function readTextFile(path: string, options?: any): Promise<string> {
  if (isTauri) return tauriFs.readTextFile(path, options);
  return invoke('fs_read_text_file', { path, options });
}

export async function writeTextFile(path: string, contents: string, options?: any): Promise<void> {
  if (isTauri) return tauriFs.writeTextFile(path, contents, options);
  return invoke('fs_write_text_file', { path, contents, options });
}

export async function exists(path: string, options?: any): Promise<boolean> {
  if (isTauri) return tauriFs.exists(path, options);
  return invoke('fs_exists', { path, options });
}

export async function rename(oldPath: string, newPath: string, options?: any): Promise<void> {
  if (isTauri) return tauriFs.rename(oldPath, newPath, options);
  return invoke('fs_rename', { oldPath, newPath, options });
}

export async function remove(path: string, options?: any): Promise<void> {
  if (isTauri) return tauriFs.remove(path, options);
  return invoke('fs_remove', { path, options });
}

export async function mkdir(path: string, options?: any): Promise<void> {
  if (isTauri) return tauriFs.mkdir(path, options);
  return invoke('fs_mkdir', { path, options });
}

export async function copyFile(source: string, destination: string, options?: any): Promise<void> {
  if (isTauri) return tauriFs.copyFile(source, destination, options);
  return invoke('fs_copy_file', { source, destination, options });
}

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
      } else if (entry.isFile) {
        const isMarkdown = entry.name?.endsWith('.md');
        const isImage = entry.name?.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i);
        if (isMarkdown || isImage) {
          nodes.push({
            name: entry.name || 'Untitled',
            path: nodePath,
            isDirectory: false
          });
        }
      }
    }

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

export function flattenFiles(nodes: FileNode[]): FileNode[] {
  let result: FileNode[] = [];
  for (const node of nodes) {
    if (node.isDirectory && node.children) {
      result = result.concat(flattenFiles(node.children));
    } else if (!node.isDirectory) {
      result.push(node);
    }
  }
  return result;
}

export function flattenNodes(nodes: FileNode[]): FileNode[] {
  let result: FileNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.isDirectory && node.children) {
      result = result.concat(flattenNodes(node.children));
    }
  }
  return result;
}
