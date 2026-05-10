import React, { useRef, useEffect } from 'react';
import { X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { FileNode } from '../utils/fs';
import './TabBar.css';

interface TabBarProps {
  openFiles: FileNode[];
  activeFileIndex: number;
  onTabClick: (index: number) => void;
  onTabClose: (e: React.MouseEvent, index: number) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const TabBar: React.FC<TabBarProps> = ({ openFiles, activeFileIndex, onTabClick, onTabClose, isSidebarOpen, onToggleSidebar }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to active tab
  useEffect(() => {
    if (scrollRef.current) {
      const activeTab = scrollRef.current.children[activeFileIndex] as HTMLElement;
      if (activeTab) {
        // Calculate scroll position to center the active tab
        const containerWidth = scrollRef.current.clientWidth;
        const tabOffset = activeTab.offsetLeft;
        const tabWidth = activeTab.clientWidth;
        
        scrollRef.current.scrollTo({
          left: tabOffset - (containerWidth / 2) + (tabWidth / 2),
          behavior: 'smooth'
        });
      }
    }
  }, [activeFileIndex, openFiles.length]);

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current && e.deltaY !== 0) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  if (openFiles.length === 0) return null;

  return (
    <div className="tab-bar-container">
      <button 
        className="sidebar-toggle-btn" 
        onClick={onToggleSidebar}
        title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
      >
        {isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
      </button>
      <div 
        className="tab-bar" 
        ref={scrollRef}
        onWheel={handleWheel}
      >
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
    </div>
  );
};

export default TabBar;
