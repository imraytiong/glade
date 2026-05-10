import { useState, useEffect, useCallback, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, rename } from '@tauri-apps/plugin-fs';
import { FolderOpen } from 'lucide-react';
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
import './App.css';

function App() {
  const editorRef = useRef<EditorHandle>(null);

  const [vaultPath, setVaultPath] = useState<string | null>(() => {
    return localStorage.getItem('glade_vaultPath');
  });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  
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

  const [activeFileContent, setActiveFileContent] = useState<{ path: string, content: string } | null>(null);

  // Load File Content when active tab changes
  useEffect(() => {
    const loadContent = async () => {
      if (activeFileIndex >= 0 && activeFileIndex < openFiles.length) {
        const file = openFiles[activeFileIndex];
        console.log("Loading file content for:", file.path);
        try {
          const content = await readTextFile(file.path);
          console.log("Loaded content length:", content.length);
          setActiveFileContent({ path: file.path, content });
        } catch (err) {
          console.error('Failed to read active file', err);
          setActiveFileContent({ path: file.path, content: `Error loading file: ${err}` });
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
    } else if (indexToClose <= activeFileIndex) {
      // If we closed a tab to the left of active, or the active tab itself
      setActiveFileIndex(Math.max(0, activeFileIndex - 1));
    }
  };

  const handleSaveFile = async (content: string) => {
    if (activeFileIndex >= 0 && activeFileIndex < openFiles.length) {
      const activeFile = openFiles[activeFileIndex];
      try {
        await writeTextFile(activeFile.path, content);
        // Do NOT setFileContent here because it's triggered by the Editor's own onChange,
        // we just need to write it to disk. 
        // Setting state here causes the cursor to jump in CodeMirror sometimes.
      } catch (err) {
        console.error('Failed to save file', err);
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

  const handleRenameFile = async (oldPath: string, newName: string) => {
    if (!vaultPath) return;
    const isExtension = newName.endsWith('.md');
    const finalName = isExtension ? newName : newName + '.md';
    const oldDir = oldPath.substring(0, Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\')));
    const newPath = `${oldDir}/${finalName}`;

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
      {isSidebarOpen && !isZenMode && (
        <div className="sidebar">
          <div className="sidebar-header">
            <span className="sidebar-title">Glade</span>
          <button className="icon-btn" onClick={handleOpenVault} title="Open Vault">
            <FolderOpen size={16} />
          </button>
        </div>
        
        <div className="sidebar-content">
          {vaultPath ? (
            <FileExplorer 
              nodes={fileTree} 
              activeFilePath={activeFile?.path || null} 
              onFileSelect={handleOpenFile} 
              onRename={handleRenameFile}
            />
          ) : (
            <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
              No vault opened.
            </div>
          )}
        </div>
      </div>
      )}

      <div className="main-content">
        {!vaultPath ? (
          <div className="empty-state">
            <h2>Welcome to Glade</h2>
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
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              />
            )}
            
            {!activeFile ? (
              <div className="empty-state">
                <p>Select a file to start editing.</p>
              </div>
            ) : (
              <div className="editor-container">
                {activeFileContent && activeFileContent.path === activeFile.path ? (
                  <>
                    <Editor 
                      key={activeFileContent.path}
                      ref={editorRef}
                      initialContent={activeFileContent.content} 
                      onSave={handleSaveFile} 
                      fileName={activeFile.name}
                      filePath={activeFile.path}
                      initialCursorPos={cursorPositions[activeFile.path]}
                      onCursorChange={(pos) => handleCursorChange(activeFile.path, pos)}
                      allFiles={flattenFiles(fileTree)}
                      onNavigate={handleNavigate}
                      onCreateFile={handleCreateFile}
                    />
                    <BacklinksPane 
                      activeFilePath={activeFile.path} 
                      activeFileContent={activeFileContent.content} 
                      onNavigate={handleNavigate} 
                    />
                  </>
                ) : (
                  <div className="loading-editor" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-faint)' }}>Loading...</div>
                )}
              </div>
            )}
            
            {!isZenMode && (
              <StatusBar 
                activeFile={activeFile} 
                content={activeFileContent && activeFileContent.path === activeFile?.path ? activeFileContent.content : null} 
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
    </div>
  );
}

export default App;
