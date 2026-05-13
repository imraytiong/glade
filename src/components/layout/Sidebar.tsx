import { FolderOpen, FilePlus, FolderPlus } from 'lucide-react';
import { FileNode } from '../../utils/fs';
import FileExplorer from '../FileExplorer';
import { FrontmatterEditor } from '../FrontmatterEditor';
import TableOfContents from '../TableOfContents';
import { EditorHandle } from '../Editor';
import AgentConfigPane from './AgentConfigPane';

export interface SidebarProps {
  sidebarView: 'explorer' | 'outline' | 'agents';
  vaultPath: string | null;
  fileTree: FileNode[];
  activeFile: FileNode | null;
  activeFileContent: { path: string, content: string, frontmatter: string | null } | null;
  activeHeading: string;
  editorRef: React.RefObject<EditorHandle | null>;
  onOpenFile: (file: FileNode) => void;
  onRenameFile: (oldPath: string, newName: string, isDirectory?: boolean) => void;
  onRequestDelete: (path: string) => void;
  onCreateFile: (folderPath: string) => void;
  onCreateFolder: (folderPath: string) => void;
  onMoveFile: (oldPath: string, newFolderPath: string) => void;
  onDuplicateFile: (path: string, isDirectory: boolean) => void;
  onFrontmatterChange: (newFrontmatter: string) => void;
  onOpenVault: () => void;
}

export default function Sidebar({
  sidebarView,
  vaultPath,
  fileTree,
  activeFile,
  activeFileContent,
  activeHeading,
  editorRef,
  onOpenFile,
  onRenameFile,
  onRequestDelete,
  onCreateFile,
  onCreateFolder,
  onMoveFile,
  onDuplicateFile,
  onFrontmatterChange,
  onOpenVault
}: SidebarProps) {
  return (
    <div className="sidebar" style={{ position: 'relative' }}>
      <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '38px' }}>
      </div>
      
      <div className="sidebar-content">
        {vaultPath ? (
          <>
            {sidebarView === 'explorer' && (
              <FileExplorer 
                nodes={fileTree} 
                activeFilePath={activeFile?.path || null} 
                onFileSelect={onOpenFile} 
                onRename={onRenameFile}
                onDelete={onRequestDelete}
                onCreateFile={onCreateFile}
                onCreateFolder={onCreateFolder}
                onMove={onMoveFile}
                onDuplicate={onDuplicateFile}
              />
            )}
            {sidebarView === 'outline' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {activeFileContent && (
                  <FrontmatterEditor 
                    value={activeFileContent.frontmatter} 
                    onChange={onFrontmatterChange} 
                  />
                )}
                <TableOfContents 
                  content={activeFileContent?.content || ''} 
                  activeHeadingId={activeHeading}
                  onNavigateHeader={(hash) => editorRef.current?.scrollToHeader(hash)} 
                />
              </div>
            )}
            {sidebarView === 'agents' && (
              <AgentConfigPane vaultPath={vaultPath} />
            )}
          </>
        ) : (
          <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            No vault opened.
          </div>
        )}
      </div>
      
      <div className="sidebar-footer" style={{ borderTop: '1px solid var(--background-modifier-border)', display: 'flex', justifyContent: 'flex-end', padding: '3px 16px', gap: '8px' }}>
        {sidebarView === 'explorer' && vaultPath && (
          <>
            <button className="icon-btn" onClick={onOpenVault} title="Open Vault" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderOpen size={16} />
            </button>
            <button className="icon-btn" onClick={() => onCreateFile(vaultPath)} title="New File" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FilePlus size={16} />
            </button>
            <button className="icon-btn" onClick={() => onCreateFolder(vaultPath)} title="New Folder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderPlus size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
