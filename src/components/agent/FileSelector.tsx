import { useState, useEffect, useRef } from 'react';
import { Search, FolderOpen, X, Check, FileText } from 'lucide-react';
import { readVaultRecursive, flattenNodes, FileNode } from '../../utils/fs';

export default function FileSelector({ 
  vaultPath, 
  selectedFiles, 
  onChange,
  directoriesOnly = false
}: { 
  vaultPath: string; 
  selectedFiles: string[]; 
  onChange: (paths: string[]) => void;
  directoriesOnly?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allFiles, setAllFiles] = useState<FileNode[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const nodes = await readVaultRecursive(vaultPath);
        let flat = flattenNodes(nodes);
        if (directoriesOnly) {
          flat = flat.filter(f => f.isDirectory);
        }
        const relativeFiles = flat.map(f => ({
          ...f,
          path: f.path.replace(vaultPath + '/', '')
        }));
        setAllFiles(relativeFiles);
      } catch (err) {
        console.error("Failed to load files", err);
      }
    };
    if (vaultPath) {
      loadFiles();
    }
  }, [vaultPath]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredFiles = allFiles.filter(f => 
    f.path.toLowerCase().includes(query.toLowerCase()) && 
    !selectedFiles.includes(f.path)
  ).slice(0, 10);

  const handleAddFile = (path: string) => {
    if (!selectedFiles.includes(path)) {
      onChange([...selectedFiles, path]);
      setQuery('');
      setIsDropdownOpen(false);
    }
  };

  return (
    <div style={{ position: 'relative', flex: 1 }} ref={dropdownRef}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder="Search files to add..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 30px',
              borderRadius: '6px',
              border: '1px solid var(--background-modifier-border)',
              background: 'var(--background-primary)',
              color: 'var(--text-normal)',
              fontSize: '13px',
              outline: 'none'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filteredFiles.length > 0) {
                handleAddFile(filteredFiles[0].path);
              }
            }}
          />
          {isDropdownOpen && query && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              background: 'var(--background-primary)',
              border: '1px solid var(--background-modifier-border)',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 100,
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {filteredFiles.length > 0 ? filteredFiles.map(f => (
                <div
                  key={f.path}
                  onClick={() => handleAddFile(f.path)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderBottom: '1px solid var(--background-modifier-border)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background-modifier-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {f.isDirectory ? <FolderOpen size={14} color="var(--text-muted)" /> : <FileText size={14} color="var(--text-muted)" />}
                  {f.path}
                </div>
              )) : (
                <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '13px' }}>No files found</div>
              )}
            </div>
          )}
        </div>
        <button
          className="btn"
          onClick={() => setIsModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          title="Browse File Explorer"
        >
          <FolderOpen size={14} /> Browse...
        </button>
      </div>

      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setIsModalOpen(false)}>
          <div style={{
            background: 'var(--background-primary)',
            borderRadius: '8px',
            width: '600px',
            maxWidth: '90vw',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--background-modifier-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Select Files for Context Bank</h3>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            
            <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
              {allFiles.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                  No files or folders found.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '8px' }}>
                  {allFiles.map(f => {
                    const isSelected = selectedFiles.includes(f.path);
                    return (
                      <div
                        key={f.path}
                        onClick={() => {
                          if (isSelected) {
                            onChange(selectedFiles.filter(p => p !== f.path));
                          } else {
                            onChange([...selectedFiles, f.path]);
                          }
                        }}
                        style={{
                          padding: '8px 12px',
                          background: isSelected ? 'var(--interactive-accent)' : 'var(--background-secondary)',
                          color: isSelected ? 'white' : 'var(--text-normal)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          border: '1px solid var(--background-modifier-border)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          {f.isDirectory ? <FolderOpen size={14} color={isSelected ? 'white' : 'var(--text-muted)'} /> : <FileText size={14} color={isSelected ? 'white' : 'var(--text-muted)'} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</span>
                        </div>
                        {isSelected && <Check size={14} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: '16px', borderTop: '1px solid var(--background-modifier-border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn primary" onClick={() => setIsModalOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
