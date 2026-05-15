import React, { useState } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder, FilePlus, FolderPlus, Trash2, Edit2, Copy } from 'lucide-react';
import { FileNode } from '../utils/fs';
import './FileExplorer.css';

interface FileExplorerProps {
  nodes: FileNode[];
  activeFilePath: string | null;
  onFileSelect: (file: FileNode) => void;
  onRename?: (oldPath: string, newName: string, isDirectory?: boolean) => void;
  onDelete?: (path: string) => void;
  onCreateFile?: (folderPath: string) => void;
  onCreateFolder?: (folderPath: string) => void;
  onMove?: (oldPath: string, newFolderPath: string) => void;
  onDuplicate?: (path: string, isDirectory: boolean) => void;
  level?: number;
}

const FileExplorerNode: React.FC<{
  node: FileNode;
  activeFilePath: string | null;
  onFileSelect: (file: FileNode) => void;
  onDelete?: (path: string) => void;
  onCreateFile?: (folderPath: string) => void;
  onCreateFolder?: (folderPath: string) => void;
  onMove?: (oldPath: string, newFolderPath: string) => void;
  onDuplicate?: (path: string, isDirectory: boolean) => void;
  onRename?: (oldPath: string, newName: string, isDirectory?: boolean) => void;
  level: number;
}> = ({ node, activeFilePath, onFileSelect, onRename, onDelete, onCreateFile, onCreateFolder, onMove, onDuplicate, level }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.isDirectory ? node.name : node.name.replace(/\.md$/, ''));
  const [clickTimeout, setClickTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const paddingLeft = `${level * 16 + 12}px`;
  const isActive = activeFilePath === node.path;

  const handleRenameSubmit = () => {
    const targetName = node.isDirectory ? node.name : node.name.replace(/\.md$/, '');
    if (editName && editName !== targetName && onRename) {
      onRename(node.path, editName, node.isDirectory);
    }
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.currentTarget as HTMLElement).blur();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(node.isDirectory ? node.name : node.name.replace(/\.md$/, ''));
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) return;

    if (isActive) {
      if (clickTimeout) {
        clearTimeout(clickTimeout);
        setClickTimeout(null);
        // Double click - maybe default action or nothing
      } else {
        const timeout = setTimeout(() => {
          setIsEditing(true);
          setEditName(node.isDirectory ? node.name : node.name.replace(/\.md$/, ''));
          setClickTimeout(null);
        }, 500);
        setClickTimeout(timeout);
      }
    } else {
      if (clickTimeout) {
        clearTimeout(clickTimeout);
        setClickTimeout(null);
      }
      onFileSelect(node);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.isDirectory) {
      setIsDragOver(true);
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.isDirectory) {
      setIsDragOver(true);
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!node.isDirectory) return;

    try {
      const data = e.dataTransfer.getData('application/glade-file') || e.dataTransfer.getData('text/plain');
      if (data) {
        const fileInfo = JSON.parse(data);
        if (onMove && fileInfo.path !== node.path) {
           onMove(fileInfo.path, node.path);
        }
      }
    } catch (err) {
      console.error("Drop parsing error:", err);
    }
  };

  if (node.isDirectory) {
    return (
      <div 
        className={`folder-node ${isDragOver ? 'drag-over' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div 
          className="folder-header" 
          style={{ paddingLeft }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="folder-icon">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <Folder size={14} className="folder-icon-main" />
          {isEditing ? (
            <input 
              type="text" 
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleKeyDown}
              autoFocus
              className="node-rename-input"
              style={{ width: '100%', background: 'var(--bg-modifier-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="node-name" onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setEditName(node.isDirectory ? node.name : node.name.replace(/\.md$/, ''));
            }}>{node.name}</span>
          )}
          
          {!isEditing && (
            <div className="node-actions" onClick={(e) => e.stopPropagation()}>
              <span className="action-icon" onClick={(e) => { e.stopPropagation(); onCreateFile?.(node.path); setIsOpen(true); }} title="New File">
                <FilePlus size={14} />
              </span>
              <span className="action-icon" onClick={(e) => { e.stopPropagation(); onCreateFolder?.(node.path); setIsOpen(true); }} title="New Folder">
                <FolderPlus size={14} />
              </span>
              <span className="action-icon" onClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditName(node.isDirectory ? node.name : node.name.replace(/\.md$/, '')); }} title="Rename">
                <Edit2 size={14} />
              </span>
              <span className="action-icon" onClick={(e) => { e.stopPropagation(); onDuplicate?.(node.path, true); }} title="Duplicate">
                <Copy size={14} />
              </span>
              <span className="action-icon" onClick={(e) => { e.stopPropagation(); onDelete?.(node.path); }} title="Delete">
                <Trash2 size={14} />
              </span>
            </div>
          )}
        </div>
        {isOpen && node.children && (
          <div className="folder-children">
            {node.children.map(child => (
              <FileExplorerNode
                key={child.path}
                node={child}
                activeFilePath={activeFilePath}
                onFileSelect={onFileSelect}
                onRename={onRename}
                onDelete={onDelete}
                onCreateFile={onCreateFile}
                onCreateFolder={onCreateFolder}
                onMove={onMove}
                onDuplicate={onDuplicate}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`file-node ${isActive ? 'active' : ''}`}
      style={{ paddingLeft }}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        setIsEditing(true);
        setEditName(node.isDirectory ? node.name : node.name.replace(/\.md$/, ''));
      }}
      draggable={!isEditing}
      onDragStart={(e) => {
        const payload = JSON.stringify({ name: node.name, path: node.path });
        e.dataTransfer.setData('application/glade-file', payload);
        e.dataTransfer.setData('text/plain', payload);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <FileText size={14} className="file-icon" />
      {isEditing ? (
        <input 
          type="text" 
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={handleKeyDown}
          autoFocus
          className="node-rename-input"
          style={{ width: '100%', background: 'var(--bg-modifier-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <>
          <span className="node-name">{node.name.replace(/\.md$/, '')}</span>
          <div className="node-actions" onClick={(e) => e.stopPropagation()}>
            <span className="action-icon" onClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditName(node.isDirectory ? node.name : node.name.replace(/\.md$/, '')); }} title="Rename">
              <Edit2 size={14} />
            </span>
            <span className="action-icon" onClick={(e) => { e.stopPropagation(); onDuplicate?.(node.path, false); }} title="Duplicate">
              <Copy size={14} />
            </span>
            <span className="action-icon" onClick={(e) => { e.stopPropagation(); onDelete?.(node.path); }} title="Delete">
              <Trash2 size={14} />
            </span>
          </div>
        </>
      )}
    </div>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = ({ nodes, activeFilePath, onFileSelect, onRename, onDelete, onCreateFile, onCreateFolder, onMove, onDuplicate, level = 0 }) => {
  return (
    <div className="file-explorer">
      {nodes.map(node => (
        <FileExplorerNode
          key={node.path}
          node={node}
          activeFilePath={activeFilePath}
          onFileSelect={onFileSelect}
          onRename={onRename}
          onDelete={onDelete}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onMove={onMove}
          onDuplicate={onDuplicate}
          level={level}
        />
      ))}
    </div>
  );
};

export default FileExplorer;
