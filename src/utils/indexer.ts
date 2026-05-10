import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { FileNode } from './fs';

export interface LinkData {
  sourcePath: string;
  targetPath: string | null; // Null if it's a dangling link
  originalText: string;
  label: string;
  linkTarget: string; // The raw href inside the parentheses
  position: { from: number, to: number };
  hash?: string;
}

type Listener = () => void;

export class VaultIndexer {
  private fileCache: Map<string, string> = new Map();
  private linksCache: Map<string, LinkData[]> = new Map();
  private allFiles: FileNode[] = [];
  
  private listeners: Set<Listener> = new Set();

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit() {
    this.listeners.forEach(l => l());
  }

  public setFiles(files: FileNode[]) {
    this.allFiles = files;
    this.emit();
  }

  // Fully index a given list of files
  public async indexFiles(files: FileNode[]) {
    this.allFiles = files;
    const promises = files.filter(f => !f.isDirectory && f.name.endsWith('.md')).map(async f => {
      try {
        const content = await readTextFile(f.path);
        this.fileCache.set(f.path, content);
        this.linksCache.set(f.path, this.parseLinks(f.path, content));
      } catch (err) {
        console.error("Failed to read for index:", f.path, err);
      }
    });
    await Promise.all(promises);
    this.emit();
  }

  public async updateFile(path: string, content: string) {
    this.fileCache.set(path, content);
    this.linksCache.set(path, this.parseLinks(path, content));
    this.emit();
  }

  public getBacklinks(targetPath: string): LinkData[] {
    const backlinks: LinkData[] = [];
    for (const [sourcePath, links] of this.linksCache.entries()) {
      if (sourcePath === targetPath) continue; // Skip self links
      for (const link of links) {
        if (link.targetPath === targetPath) {
          backlinks.push(link);
        }
      }
    }
    return backlinks;
  }

  public async globalRename(oldPath: string, newPath: string): Promise<string[]> {
    const updatedFiles: string[] = [];
    
    // Convert newPath to a relative path or basename depending on preference
    // For now, let's use the basename
    const newName = newPath.split(/[/\\]/).pop() || '';
    
    for (const [sourcePath, links] of this.linksCache.entries()) {
      const affectedLinks = links.filter(l => l.targetPath === oldPath);
      if (affectedLinks.length > 0) {
        let content = this.fileCache.get(sourcePath) || '';
        
        // Replace from end to start to avoid position shifting
        for (const link of [...affectedLinks].sort((a, b) => b.position.from - a.position.from)) {
          const newLinkTarget = newName; // or absolute depending on original
          const newLinkStr = `[${link.label}](${newLinkTarget}${link.hash ? '#' + link.hash : ''})`;
          content = content.substring(0, link.position.from) + newLinkStr + content.substring(link.position.to);
        }
        
        try {
          await writeTextFile(sourcePath, content);
          await this.updateFile(sourcePath, content);
          updatedFiles.push(sourcePath);
        } catch (err) {
          console.error("Failed to rewrite links in", sourcePath, err);
        }
      }
    }
    this.emit();
    return updatedFiles;
  }
  
  public getUnlinkedMentions(sourcePath: string, content: string): { label: string, targetPath: string }[] {
    const mentions: { label: string, targetPath: string }[] = [];
    // A naive approach: look for occurrences of other file names (without extension) in the text
    // that are NOT already part of a link.
    for (const file of this.allFiles) {
      if (file.isDirectory || !file.name.endsWith('.md')) continue;
      if (file.path === sourcePath) continue;
      
      const nameWithoutExt = file.name.replace(/\.md$/, '');
      if (nameWithoutExt.length < 3) continue; // skip very short names to avoid false positives
      
      // Look for the word boundary match
      const regex = new RegExp(`\\b${this.escapeRegExp(nameWithoutExt)}\\b`, 'gi');
      let match;
      while ((match = regex.exec(content)) !== null) {
        // Basic check: is it inside a link?
        const textBefore = content.substring(0, match.index);
        const insideLink = textBefore.lastIndexOf('[') > textBefore.lastIndexOf(']');
        if (!insideLink) {
          // It's a mention!
          // We only return unique mentions
          if (!mentions.some(m => m.targetPath === file.path)) {
            mentions.push({ label: match[0], targetPath: file.path });
          }
        }
      }
    }
    return mentions;
  }

  private parseLinks(sourcePath: string, content: string): LinkData[] {
    const links: LinkData[] = [];
    const regex = /\[(.*?)\]\((.*?)\)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const originalText = match[0];
      const label = match[1];
      const linkTargetRaw = match[2];
      
      const [linkTarget, hash] = linkTargetRaw.split('#');

      // Resolve linkTarget to targetPath
      let targetPath: string | null = null;
      if (linkTarget) {
         if (linkTarget.startsWith('http') || linkTarget.startsWith('data:') || linkTarget.startsWith('tauri://')) {
            targetPath = null; // external
         } else {
            const dir = sourcePath.substring(0, Math.max(sourcePath.lastIndexOf('/'), sourcePath.lastIndexOf('\\')));
            const isAbsolute = linkTarget.startsWith('/') || linkTarget.match(/^[a-zA-Z]:\\/);
            
            const normalizePath = (path: string) => {
              const isAbs = path.startsWith('/');
              const parts = path.split(/[/\\]/);
              const result: string[] = [];
              for (const part of parts) {
                if (part === '.' || part === '') continue;
                if (part === '..') {
                  if (result.length > 0 && result[result.length - 1] !== '..') result.pop();
                  else result.push('..');
                } else {
                  result.push(part);
                }
              }
              return (isAbs ? '/' : '') + result.join('/');
            };
            
            const resolvedPath = isAbsolute ? linkTarget : normalizePath(`${dir}/${linkTarget}`);
            
            // Check if it exists in allFiles
            const found = this.allFiles.find(f => f.path === resolvedPath || f.name === linkTarget);
            if (found) {
               targetPath = found.path;
            } else {
               // Dangling link
               targetPath = null;
            }
         }
      } else {
         // Hash-only link (internal to current file)
         targetPath = sourcePath;
      }

      links.push({
        sourcePath,
        targetPath,
        originalText,
        label,
        linkTarget,
        position: { from: match.index, to: match.index + originalText.length },
        hash
      });
    }
    return links;
  }

  private escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Global instance for the app to share
export const globalIndexer = new VaultIndexer();
