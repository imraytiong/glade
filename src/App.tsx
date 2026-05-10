import { useState, useEffect, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { FolderOpen } from 'lucide-react';
import { FileNode, readVaultRecursive } from './utils/fs';
import FileExplorer from './components/FileExplorer';
import Editor from './components/Editor';
import TabBar from './components/TabBar';
import './App.css';

function App() {
  const [vaultPath, setVaultPath] = useState<string | null>(() => {
    return localStorage.getItem('glade_vaultPath');
  });
  
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  
  const [openFiles, setOpenFiles] = useState<FileNode[]>(() => {
    const saved = localStorage.getItem('glade_openFiles');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeFileIndex, setActiveFileIndex] = useState<number>(() => {
    const saved = localStorage.getItem('glade_activeFileIndex');
    return saved ? parseInt(saved, 10) : -1;
  });

  const [fileContent, setFileContent] = useState<string>('');

  // Persistence
  useEffect(() => {
    if (vaultPath) localStorage.setItem('glade_vaultPath', vaultPath);
    else localStorage.removeItem('glade_vaultPath');
  }, [vaultPath]);

  useEffect(() => {
    localStorage.setItem('glade_openFiles', JSON.stringify(openFiles));
    localStorage.setItem('glade_activeFileIndex', activeFileIndex.toString());
  }, [openFiles, activeFileIndex]);

  // Load Tree
  const loadVaultFiles = useCallback(async (path: string) => {
    try {
      const nodes = await readVaultRecursive(path);
      if (nodes.length === 0) {
        // If it's empty or we lack permissions (silent fail in readVaultRecursive), reset.
        setVaultPath(null);
        setFileTree([]);
      } else {
        setFileTree(nodes);
      }
    } catch (err) {
      setVaultPath(null);
      setFileTree([]);
    }
  }, []);

  useEffect(() => {
    if (vaultPath) {
      loadVaultFiles(vaultPath);
    }
  }, [vaultPath, loadVaultFiles]);

  // Load File Content when active tab changes
  useEffect(() => {
    const loadContent = async () => {
      if (activeFileIndex >= 0 && activeFileIndex < openFiles.length) {
        const file = openFiles[activeFileIndex];
        console.log("Loading file content for:", file.path);
        try {
          const content = await readTextFile(file.path);
          console.log("Loaded content length:", content.length);
          setFileContent(content);
        } catch (err) {
          console.error('Failed to read active file', err);
          setFileContent(`Error loading file: ${err}`);
        }
      } else {
        setFileContent('');
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

  const activeFile = activeFileIndex >= 0 && activeFileIndex < openFiles.length 
    ? openFiles[activeFileIndex] 
    : null;

  return (
    <div className="app-container">
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
            />
          ) : (
            <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
              No vault opened.
            </div>
          )}
        </div>
      </div>

      <div className="main-content">
        {!vaultPath ? (
          <div className="empty-state">
            <h2>Welcome to Glade</h2>
            <p style={{ marginBottom: '24px' }}>Open a folder to start your knowledge base.</p>
            <button className="btn" onClick={handleOpenVault}>Open Vault</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <TabBar 
              openFiles={openFiles} 
              activeFileIndex={activeFileIndex} 
              onTabClick={setActiveFileIndex}
              onTabClose={handleTabClose}
            />
            
            {!activeFile ? (
              <div className="empty-state">
                <p>Select a file to start editing.</p>
              </div>
            ) : (
              <div className="editor-container">
                <Editor 
                  // Use key to force unmount/remount when file changes, ensuring clean state
                  key={activeFile.path}
                  initialContent={fileContent} 
                  onSave={handleSaveFile} 
                  fileName={activeFile.name}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
