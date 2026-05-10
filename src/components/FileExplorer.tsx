import React, { useState } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder } from 'lucide-react';
import { FileNode } from '../utils/fs';
import './FileExplorer.css';

interface FileExplorerProps {
  nodes: FileNode[];
  activeFilePath: string | null;
  onFileSelect: (file: FileNode) => void;
  level?: number;
}

const FileExplorerNode: React.FC<{
  node: FileNode;
  activeFilePath: string | null;
  onFileSelect: (file: FileNode) => void;
  level: number;
}> = ({ node, activeFilePath, onFileSelect, level }) => {
  const [isOpen, setIsOpen] = useState(false);

  const paddingLeft = `${level * 16 + 12}px`;
  const isActive = activeFilePath === node.path;

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
      onClick={() => onFileSelect(node)}
    >
      <FileText size={14} className="file-icon" />
      <span className="node-name">{node.name.replace(/\.md$/, '')}</span>
    </div>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = ({ nodes, activeFilePath, onFileSelect, level = 0 }) => {
  return (
    <div className="file-explorer">
      {nodes.map(node => (
        <FileExplorerNode
          key={node.path}
          node={node}
          activeFilePath={activeFilePath}
          onFileSelect={onFileSelect}
          level={level}
        />
      ))}
    </div>
  );
};

export default FileExplorer;
