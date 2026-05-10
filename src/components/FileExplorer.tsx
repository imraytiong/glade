import React, { useState } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder } from 'lucide-react';
import { FileNode } from '../utils/fs';
import './FileExplorer.css';

interface FileExplorerProps {
  nodes: FileNode[];
  activeFilePath: string | null;
  onFileSelect: (file: FileNode) => void;
  onRename?: (oldPath: string, newName: string) => void;
  level?: number;
}

const FileExplorerNode: React.FC<{
  node: FileNode;
  activeFilePath: string | null;
  onFileSelect: (file: FileNode) => void;
  onRename?: (oldPath: string, newName: string) => void;
  level: number;
}> = ({ node, activeFilePath, onFileSelect, onRename, level }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);

  const paddingLeft = `${level * 16 + 12}px`;
  const isActive = activeFilePath === node.path;

  const handleRenameSubmit = () => {
    if (editName && editName !== node.name && onRename) {
      onRename(node.path, editName);
    }
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit();
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(node.name);
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
          setEditName(node.name);
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

  if (node.isDirectory) {
    return (
      <div className="folder-node">
        <div 
          className="folder-header" 
          style={{ paddingLeft }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="folder-icon">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <Folder size={14} className="folder-icon-main" />
          <span className="node-name">{node.name}</span>
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
        setEditName(node.name);
      }}
      draggable={!isEditing}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/glade-file', JSON.stringify({ name: node.name, path: node.path }));
        e.dataTransfer.effectAllowed = 'copyLink';
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
        <span className="node-name">{node.name.replace(/\.md$/, '')}</span>
      )}
    </div>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = ({ nodes, activeFilePath, onFileSelect, onRename, level = 0 }) => {
  return (
    <div className="file-explorer">
      {nodes.map(node => (
        <FileExplorerNode
          key={node.path}
          node={node}
          activeFilePath={activeFilePath}
          onFileSelect={onFileSelect}
          onRename={onRename}
          level={level}
        />
      ))}
    </div>
  );
};

export default FileExplorer;
