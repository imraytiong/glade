import React from 'react';
import { FileNode } from '../utils/fs';
import './StatusBar.css';

interface StatusBarProps {
  activeFile: FileNode | null;
  stats: { wordCount: number, charCount: number, readingTime: number } | null;
}

const StatusBar: React.FC<StatusBarProps> = ({ activeFile, stats }) => {
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
        {activeFile && stats && (
          <>
            <span className="status-item">{stats.charCount} chars</span>
            <span className="status-item">{stats.wordCount} words</span>
            <span className="status-item">{Math.ceil(stats.readingTime)} min read</span>
          </>
        )}
      </div>
    </div>
  );
};

export default StatusBar;
