import React from 'react';
import { X } from 'lucide-react';
import { FileNode } from '../utils/fs';
import './TabBar.css';

interface TabBarProps {
  openFiles: FileNode[];
  activeFileIndex: number;
  onTabClick: (index: number) => void;
  onTabClose: (e: React.MouseEvent, index: number) => void;
}

const TabBar: React.FC<TabBarProps> = ({ openFiles, activeFileIndex, onTabClick, onTabClose }) => {
  if (openFiles.length === 0) return null;

  return (
    <div className="tab-bar">
      {openFiles.map((file, index) => {
        if (!file || !file.name) return null;
        return (
        <div
          key={`${file.path}-${index}`}
          className={`tab ${index === activeFileIndex ? 'active' : ''}`}
          onClick={() => onTabClick(index)}
        >
          <span className="tab-title">{file.name.replace(/\.md$/, '')}</span>
          <button 
            className="tab-close-btn"
            onClick={(e) => onTabClose(e, index)}
          >
            <X size={14} />
          </button>
        </div>
        );
      })}
    </div>
  );
};

export default TabBar;
