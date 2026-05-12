import { useState, useEffect, useCallback, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, rename, remove, mkdir, copyFile } from '@tauri-apps/plugin-fs';
import { FolderOpen, Settings, FilePlus, FolderPlus, PanelLeft, Files, List } from 'lucide-react';
import { FileNode, readVaultRecursive, flattenFiles } from './utils/fs';
import { globalIndexer } from './utils/indexer';
import { Command } from './utils/commands';
import { useSettings } from './utils/settings';
import FileExplorer from './components/FileExplorer';
import Editor, { EditorHandle } from './components/Editor';
import TabBar from './components/TabBar';
import StatusBar from './components/StatusBar';
import CommandPalette from './components/CommandPalette';
import BacklinksPane from './components/BacklinksPane';
import TableOfContents from './components/TableOfContents';
import SettingsDialog from './components/SettingsDialog';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import Sidebar from './components/layout/Sidebar';
import './App.css';

function extractFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (match) {
    return { frontmatter: match[1], body: match[2] };
  }
  return { frontmatter: null, body: content };
}

function combineFrontmatter(frontmatter: string | null, body: string) {
  if (frontmatter !== null && frontmatter.trim() !== '') {
    return `---\n${frontmatter}\n---\n${body}`;
  }
  return body;
}

function App() {
  const editorRef = useRef<EditorHandle>(null);

  const [vaultPath, setVaultPath] = useState<string | null>(() => {
    return localStorage.getItem('glade_vaultPath');
  });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [sidebarView, setSidebarView] = useState<'explorer' | 'outline'>('explorer');
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  
  const [toast, setToast] = useState<{ message: string, action?: { label: string, onClick: () => void } } | null>(null);
  const showToast = useCallback((message: string, action?: { label: string, onClick: () => void }) => {
    setToast({ message, action });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  
  const [openFiles, setOpenFiles] = useState<FileNode[]>(() => {
    const saved = localStorage.getItem('glade_openFiles');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeFileIndex, setActiveFileIndex] = useState<number>(() => {
    const saved = localStorage.getItem('glade_activeFileIndex');
    return saved ? parseInt(saved, 10) : -1;
  });

  const { settings, updateSettings } = useSettings();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<'files' | 'commands' | 'link'>('commands');

  const [cursorPositions, setCursorPositions] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('glade_cursorPositions');
    return saved ? JSON.parse(saved) : {};
  });

  // Persistence
  useEffect(() => {
    if (vaultPath) localStorage.setItem('glade_vaultPath', vaultPath);
    else localStorage.removeItem('glade_vaultPath');
  }, [vaultPath]);

  useEffect(() => {
    localStorage.setItem('glade_openFiles', JSON.stringify(openFiles));
    localStorage.setItem('glade_activeFileIndex', activeFileIndex.toString());
  }, [openFiles, activeFileIndex]);

  useEffect(() => {
    localStorage.setItem('glade_cursorPositions', JSON.stringify(cursorPositions));
  }, [cursorPositions]);

  // Load Tree
  const loadVaultFiles = useCallback(async (path: string) => {
    try {
      const nodes = await readVaultRecursive(path);
      if (nodes.length === 0) {
        // If it's empty or we lack permissions (silent fail in readVaultRecursive), reset.
        setVaultPath(null);
        setFileTree([]);
        globalIndexer.setFiles([]);
      } else {
        setFileTree(nodes);
        const flatFiles = flattenFiles(nodes);
        globalIndexer.indexFiles(flatFiles);
      }
    } catch (err) {
      setVaultPath(null);
      setFileTree([]);
      globalIndexer.setFiles([]);
    }
  }, []);

  useEffect(() => {
    if (vaultPath) {
      loadVaultFiles(vaultPath);
    }
  }, [vaultPath, loadVaultFiles]);

  const [activeFileContent, setActiveFileContent] = useState<{ path: string, content: string, frontmatter: string | null } | null>(null);
  const [activeHeading, setActiveHeading] = useState<string>('');
  const [stats, setStats] = useState<{ wordCount: number, charCount: number, readingTime: number } | null>(null);

  // Load File Content when active tab changes
  useEffect(() => {
    const loadContent = async () => {
      if (activeFileIndex >= 0 && activeFileIndex < openFiles.length) {
        const file = openFiles[activeFileIndex];
        console.log("Loading file content for:", file.path);
        try {
          const content = await readTextFile(file.path);
          console.log("Loaded content length:", content.length);
          const { frontmatter, body } = extractFrontmatter(content);
          setActiveFileContent({ path: file.path, content: body, frontmatter });
        } catch (err) {
          console.error('Failed to read active file', err);
          setActiveFileContent({ path: file.path, content: `Error loading file: ${err}`, frontmatter: null });
        }
      } else {
        setActiveFileContent(null);
      }
    };
    loadContent();
  }, [activeFileIndex, openFiles]);

  const handleOpenVault = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === 'string') {
      if (selected === vaultPath) {
        // Force reload if same path selected
        loadVaultFiles(selected);
      } else {
        setVaultPath(selected);
      }
      setOpenFiles([]);
      setActiveFileIndex(-1);
      setStats(null);
    }
  };

  const handleOpenFile = (file: FileNode) => {
    // Check if already open
    const existingIndex = openFiles.findIndex(f => f.path === file.path);
    if (existingIndex >= 0) {
      setActiveFileIndex(existingIndex);
    } else {
      setOpenFiles([...openFiles, file]);
      setActiveFileIndex(openFiles.length);
    }
  };

  const [pendingScrollHash, setPendingScrollHash] = useState<string | null>(null);

  const handleNavigate = (path: string) => {
    let [filePath, hash] = path.split('#');
    if (!filePath && activeFile) filePath = activeFile.path;

    const flatFiles = flattenFiles(fileTree);
    const target = flatFiles.find(f => f.path === filePath || f.path.endsWith(filePath));
    
    if (target) {
      if (activeFile?.path === target.path && hash && editorRef.current) {
        editorRef.current.scrollToHeader(hash);
      } else {
        if (hash) setPendingScrollHash(hash);
        handleOpenFile(target);
      }
    } else {
      // Auto-create dangling link target
      handleCreateFile(filePath);
    }
  };

  useEffect(() => {
    if (pendingScrollHash && activeFileContent && editorRef.current) {
      // Small timeout to let Editor mount and parse content
      setTimeout(() => {
        if (editorRef.current) {
           editorRef.current.scrollToHeader(pendingScrollHash);
        }
      }, 50);
      setPendingScrollHash(null);
    }
  }, [activeFileContent, pendingScrollHash]);

  const handleCreateFile = async (name: string) => {
    if (!vaultPath) return;
    const safeName = name.replace(/\.md$/, '') + '.md';
    const newPath = `${vaultPath}/${safeName}`;
    try {
      await writeTextFile(newPath, `# ${name.replace(/\.md$/, '')}\n\n`);
      await loadVaultFiles(vaultPath);
      // Wait for state to update, or just open directly:
      handleOpenFile({ name: safeName, path: newPath, isDirectory: false, children: [] });
    } catch (err) {
      console.error('Failed to create file', err);
    }
  };

  const handleTabClose = (e: React.MouseEvent, indexToClose: number) => {
    e.stopPropagation();
    const newOpenFiles = openFiles.filter((_, i) => i !== indexToClose);
    setOpenFiles(newOpenFiles);
    
    if (newOpenFiles.length === 0) {
      setActiveFileIndex(-1);
      setStats(null);
    } else if (indexToClose <= activeFileIndex) {
      // If we closed a tab to the left of active, or the active tab itself
      setActiveFileIndex(Math.max(0, activeFileIndex - 1));
    }
  };

  const handleSaveFile = async (newBody: string) => {
    if (activeFileIndex >= 0 && activeFileIndex < openFiles.length && activeFileContent) {
      const activeFile = openFiles[activeFileIndex];
      const newRaw = combineFrontmatter(activeFileContent.frontmatter, newBody);
      try {
        await writeTextFile(activeFile.path, newRaw);
        // We don't update state here because Milkdown's internal state handles body changes.
        // However, we should keep activeFileContent.content in sync for BacklinksPane.
        setActiveFileContent(prev => prev ? { ...prev, content: newBody } : null);
      } catch (err) {
        console.error('Failed to save file', err);
      }
    }
  };

  const handleFrontmatterChange = async (newFrontmatter: string) => {
    if (activeFileIndex >= 0 && activeFileIndex < openFiles.length && activeFileContent) {
      const activeFile = openFiles[activeFileIndex];
      const newRaw = combineFrontmatter(newFrontmatter, activeFileContent.content);
      try {
        await writeTextFile(activeFile.path, newRaw);
        setActiveFileContent(prev => prev ? { ...prev, frontmatter: newFrontmatter } : null);
      } catch (err) {
        console.error('Failed to save frontmatter', err);
      }
    }
  };

  const handleCursorChange = (path: string, pos: number) => {
    setCursorPositions(prev => ({
      ...prev,
      [path]: pos
    }));
  };

  const activeFile = activeFileIndex >= 0 && activeFileIndex < openFiles.length 
    ? openFiles[activeFileIndex] 
    : null;

  // Define Global Commands
  const commands: Command[] = [
    {
      id: 'app.toggleSidebar',
      name: 'Toggle Sidebar',
      action: () => setIsSidebarOpen(prev => !prev),
    },
    {
      id: 'app.toggleTypewriterMode',
      name: 'Toggle Typewriter Mode',
      action: () => updateSettings({ typewriterMode: !settings.typewriterMode }),
    },
    {
      id: 'app.closeTab',
      name: 'Close Active Tab',
      action: () => {
        if (activeFileIndex >= 0) {
          const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
          handleTabClose(fakeEvent, activeFileIndex);
        }
      },
    },
    {
      id: 'editor.toggleLineNumbers',
      name: 'Toggle Line Numbers',
      action: () => updateSettings({ lineNumbers: !settings.lineNumbers }),
    },
    {
      id: 'add-properties',
      name: 'Add Properties (Frontmatter)',
      action: () => {
        if (activeFileContent && activeFileContent.frontmatter === null) {
          handleFrontmatterChange('title: ' + (activeFile?.name.replace('.md', '') || 'New Page'));
        }
      },
    },
    {
      id: 'editor.toggleWordWrap',
      name: 'Toggle Word Wrap',
      action: () => updateSettings({ wordWrap: !settings.wordWrap }),
    },
    {
      id: 'app.toggleZenMode',
      name: 'Toggle Zen Mode',
      action: () => setIsZenMode(prev => !prev),
    }
  ];

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // We parse the hotkeys from settings.hotkeys
      const checkHotkey = (hotkey: string) => {
        const parts = hotkey.toLowerCase().split('+');
        const key = parts.pop();
        const hasCmd = parts.includes('cmd') || parts.includes('ctrl');
        const hasShift = parts.includes('shift');
        return (hasCmd ? (e.metaKey || e.ctrlKey) : !(e.metaKey || e.ctrlKey)) &&
               (hasShift ? e.shiftKey : !e.shiftKey) &&
               e.key.toLowerCase() === key;
      };

      if (checkHotkey(settings.hotkeys['command.palette'])) {
        e.preventDefault();
        setPaletteMode('commands');
        setIsCommandPaletteOpen(true);
      } else if (checkHotkey(settings.hotkeys['file.search'])) {
        e.preventDefault();
        setPaletteMode('files');
        setIsCommandPaletteOpen(true);
      } else if (checkHotkey(settings.hotkeys['app.toggleSidebar'])) {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      } else if (checkHotkey(settings.hotkeys['app.closeTab'])) {
        e.preventDefault();
        if (activeFileIndex >= 0) {
          const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
          handleTabClose(fakeEvent, activeFileIndex);
        }
      } else if (checkHotkey('cmd+k') || checkHotkey('ctrl+k')) {
        e.preventDefault();
        setPaletteMode('link');
        setIsCommandPaletteOpen(true);
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [settings.hotkeys, activeFileIndex, openFiles]);

  const handlePaletteSelect = (file: FileNode) => {
    if (paletteMode === 'link' && editorRef.current) {
      editorRef.current.insertLink({ name: file.name, path: file.path });
    } else {
      handleOpenFile(file);
    }
    setIsCommandPaletteOpen(false);
  };

  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const executeDelete = async (path: string) => {
    try {
      await remove(path, { recursive: true });
      const updatedOpenFiles = openFiles.filter(f => !f.path.startsWith(path));
      setOpenFiles(updatedOpenFiles);
      if (activeFileContent?.path.startsWith(path)) {
        if (updatedOpenFiles.length > 0) {
          handleOpenFile(updatedOpenFiles[updatedOpenFiles.length - 1]);
        } else {
          setActiveFileContent(null);
        }
      }
      loadVaultFiles(vaultPath!);
    } catch (err) {
      console.error("Failed to delete", err);
      showToast("Failed to delete file/folder");
    }
  };

  const requestDelete = (path: string) => {
    const skipConfirm = localStorage.getItem('glade_skipDeleteConfirm') === 'true';
    if (skipConfirm) {
      executeDelete(path);
    } else {
      setFileToDelete(path);
    }
  };

  const handleConfirmDelete = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem('glade_skipDeleteConfirm', 'true');
    }
    if (fileToDelete) {
      executeDelete(fileToDelete);
    }
    setFileToDelete(null);
  };

  const handleSidebarCreateFile = async (folderPath: string) => {
    if (!vaultPath) return;
    try {
      let newFilePath = `${folderPath}/Untitled.md`;
      let counter = 1;
      try {
        await readTextFile(newFilePath);
        while (true) {
          newFilePath = `${folderPath}/Untitled-${counter}.md`;
          try {
            await readTextFile(newFilePath);
            counter++;
          } catch {
            break;
          }
        }
      } catch {
        // file doesn't exist
      }
      await writeTextFile(newFilePath, "");
      loadVaultFiles(vaultPath);
      handleOpenFile({ name: newFilePath.split(/[/\\]/).pop()!, path: newFilePath, isDirectory: false });
    } catch (err) {
      console.error("Failed to create file", err);
      showToast("Failed to create file");
    }
  };

  const handleSidebarCreateFolder = async (folderPath: string) => {
    if (!vaultPath) return;
    try {
      const newFolderPath = `${folderPath}/New Folder`;
      await mkdir(newFolderPath);
      loadVaultFiles(vaultPath);
    } catch (err) {
      console.error("Failed to create folder", err);
      showToast("Failed to create folder");
    }
  };

  const handleMoveFile = async (oldPath: string, newFolderPath: string) => {
    const fileName = oldPath.split('/').pop() || oldPath.split('\\').pop() || '';
    const newPath = `${newFolderPath}/${fileName}`;
    if (oldPath === newPath) return;
    
    try {
      await rename(oldPath, newPath);
      await globalIndexer.globalRename(oldPath, newPath);
      
      const updatedOpenFiles = openFiles.map(f => f.path === oldPath ? { ...f, path: newPath } : f);
      setOpenFiles(updatedOpenFiles);
      if (activeFileContent?.path === oldPath) {
        setActiveFileContent({ ...activeFileContent, path: newPath });
      }
      
      loadVaultFiles(vaultPath!);
    } catch (err) {
      console.error("Failed to move file", err);
      showToast("Failed to move file");
    }
  };

  const handleRenameFile = async (oldPath: string, newName: string, isDirectory?: boolean) => {
    if (!vaultPath) return;
    
    let finalName = newName;
    if (!isDirectory) {
      const isExtension = newName.endsWith('.md');
      finalName = isExtension ? newName : newName + '.md';
    }
    
    const oldDir = oldPath.substring(0, Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\')));
    const newPath = `${oldDir}/${finalName}`;

    if (oldPath === newPath) return;

    try {
      await rename(oldPath, newPath);
      
      const updatedFiles = await globalIndexer.globalRename(oldPath, newPath);
      
      if (updatedFiles.length > 0) {
        showToast(`Updated ${updatedFiles.length} links referencing this file.`, {
          label: 'See Details',
          onClick: () => {
            alert(`Files updated:\n${updatedFiles.map(f => f.split(/[/\\]/).pop()).join('\n')}`);
          }
        });
      }

      // Update open files logic (if the renamed file was open)
      const updatedOpenFiles = openFiles.map(f => f.path === oldPath ? { ...f, path: newPath, name: finalName } : f);
      setOpenFiles(updatedOpenFiles);
      if (activeFileContent?.path === oldPath) {
        setActiveFileContent({ ...activeFileContent, path: newPath });
      }

      loadVaultFiles(vaultPath);
    } catch (err) {
      console.error("Failed to rename file", err);
      showToast("Failed to rename file");
    }
  };

  const handleDuplicateFile = async (path: string, isDirectory: boolean) => {
    if (!vaultPath) return;
    if (isDirectory) {
      showToast("Duplicating folders is not currently supported");
      return;
    }
    
    try {
      // Find a unique name
      const dir = path.substring(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')));
      let fileName = path.split(/[/\\]/).pop() || 'Untitled';
      const ext = fileName.endsWith('.md') ? '.md' : '';
      const baseName = fileName.replace(/\.md$/, '');
      
      let newFilePath = `${dir}/${baseName} copy${ext}`;
      let counter = 1;
      
      while (true) {
        try {
          await readTextFile(newFilePath);
          newFilePath = `${dir}/${baseName} copy ${counter}${ext}`;
          counter++;
        } catch {
          // File doesn't exist, we can use this path
          break;
        }
      }
      
      await copyFile(path, newFilePath);
      loadVaultFiles(vaultPath);
    } catch (err) {
      console.error("Failed to duplicate file", err);
      showToast("Failed to duplicate file");
    }
  };

  return (
    <div className={`app-container ${isZenMode ? 'zen-mode' : ''}`}>
      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000, background: 'var(--bg-modifier-active)', color: 'var(--text-primary)', padding: '10px 16px', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>{toast.message}</span>
          {toast.action && (
            <button onClick={toast.action.onClick} style={{ background: 'var(--text-accent)', color: '#000', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
      {!isZenMode && (
        <div className="ribbon">
          <div className="ribbon-top">
            <button className="icon-btn" onClick={() => setIsSidebarOpen(prev => !prev)} title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}>
              <PanelLeft size={20} />
            </button>
            <button className={`icon-btn ${sidebarView === 'explorer' && isSidebarOpen ? 'active' : ''}`} onClick={() => {
              if (sidebarView === 'explorer' && isSidebarOpen) setIsSidebarOpen(false);
              else { setSidebarView('explorer'); setIsSidebarOpen(true); }
            }} title="Files">
              <Files size={20} />
            </button>
            <button className={`icon-btn ${sidebarView === 'outline' && isSidebarOpen ? 'active' : ''}`} onClick={() => {
              if (sidebarView === 'outline' && isSidebarOpen) setIsSidebarOpen(false);
              else { setSidebarView('outline'); setIsSidebarOpen(true); }
            }} title="Outline">
              <List size={20} />
            </button>
          </div>
          <div className="ribbon-bottom">
            <button className="icon-btn" onClick={() => setIsSettingsOpen(true)} title="Settings">
              <Settings size={20} />
            </button>
          </div>
        </div>
      )}

      {isSidebarOpen && !isZenMode && (
        <Sidebar
          sidebarView={sidebarView}
          vaultPath={vaultPath}
          fileTree={fileTree}
          activeFile={activeFile}
          activeFileContent={activeFileContent}
          activeHeading={activeHeading}
          editorRef={editorRef}
          onOpenFile={handleOpenFile}
          onRenameFile={handleRenameFile}
          onRequestDelete={requestDelete}
          onCreateFile={handleSidebarCreateFile}
          onCreateFolder={handleSidebarCreateFolder}
          onMoveFile={handleMoveFile}
          onDuplicateFile={handleDuplicateFile}
          onFrontmatterChange={handleFrontmatterChange}
          onOpenVault={handleOpenVault}
        />
      )}

      <div className="main-content">
        {!vaultPath ? (
          <div className="empty-state">
            <h2>Welcome to Glade</h2>
            <div style={{ background: 'var(--bg-modifier-error, rgba(255, 0, 0, 0.1))', color: 'var(--text-error, #ff4444)', padding: '12px', borderRadius: '8px', marginBottom: '24px', maxWidth: '400px', fontSize: '13px', border: '1px solid var(--text-error, #ff4444)' }}>
              <strong>Extreme Alpha Warning</strong><br/>
              This is an early alpha release (0.0.1-alpha.1) and is not ready for production use. Please make a copy of your valued markdown vaults before opening them with Glade.
            </div>
            <p style={{ marginBottom: '24px' }}>Open a folder to start your knowledge base.</p>
            <button className="btn" onClick={handleOpenVault}>Open Vault</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, width: '100%' }}>
            {!isZenMode && (
              <TabBar 
                openFiles={openFiles} 
                activeFileIndex={activeFileIndex} 
                onTabClick={setActiveFileIndex}
                onTabClose={handleTabClose}
                onRename={handleRenameFile}
              />
            )}
            
            {!activeFile ? (
              <div className="empty-state">
                <p>Select a file to start editing.</p>
              </div>
            ) : (
              <div className="editor-container">
                {activeFileContent && activeFileContent.path === activeFile.path ? (
                  <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0 }}>
                    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>

                      <Editor 
                        key={activeFileContent.path}
                        ref={editorRef}
                        initialContent={activeFileContent.content} 
                        onSave={handleSaveFile} 
                        fileName={activeFile.name}
                        filePath={activeFile.path}
                        workspaceRoot={vaultPath || undefined}
                        initialCursorPos={cursorPositions[activeFile.path]}
                        onCursorChange={(pos) => handleCursorChange(activeFile.path, pos)}
                        onActiveHeadingChange={setActiveHeading}
                        allFiles={flattenFiles(fileTree)}
                        onNavigate={handleNavigate}
                        onCreateFile={handleCreateFile}
                        onRename={handleRenameFile}
                        onStatsChange={setStats}
                      >
                        <BacklinksPane 
                          activeFilePath={activeFile.path} 
                          activeFileContent={activeFileContent.content} 
                          onNavigate={handleNavigate} 
                        />
                      </Editor>
                    </div>
                  </div>
                ) : (
                  <div className="loading-editor" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-faint)' }}>Loading...</div>
                )}
              </div>
            )}
            
            {!isZenMode && (
              <StatusBar 
                activeFile={activeFile} 
                stats={stats} 
              />
            )}
          </div>
        )}
      </div>

      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        initialMode={paletteMode}
        onClose={() => setIsCommandPaletteOpen(false)}
        files={flattenFiles(fileTree)}
        commands={commands}
        onFileSelect={handlePaletteSelect}
        hotkeys={settings.hotkeys}
      />
      
      <SettingsDialog 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
      {fileToDelete && (
        <ConfirmDeleteModal
          fileName={fileToDelete.split(/[/\\]/).pop() || fileToDelete}
          onConfirm={handleConfirmDelete}
          onCancel={() => setFileToDelete(null)}
        />
      )}
    </div>
  );
}

export default App;
