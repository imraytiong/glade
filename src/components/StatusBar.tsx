import React from 'react';
import { FileNode } from '../utils/fs';
import './StatusBar.css';

interface StatusBarProps {
  activeFile: FileNode | null;
  content: string | null;
}

const StatusBar: React.FC<StatusBarProps> = ({ activeFile, content }) => {
  const wordCount = content ? content.trim().split(/\s+/).filter(w => w.length > 0).length : 0;
  const charCount = content ? content.length : 0;

  return (
    <div className="status-bar">
      <div className="status-left">
        {activeFile ? (
          <span className="status-item status-path" title={activeFile.path}>
            {activeFile.path}
          </span>
        ) : (
          <span className="status-item">Ready</span>
        )}
      </div>
      <div className="status-right">
        {activeFile && (
          <>
            <span className="status-item">{wordCount} words</span>
            <span className="status-item">{charCount} chars</span>
          </>
        )}
      </div>
    </div>
  );
};

export default StatusBar;
